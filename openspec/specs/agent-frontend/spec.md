# agent-frontend Specification

## ADDED Requirements

### Requirement: agentStore shall manage Agent runtime state

The frontend SHALL provide an `agentStore` (Zustand) that tracks the current Agent session status (`idle`, `running`, `waiting_permission`), turn count, and any pending tool calls or permission requests.

#### Scenario: Agent transitions from idle to running

- **GIVEN** the agentStore status is `idle`
- **WHEN** the user sends a message and `run_agent` is invoked
- **THEN** the status transitions to `running`
- **AND** the send button is replaced with a stop button

#### Scenario: Agent returns to idle after completion

- **GIVEN** the agentStore status is `running`
- **WHEN** an `agent-complete` event is received
- **THEN** the status transitions to `idle`
- **AND** the stop button is replaced with the send button

#### Scenario: Agent transitions to waiting_permission

- **GIVEN** the agentStore status is `running`
- **WHEN** a `permission-request` event is received
- **THEN** the status transitions to `waiting_permission`
- **AND** a permission dialog is displayed to the user

### Requirement: useAgent hook shall replace useChat for Agent interaction

The frontend SHALL provide a `useAgent` hook that encapsulates Agent communication: sending messages via `run_agent`, listening to Agent events (`stream-delta`, tool trace events, turn lifecycle events, and `agent-complete`), managing stop requests via `stop_agent`, and writing canonical Turn/Tool trace state into the shared frontend store.

#### Scenario: Send a message and receive streamed text

- **GIVEN** the user has typed "Hello" in the message input
- **WHEN** the user presses send
- **THEN** `run_agent` is invoked with the user's message
- **AND** streamed text deltas are appended to the current assistant message in real-time
- **AND** the message status shows `streaming` until the response finishes

#### Scenario: Stop agent during execution

- **GIVEN** the agent is in `running` status
- **WHEN** the user clicks the stop button
- **THEN** `stop_agent` is invoked
- **AND** the agent status transitions to `idle` upon receiving terminal completion
- **AND** any partially streamed content remains visible

#### Scenario: Receive tool execution lifecycle updates

- **GIVEN** the agent emits structured updates for a tool call
- **WHEN** `useAgent` processes requested, running, and terminal tool states
- **THEN** it SHALL update the current assistant message and the current turn trace in place
- **AND** the same canonical tool state SHALL be available to both the main chat UI and the Trace window
- **AND** the frontend SHALL NOT require each window to reconstruct tool state independently

### Requirement: useAgent shall co-exist with legacy useChat during migration

The `useAgent` hook SHALL be introduced alongside the existing `useChat` hook so that existing functionality continues working while the migration is in progress. Both hooks SHALL use the same underlying `chatStore` for message data.

#### Scenario: Existing chat features work during migration

- **GIVEN** `useAgent` is being integrated but `useChat` is still used in some views
- **WHEN** a message is sent through either hook
- **THEN** messages appear in the shared chatStore and are rendered correctly
- **AND** settings, conversation switching, and model selection continue to work

### Requirement: Stop control shall be full-stack

The stop button in the frontend SHALL trigger a CancellationToken on the backend AgentLoop, stopping both the LLM streaming and any in-progress tool execution.

#### Scenario: Click stop during LLM streaming

- **GIVEN** the LLM is streaming a text response to the frontend
- **WHEN** the user clicks the stop button
- **THEN** `stop_agent` command is sent to the backend
- **AND** the backend CancellationToken is set to cancelled
- **AND** the LLM stream is aborted
- **AND** an `agent-complete` event with status `Cancelled` is received by the frontend

#### Scenario: Click stop during tool execution

- **GIVEN** the Agent is executing a `bash` tool that is running a long command
- **WHEN** the user clicks the stop button
- **THEN** `stop_agent` command is sent to the backend
- **AND** the running tool process is terminated
- **AND** the AgentLoop exits with status `Cancelled`

### Requirement: Frontend turn trace state shall have a single canonical owner

前端 SHALL 以共享 conversation store 中的 `turns` 数据作为 Turn/Tool 追踪真相来源。主窗口与 Trace 窗口可以维护各自的视图状态，但 SHALL NOT 各自独立重建同一条 Turn 生命周期。

