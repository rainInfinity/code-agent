# content-block-messages Specification

## ADDED Requirements

### Requirement: ChatMessage shall support ContentBlock array representation

ChatMessage SHALL store message content as a vector of `ContentBlock` items instead of a plain text string. Each ContentBlock SHALL be one of three variants: `Text`, `ToolUse`, or `ToolResult`.

#### Scenario: Create a user message with text content

- **GIVEN** a user sends "What is in Cargo.toml?"
- **WHEN** a ChatMessage is constructed for this input
- **THEN** the message role is `user`
- **AND** the content field is a vector containing a single `Text` block with value "What is in Cargo.toml?"

#### Scenario: Create an assistant message with mixed content

- **GIVEN** an LLM response includes a text explanation followed by a tool_use for `read_file`
- **WHEN** a ChatMessage is constructed for this response
- **THEN** the message role is `assistant`
- **AND** the content vector contains a `Text` block with the explanation text
- **AND** the content vector contains a `ToolUse` block with tool name `read_file` and its arguments

#### Scenario: Create a tool result message

- **GIVEN** a tool `read_file` has been executed and returned file contents
- **WHEN** a ChatMessage is constructed for this tool result
- **THEN** the message role is `user` (Anthropic format: tool results use user role)
- **AND** the content vector contains a `ToolResult` block with `tool_use_id` matching the original tool call
- **AND** the block includes the result content or error text

### Requirement: ContentBlock shall serialize for Tauri IPC

ContentBlock and ChatMessage types SHALL implement `Serialize` and `Deserialize` so they can be transmitted between Rust backend and TypeScript frontend via Tauri's `invoke` and event system.

#### Scenario: Backend sends assistant message with tool_use to frontend

- **GIVEN** the backend emits a `tool-call` event
- **WHEN** the event payload includes a ChatMessage with a ToolUse ContentBlock
- **THEN** the frontend receives and deserializes the payload correctly
- **AND** the tool name and arguments are accessible as typed fields in TypeScript

#### Scenario: Frontend sends user message to backend

- **GIVEN** the user submits a chat message
- **WHEN** the frontend calls `run_agent` via Tauri invoke with a ChatMessage payload
- **THEN** the backend deserializes the message correctly
- **AND** the Text content block value matches what the user typed

### Requirement: Existing UI shall render ContentBlock messages without regression

The chat message list SHALL render messages with the new ContentBlock structure identically to the previous plain-text format for text-only messages, ensuring no visual regression for existing conversations.

#### Scenario: Render a text-only assistant message

- **GIVEN** an assistant ChatMessage with a single Text content block
- **WHEN** the message is rendered in MessageList
- **THEN** the text is displayed identically to how plain-text messages were rendered before the ContentBlock change
- **AND** existing Markdown rendering, code highlighting, and streaming behavior are preserved

#### Scenario: Render a tool_use block in chat

- **GIVEN** an assistant ChatMessage containing a ToolUse content block for `read_file` with path "src/main.rs"
- **WHEN** the message is rendered in MessageList
- **THEN** a tool-use indicator is shown (e.g., "Reading src/main.rs...")
- **AND** the indicator is visually distinct from regular text content

#### Scenario: Render a tool_result block in chat

- **GIVEN** a user-role ChatMessage containing a ToolResult content block with file contents
- **WHEN** the message is rendered in MessageList
- **THEN** the result is shown in a collapsible or formatted block
- **AND** long results are truncated with an option to expand
