# agent-frontend Delta Spec

## ADDED Requirements

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
