# content-block-messages Delta Spec

## MODIFIED Requirements

### Requirement: ChatMessage shall support ContentBlock array representation

ChatMessage SHALL store message content as a vector of `ContentBlock` items instead of a plain text string. Each ContentBlock SHALL be one of four variants: `Text`, `Thinking`, `ToolUse`, or `ToolResult`。ContentBlock 在数组中的顺序 SHALL 反映事件发生的时间顺序。

#### Scenario: Create a user message with text content

- **GIVEN** a user sends "What is in Cargo.toml?"
- **WHEN** a ChatMessage is constructed for this input
- **THEN** the message role is `user`
- **AND** the content field is a vector containing a single `Text` block with value "What is in Cargo.toml?"

#### Scenario: Create an assistant message with tool_use blocks

- **GIVEN** an LLM response includes a thinking block followed by two tool_use blocks for `grep` and `read_file`
- **WHEN** a ChatMessage is constructed for this response
- **THEN** the message role is `assistant`
- **AND** the content vector contains a `Thinking` block first
- **AND** the content vector contains `ToolUse` blocks for both tools after the thinking block
- **AND** the content vector SHALL NOT contain a `Text` block（因为工具调用回合不生成文本回复）

#### Scenario: Create a final assistant message with text response

- **GIVEN** the LLM has processed all tool results and generates a final text response
- **WHEN** a ChatMessage is constructed for this final response
- **THEN** the message role is `assistant`
- **AND** if thinking occurred, a `Thinking` block comes first
- **AND** a `Text` block with the response comes after any thinking

#### Scenario: Create a tool result message

- **GIVEN** a tool `read_file` has been executed and returned file contents
- **WHEN** a ChatMessage is constructed for this tool result
- **THEN** the message role is `user` (Anthropic format: tool results use user role)
- **AND** the content vector contains a `ToolResult` block with `tool_use_id` matching the original tool call
- **AND** the block includes the result content or error text

### Requirement: Existing UI shall render ContentBlock messages without regression

The chat message list SHALL render messages with the new ContentBlock structure identically to the previous plain-text format for text-only messages, ensuring no visual regression for existing conversations. 当消息包含多种块类型时，渲染顺序 SHALL 遵循 contentBlocks 数组中的块顺序。

#### Scenario: Render a text-only assistant message

- **GIVEN** an assistant ChatMessage with a single Text content block
- **WHEN** the message is rendered in MessageList
- **THEN** the text is displayed identically to how plain-text messages were rendered before the ContentBlock change
- **AND** existing Markdown rendering, code highlighting, and streaming behavior are preserved

#### Scenario: Render a tool_use block in chat before text

- **GIVEN** an assistant ChatMessage containing contentBlocks `[{type: 'tool_use', name: 'read_file'}, {type: 'text', text: 'I found...'}]`
- **WHEN** the message is rendered in MessageList
- **THEN** the tool-use indicator SHALL appear above/before the text response
- **AND** the tool-use indicator is visually distinct from regular text content

#### Scenario: Render a tool_result block in chat

- **GIVEN** a user-role ChatMessage containing a ToolResult content block with file contents
- **WHEN** the message is rendered in MessageList
- **THEN** the result is shown in a collapsible or formatted block
- **AND** long results are truncated with an option to expand
