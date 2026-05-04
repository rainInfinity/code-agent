# tool-use-streaming Specification

## ADDED Requirements

### Requirement: LlmClient shall parse Anthropic ContentBlock streaming events

LlmClient SHALL parse the Anthropic Messages API streaming response into discrete content block events: `ContentBlockStart`, `ContentBlockDelta`, and `ContentBlockStop`, distinguishing between `text` and `tool_use` block types.

#### Scenario: Stream a text-only response

- **GIVEN** the LLM returns a response with a single text content block
- **WHEN** LlmClient processes the SSE stream
- **THEN** a `content_block_start` event is emitted with type `text`
- **AND** one or more `content_block_delta` events are emitted with `text_delta` payloads
- **AND** a `content_block_stop` event is emitted when the text block is complete
- **AND** the frontend receives `stream-delta` events for each text delta

#### Scenario: Stream a response with tool_use block

- **GIVEN** the LLM returns a response containing a tool_use content block for `read_file`
- **WHEN** LlmClient processes the SSE stream
- **THEN** a `content_block_start` event is emitted with type `tool_use` and tool name `read_file`
- **AND** `content_block_delta` events carry `input_json_delta` payloads with partial JSON for tool arguments
- **AND** a `content_block_stop` event is emitted when the tool_use block is complete
- **AND** the frontend receives a `tool-call` event with the complete tool name and arguments

#### Scenario: Stream a response with multiple content blocks

- **GIVEN** the LLM returns a response with a text block followed by two tool_use blocks
- **WHEN** LlmClient processes the SSE stream
- **THEN** each content block is emitted with its own start/delta/stop event sequence
- **AND** the blocks are emitted in the order they appear in the response
- **AND** the frontend receives interleaved `stream-delta` and `tool-call` events

### Requirement: LlmClient shall reconstruct tool_use from input_json_delta fragments

LlmClient SHALL accumulate `input_json_delta` fragments within a tool_use block and parse the complete JSON only when `ContentBlockStop` is received, then emit a complete tool-call event.

#### Scenario: Tool arguments arrive in multiple deltas

- **GIVEN** a tool_use block for `write_file` with arguments `{"path": "/a/b/c.rs", "content": "..."}`
- **WHEN** the arguments are streamed as 3 separate `input_json_delta` fragments
- **THEN** the fragments are concatenated in order: `{"path":`, `"/a/b/c.rs",`, `"content": "..."}`
- **AND** the full JSON is parsed successfully only after `ContentBlockStop`
- **AND** a single `tool-call` event with the complete parsed arguments is emitted

#### Scenario: Malformed tool_use JSON

- **GIVEN** a tool_use block whose accumulated JSON is syntactically invalid
- **WHEN** `ContentBlockStop` is received and JSON parsing is attempted
- **THEN** a `tool-result` event is emitted with an error message indicating the parse failure
- **AND** the AgentLoop can choose to report this error to the LLM for retry

### Requirement: LlmClient shall forward stream events to Tauri event bus

LlmClient SHALL emit Tauri events (`stream-delta`, `stream-end`, `tool-call`) that the frontend can listen to, decoupling the HTTP streaming logic from UI rendering.

#### Scenario: Frontend receives stream-delta events during text generation

- **GIVEN** the frontend is listening to `stream-delta` events
- **WHEN** LlmClient processes text content block deltas
- **THEN** the frontend receives events with `{ messageId, delta, contentType: "text" }`
- **AND** the events arrive in real-time as the LLM streams

#### Scenario: Frontend receives stream-end event after completion

- **GIVEN** a streaming LLM response has finished
- **WHEN** all content blocks have been processed
- **THEN** a `stream-end` event is emitted with `{ messageId }`
- **AND** the frontend can transition the message status from `streaming` to `complete`
