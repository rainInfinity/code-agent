# content-block-unified-rendering Specification

## ADDED Requirements

### Requirement: contentBlocks 作为消息渲染的唯一数据源

Message 的 `contentBlocks` 数组 SHALL 作为消息内容渲染的唯一顺序数据源。`MessageBodyContent` SHALL 遍历 `contentBlocks` 按顺序渲染每个块，而不是分别从 `thinkingContent`、`content`、`toolTraces` 取值并硬编码顺序。

#### Scenario: 包含思考和文本的消息按 contentBlocks 顺序渲染

- **GIVEN** 一个 assistant 消息的 contentBlocks 为 `[{type: 'thinking', ...}, {type: 'text', ...}]`
- **WHEN** MessageBodyContent 渲染该消息
- **THEN** ThinkingPanel SHALL 先于 MarkdownRenderer 渲染
- **AND** 渲染顺序 SHALL 严格遵循 contentBlocks 数组中的元素顺序

#### Scenario: 包含工具调用的消息按时间顺序渲染

- **GIVEN** 一个 assistant 消息的 contentBlocks 为 `[{type: 'thinking'}, {type: 'tool_use', name: 'grep'}, {type: 'tool_result', ...}, {type: 'text'}]`
- **WHEN** MessageBodyContent 渲染该消息
- **THEN** 工具卡片 SHALL 渲染在文本回复之前
- **AND** tool_use 和 tool_result SHALL 按事件到达顺序显示

### Requirement: thinking-delta 事件同步追加 thinking ContentBlock

当 `appendThinkingToMessage` 被调用时，除更新 `thinkingContent` 字段外，SHALL 同步向 `contentBlocks` 追加或更新 `thinking` 类型的 ContentBlock。

#### Scenario: 流式思考的第一个 delta

- **GIVEN** 消息 contentBlocks 为空或最后一个块不是 thinking 类型
- **WHEN** 收到第一个 thinking delta
- **THEN** 一个新的 `{type: 'thinking', thinking: delta}` 块 SHALL 被追加到 contentBlocks 末尾

#### Scenario: 流式思考的后续 delta

- **GIVEN** 消息 contentBlocks 最后一个块是 `{type: 'thinking', thinking: '之前的思考'}` 
- **WHEN** 收到后续 thinking delta
- **THEN** 最后一个 thinking 块的 `thinking` 字段 SHALL 更新为追加后的内容
- **AND** SHALL NOT 新增一个 thinking 块

### Requirement: tool-trace 事件同步追加 tool_use 和 tool_result ContentBlock

当 `applyToolTraceToMessage` 被调用时，SHALL 根据事件 phase 向 `contentBlocks` 追加对应的 ContentBlock。

#### Scenario: 工具被请求

- **GIVEN** tool-trace 事件的 phase 为 `requested`
- **WHEN** applyToolTraceToMessage 处理该事件
- **THEN** 一个 `{type: 'tool_use', id: toolCallId, name, input}` 块 SHALL 被追加到 contentBlocks 末尾

#### Scenario: 工具执行完成

- **GIVEN** tool-trace 事件的 phase 为 `completed`
- **WHEN** applyToolTraceToMessage 处理该事件
- **THEN** 一个 `{type: 'tool_result', toolUseId, content: output, isError: false}` 块 SHALL 被追加到 contentBlocks 末尾

#### Scenario: 工具执行失败

- **GIVEN** tool-trace 事件的 phase 为 `failed`
- **WHEN** applyToolTraceToMessage 处理该事件
- **THEN** 一个 `{type: 'tool_result', toolUseId, content: error, isError: true}` 块 SHALL 被追加到 contentBlocks 末尾

### Requirement: 旧格式消息向后兼容迁移

当从持久化存储加载消息时，`normalizePersistedConversations` SHALL 检测并迁移旧格式消息：如果消息的 `contentBlocks` 为空或仅含 text 块，但 `thinkingContent` 或 `toolTraces` 非空，则从这些独立字段重建 `contentBlocks`。

#### Scenario: 旧消息有思考和工具调用但无 contentBlocks

- **GIVEN** 一条旧消息的 `contentBlocks` 为 `[]`，`thinkingContent` 非空，`toolTraces` 有两个已完成工具
- **WHEN** 消息被 normalizePersistedConversations 处理
- **THEN** contentBlocks SHALL 被重建为 `[thinking, tool_use, tool_result, tool_use, tool_result]` 顺序

#### Scenario: 旧消息有思考、文本和工具调用

- **GIVEN** 一条旧消息的 `contentBlocks` 为 `[{type: 'text', text: '...'}]`，`thinkingContent` 非空，`toolTraces` 有已完成工具
- **WHEN** 消息被 normalizePersistedConversations 处理
- **THEN** contentBlocks SHALL 被重建为 `[thinking, tool_use, tool_result, text]` 顺序
- **AND** 文本块 SHALL 位于最后（因为工具调用实际发生在文本生成之前）

#### Scenario: 新格式消息不触发迁移

- **GIVEN** 一条新格式消息的 contentBlocks 已包含 `[thinking, tool_use, tool_result, text]`
- **WHEN** 消息被 normalizePersistedConversations 处理
- **THEN** contentBlocks SHALL 保持不变
- **AND** SHALL NOT 重复追加块
