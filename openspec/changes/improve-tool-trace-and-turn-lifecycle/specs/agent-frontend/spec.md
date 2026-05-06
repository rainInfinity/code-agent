## MODIFIED Requirements

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

## ADDED Requirements

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

