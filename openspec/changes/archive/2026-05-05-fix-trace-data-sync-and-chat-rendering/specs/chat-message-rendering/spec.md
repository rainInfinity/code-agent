# chat-message-rendering Specification

## ADDED Requirements

### Requirement: 用户消息纯文本渲染

用户发送的消息（`role === "user"`）SHALL 以纯文本方式渲染，不经过 Markdown 解析。用户消息 SHALL 保留原始换行和空白，并在内容过长时限制最大高度。

#### Scenario: Markdown 特殊字符原样显示

- **GIVEN** 用户发送消息内容为 `用 *强调* 和 _下划线_ 测试 #标题`
- **WHEN** 消息在聊天列表中渲染
- **THEN** 内容 SHALL 以纯文本原样呈现
- **AND** `*`、`_`、`#` 等 Markdown 特殊字符 SHALL NOT 被解析
- **AND** 文本 SHALL 保持原有空白和换行

#### Scenario: 用户长消息限制最大高度

- **GIVEN** 用户发送一条超过 20 行的长消息
- **WHEN** 消息在聊天列表中渲染
- **THEN** 用户消息容器最大高度 SHALL 为 360px
- **AND** 超出部分 SHALL 通过 `overflow-y: auto` 滚动查看
- **AND** 文本 SHALL 使用 `white-space: pre-wrap` 保持换行
- **AND** 长单词 SHALL 使用 `word-break: break-word` 换行

#### Scenario: 用户短消息不显示内部滚动条

- **GIVEN** 用户发送一条短消息
- **WHEN** 消息渲染完成
- **THEN** 用户消息容器 SHALL 自适应内容高度
- **AND** SHALL NOT 显示内部滚动条

### Requirement: 助手消息保持 Markdown 渲染

助手消息（`role === "assistant"`）SHALL 继续使用 MarkdownRenderer 渲染，并保持现有 Markdown、GFM、代码高亮和流式代码块行为。

#### Scenario: 助手 Markdown 正常渲染

- **GIVEN** 助手回复包含标题、列表、加粗和代码块
- **WHEN** 消息在聊天列表中渲染
- **THEN** 内容 SHALL 通过 MarkdownRenderer 渲染
- **AND** GFM 语法 SHALL 正常支持
- **AND** 完整代码块 SHALL 使用 SyntaxHighlighter 高亮
- **AND** 流式生成中的未闭合代码块 SHALL 使用 PlainCodeBlock 渲染

#### Scenario: 助手长消息不使用用户消息高度限制

- **GIVEN** 助手回复内容较长
- **WHEN** 消息渲染
- **THEN** 助手消息 SHALL 不应用用户消息的 360px 最大高度
- **AND** 内容 SHALL 依赖外层消息列表滚动完整查看