#### Scenario: Turn closes in the canonical store

- **GIVEN** 当前 conversation 的最新 turn 处于 running 状态
- **WHEN** 前端接收到该 turn 的终止更新
- **THEN** 共享 conversation store SHALL 先更新该 turn 的终止状态和结束时间
- **AND** 依赖该 store 的主窗口与 Trace 窗口 SHALL 看到一致的 turn 状态

#### Scenario: Trace window syncs canonical turns

- **GIVEN** 主窗口已经把某个 conversation 的 turns 更新为最新状态
- **WHEN** Trace 窗口同步该 conversation
- **THEN** Trace 窗口 SHALL 直接消费这份 turn 数据
- **AND** SHALL NOT 再独立推断不同的 turn 结束结果

### Requirement: 应用入口路由 SHALL 根据窗口标识选择根组件

`main.tsx` 中的 `isTraceWindow()` 函数 SHALL 以 URL 查询参数 `window=trace` 为主判定依据，`getCurrentWebviewWindow().label` 为辅助判定，决定渲染 `<TraceApp />` 还是 `<App />`。

#### Scenario: Trace 窗口通过 URL 参数正确渲染

- **GIVEN** 当前 webview 的 URL 包含 `?window=trace`
- **WHEN** React 根组件挂载
- **THEN** 渲染 `<TraceApp />`（而非 `<App />`）
- **AND** 不加载主应用的 `Sidebar`、`TitleBar`（主窗口控件）、`ChatPanel` 等组件

#### Scenario: 主窗口正确渲染

- **GIVEN** 当前 webview 的 URL 不包含 `?window=trace` 且 `getCurrentWebviewWindow().label` 不等于 `'trace'`
- **WHEN** React 根组件挂载
- **THEN** 渲染 `<App />`（而非 `<TraceApp />`）

#### Scenario: IPC 不可用时的降级判定

- **GIVEN** `getCurrentWebviewWindow()` 抛出异常（如 IPC 未就绪）
- **WHEN** `isTraceWindow()` 执行
- **THEN** 捕获异常，回退到仅检查 URL 参数 `params.get('window') === 'trace'`
- **AND** 程序不崩溃，继续正常渲染

### Requirement: useAgent shall persist turn ownership metadata for main-window projection

`useAgent` SHALL 在共享 conversation store 中写入主窗口所需的 turn ownership 信息，使每个 assistant turn 都能明确关联到其所属的 assistant message，并供主窗口与 Trace 窗口共同消费。

#### Scenario: First turn of an assistant reply starts

- **GIVEN** 用户已发送一条消息并创建当前 assistant message
- **WHEN** `useAgent` 接收到该次运行的第一个 `agent-turn`
- **THEN** 它 SHALL 在共享 store 中创建 turn 记录
- **AND** 该 turn SHALL 关联到当前 assistant message

#### Scenario: Later turns reuse the same assistant reply container

- **GIVEN** 同一条 assistant 回复过程中开始后续 turn
- **WHEN** `useAgent` 更新共享 store
- **THEN** 后续 turn SHALL 继续关联到同一条 assistant message
- **AND** 每个 turn SHALL 仍保持独立状态而非覆盖上一轮 turn

### Requirement: Frontend shared state shall not require main chat to reconstruct turn boundaries from flattened content blocks

前端共享 store SHALL 直接提供可供主窗口渲染的 turn 边界信息。主窗口 SHALL NOT 依赖扫描扁平 `contentBlocks`、累计 `thinkingContent` 或 message 级共享状态来重新推断 turn 生命周期。

#### Scenario: Main window consumes assistant turn data

- **WHEN** 主窗口渲染一条包含多个 assistant turns 的回复
- **THEN** 它 SHALL 直接读取共享 store 中的 turn-scoped 数据
- **AND** SHALL NOT 仅依据扁平 `contentBlocks` 顺序重建 thinking / tool / response 边界

#### Scenario: Trace window and main window observe the same turn completion

- **GIVEN** 某个 turn 在共享 store 中转为 completed
- **WHEN** 主窗口和 Trace 窗口同时刷新
- **THEN** 两个窗口 SHALL 看到相同的 turn 完成态
- **AND** 主窗口 SHALL NOT 继续把该 turn 误判为 streaming
