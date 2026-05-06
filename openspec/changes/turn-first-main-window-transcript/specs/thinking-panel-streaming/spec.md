# thinking-panel-streaming Delta Spec

## ADDED Requirements

### Requirement: Thinking panel lifecycle in the main window shall be turn-scoped

主窗口中的 Thinking Panel SHALL 以所属 turn section 的生命周期为准确定义其 streaming / complete 状态、duration 计时、光标显示和自动折叠行为，而不是共享整条 assistant message 的状态。

#### Scenario: Only the active turn shows a blinking cursor

- **GIVEN** 一条 assistant 回复中包含多个 thinking panels
- **AND** 只有最后一个 turn 正在 streaming
- **WHEN** 主窗口渲染这些 panels
- **THEN** 只有当前 active turn 的 panel SHALL 显示 blinking cursor
- **AND** 先前 completed turn 的 panel SHALL NOT 显示 cursor

#### Scenario: Completed turn duration remains frozen while later turn continues

- **GIVEN** 第一个 turn 的 thinking 已完成，第二个 turn 仍在 streaming
- **WHEN** 主窗口持续更新 thinking duration
- **THEN** 第一个 panel 的 duration SHALL 保持冻结
- **AND** 第二个 panel 的 duration SHALL 继续递增

#### Scenario: Auto-collapse is based on the same turn's response start

- **GIVEN** 某个 turn 的 thinking panel 处于展开状态
- **WHEN** 同一个 turn 的 response 开始生成
- **THEN** 该 panel SHALL 根据本 turn 的 response start 自动折叠
- **AND** 其他 turn 的 response 变化 SHALL NOT 触发它的状态切换
