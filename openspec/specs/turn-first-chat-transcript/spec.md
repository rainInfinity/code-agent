# turn-first-chat-transcript Specification

## ADDED Requirements

### Requirement: Assistant execution transcript shall be modeled as turn-scoped records

系统 SHALL 以 turn 作为 assistant 执行生命周期的基本单位。每个 assistant turn SHALL 独立记录其 thinking、tool lifecycle、response 以及所属 assistant message 的关联信息，而不是仅通过单条 assistant message 上的扁平 `contentBlocks` 间接表达。

#### Scenario: A new turn is attached to the current assistant reply

- **WHEN** Agent 在同一条 assistant 回复过程中开始新的一轮 turn
- **THEN** 系统 SHALL 创建新的 turn-scoped record
- **AND** 该 record SHALL 关联到当前 assistant message
- **AND** 该 record SHALL 与先前 turn 保持独立的生命周期状态

#### Scenario: Multiple turns exist in one assistant reply

- **GIVEN** 一次 Agent 运行包含多个 tool loop 或多轮推理
- **WHEN** 主窗口消费这次回复的数据
- **THEN** 系统 SHALL 能区分每一轮 turn 的 thinking、tools 和 response 边界
- **AND** SHALL NOT 仅通过累计文本推断这些边界

### Requirement: Canonical turn transcript shall preserve assistant and user protocol boundaries

canonical turn transcript SHALL 保留 provider 所需的 assistant / user 交替语义。assistant `tool_use` 与对应的 user `tool_result` SHALL 在 transcript 中保持合法邻接关系，即使主窗口选择将它们投影到同一条 assistant 回复气泡中展示。

#### Scenario: Build transcript for a tool turn

- **GIVEN** 某个 turn 中 assistant 发出了一个或多个 `tool_use`
- **WHEN** 系统从 canonical turn transcript 派生 provider-compatible history
- **THEN** transcript SHALL 先输出该 turn 的 assistant 内容
- **AND** 紧随其后 SHALL 输出包含对应 `tool_result` blocks 的 user message

#### Scenario: Build transcript for a later text turn

- **GIVEN** 先前 turn 已完成 tool execution，后续 turn 产生最终文本回复
- **WHEN** 系统派生 provider-compatible history
- **THEN** 最终文本 SHALL 位于后续 assistant turn 的位置
- **AND** SHALL NOT 被回填到先前 tool turn 的 assistant transcript 中

### Requirement: Legacy conversations shall normalize into a turn-first consumable structure

系统 SHALL 为已有的 message-first 会话提供 turn-first 兼容归一化结果，使历史会话在主窗口中仍可阅读，并且后续继续对话时不会因为非法 transcript 结构而失败。

#### Scenario: Legacy conversation without explicit turn metadata

- **GIVEN** 一个历史会话只包含扁平 assistant message、`thinkingContent` 与 tool traces
- **WHEN** 会话被加载到新的 turn-first 系统
- **THEN** 系统 SHALL 至少生成一个可消费的 assistant turn 结构
- **AND** 历史内容 SHALL 保持可阅读

#### Scenario: Legacy conversation continues into a new run

- **GIVEN** 一个历史会话已被归一化到 turn-first 可消费结构
- **WHEN** 用户在该会话中继续发起下一轮对话
- **THEN** 系统 SHALL 使用归一化后的 canonical transcript 组装 provider history
- **AND** SHALL NOT 因为旧的扁平 message 结构再次生成非法 `tool_use` / `tool_result` 顺序
