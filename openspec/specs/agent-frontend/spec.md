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

The frontend SHALL provide a `useAgent` hook that encapsulates Agent communication: sending messages via `run_agent`, listening to Agent events (`stream-delta`, `tool-call`, `tool-result`, `agent-turn`, `agent-complete`), and managing stop requests via `stop_agent`.

#### Scenario: Send a message and receive streamed text

- **GIVEN** the user has typed "Hello" in the message input
- **WHEN** the user presses send
- **THEN** `run_agent` is invoked with the user's message
- **AND** streamed text deltas are appended to the current assistant message in real-time
- **AND** the message status shows `streaming` until `stream-end` is received

#### Scenario: Stop agent during execution

- **GIVEN** the agent is in `running` status
- **WHEN** the user clicks the stop button
- **THEN** `stop_agent` is invoked
- **AND** the agent status transitions to `idle` upon receiving `agent-complete` with status `Cancelled`
- **AND** any partially streamed content remains visible

#### Scenario: Receive and display tool-call event

- **GIVEN** the agent is executing and emits a `tool-call` event for `read_file`
- **WHEN** useAgent processes the event
- **THEN** a tool_use content block is appended to the current assistant message
- **AND** the chat UI shows a tool execution indicator

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
