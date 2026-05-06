## ADDED Requirements

### Requirement: Provider transcript shall preserve tool-result adjacency for tool-use turns

系统在向 Anthropic/DeepSeek 等 provider 构建 transcript 时，assistant `tool_use` 所在消息后的紧邻下一条 user 消息 SHALL 承载该轮全部对应的 `tool_result` 块；assistant 文本回复 MUST 出现在这些 `tool_result` 之后，不能插入其间。

#### Scenario: Successful tool turn emits adjacent user tool_result message

- **GIVEN** 某一轮 assistant 输出包含 thinking、一个或多个 `tool_use`，且该轮没有最终文本回复
- **WHEN** 系统为下一轮 provider 请求构建 transcript
- **THEN** transcript SHALL 先包含该条 assistant 消息
- **AND** 紧邻的下一条 user 消息 SHALL 只包含对应的 `tool_result` content blocks
- **AND** 后续 assistant 文本回复 SHALL 出现在再下一条 assistant 消息中

#### Scenario: Failed tool turn still emits adjacent user tool_result message

- **GIVEN** 某一轮工具执行失败，结果内容为错误文本
- **WHEN** 系统为下一轮 provider 请求构建 transcript
- **THEN** 失败结果 SHALL 仍以紧邻 assistant `tool_use` 的 user `tool_result` 消息发送
- **AND** 该 `tool_result` 块 SHALL 标记错误状态
- **AND** transcript SHALL NOT 在该 assistant `tool_use` 与 user `tool_result` 之间插入 assistant 文本消息
