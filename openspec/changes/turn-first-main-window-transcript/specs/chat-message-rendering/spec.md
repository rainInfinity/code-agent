# chat-message-rendering Delta Spec

## ADDED Requirements

### Requirement: Assistant message body shall render turn sections in canonical order

当一条 assistant 回复包含多个 turns 时，主窗口 SHALL 在同一个 assistant message body 中按 canonical turn 顺序渲染多个 turn sections。每个 turn section SHALL 作为独立的可视语义单元包含 thinking、tools 和 response。

#### Scenario: Render a multi-turn assistant reply

- **GIVEN** 一条 assistant 回复关联了两个 turns
- **WHEN** 主窗口渲染该回复
- **THEN** 主窗口 SHALL 先渲染第一个 turn section，再渲染第二个 turn section
- **AND** 每个 turn section 的 thinking、tools 和 response SHALL 保持本 turn 内部顺序

#### Scenario: Render a tool-only turn followed by a text turn

- **GIVEN** 第一个 turn 只包含 thinking 和 tool execution，第二个 turn 生成最终文本
- **WHEN** 主窗口渲染该回复
- **THEN** 第一个 turn section SHALL 不伪造最终文本块
- **AND** 最终文本 SHALL 只出现在后续文本 turn section 中

### Requirement: Main-window thinking panels shall be scoped per turn section

主窗口中的每个 thinking panel SHALL 绑定到单独的 turn section。不同 thinking panel 的内容、进行中/完成状态、时长和光标显示 SHALL 相互独立。

#### Scenario: Earlier thinking panel stays complete while later turn is streaming

- **GIVEN** 一条 assistant 回复中第一个 turn 已完成，第二个 turn 正在 thinking
- **WHEN** 主窗口渲染两个 thinking panels
- **THEN** 第一个 panel SHALL 显示 completed 状态
- **AND** 第二个 panel SHALL 显示 streaming 状态

#### Scenario: Thinking duration is independent per turn

- **GIVEN** 两个 turns 的 thinking 开始时间不同
- **WHEN** 主窗口显示它们的 thinking duration
- **THEN** 每个 panel SHALL 使用所属 turn 的开始/结束时间计算时长
- **AND** SHALL NOT 共享同一个 message 级计时器
