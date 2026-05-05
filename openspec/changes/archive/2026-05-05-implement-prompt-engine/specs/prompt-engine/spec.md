## ADDED Requirements

### Requirement: PromptEngine shall assemble system prompt from templates

The PromptEngine SHALL assemble a complete system prompt by concatenating static sections, a cache boundary marker, and dynamic sections in order.

#### Scenario: Code agent mode

- **GIVEN** agent_type is "code"
- **WHEN** `PromptEngine::build()` is called
- **THEN** the system prompt SHALL include: Base System Prompt, Code Agent Role, Tool Priority Rules, the cache boundary marker, and Runtime Context
- **AND** the result SHALL be a single `String` with sections separated by double newlines

#### Scenario: Chat agent mode

- **GIVEN** agent_type is "chat"
- **WHEN** `PromptEngine::build()` is called
- **THEN** the system prompt SHALL include: Base System Prompt, Chat Agent Role, the cache boundary marker, and Runtime Context
- **AND** Tool Priority Rules SHALL NOT be included (chat mode has no tools)

#### Scenario: Template variable substitution

- **GIVEN** a template contains `{{os}}`, `{{shell}}`, `{{cwd}}`
- **WHEN** the session context provides `os = "Windows 11"`, `shell = "PowerShell"`, `cwd = "/project"`
- **THEN** the rendered output SHALL replace each placeholder with the corresponding value

### Requirement: Anthropic API request shall include system prompt

The Anthropic API request body SHALL include a `system` field containing the assembled system prompt.

#### Scenario: System prompt in API request

- **WHEN** `AnthropicProvider::build_chat_request()` serializes the request
- **THEN** the JSON output SHALL include a top-level `"system"` key
- **AND** its value SHALL be the system prompt string (not wrapped in messages array)

#### Scenario: Empty system prompt omitted

- **WHEN** the system prompt is empty or not provided
- **THEN** the `"system"` field SHALL be omitted from the JSON output

### Requirement: Runtime context shall be collected for dynamic prompt sections

The system SHALL collect runtime environment information to populate dynamic prompt sections.

#### Scenario: Context collection in agent loop

- **WHEN** `agent_loop` starts a new turn
- **THEN** a `SessionContext` SHALL be constructed with: OS name, shell name, architecture, current working directory
- **AND** Git branch and Git status SHALL be collected if available

#### Scenario: Context collection in send_message

- **WHEN** `send_message` is invoked
- **THEN** the same `SessionContext` SHALL be constructed for PromptEngine

### Requirement: Trace prompt event shall be emitted before each LLM call

A `trace-prompt` Tauri event SHALL be emitted at the start of each turn, containing the full prompt data being sent to the LLM.

#### Scenario: Event emitted in agent loop

- **GIVEN** an agent loop turn is about to call the LLM
- **WHEN** `PromptEngine::build()` completes
- **THEN** a `trace-prompt` event SHALL be emitted
- **AND** the event payload SHALL include: conversation_id, session_id, turn number, system_prompt, messages array, and tools list

#### Scenario: Event emitted in send_message

- **WHEN** `send_message` is about to call the LLM after building the prompt
- **THEN** a `trace-prompt` event SHALL also be emitted

#### Scenario: No event when no listener

- **WHEN** no frontend window is listening for `trace-prompt` events
- **THEN** the emit SHALL succeed silently (Tauri events are fire-and-forget)

### Requirement: Prompt templates shall be file-based and statically embedded

Prompt template content SHALL be stored as Markdown files in `src-tauri/prompts/` and embedded at compile time.

#### Scenario: Template loaded at compile time

- **WHEN** the application compiles
- **THEN** all `.md` files in `src-tauri/prompts/` SHALL be embedded via `include_str!`
- **AND** missing template files SHALL cause a compile error

#### Scenario: Template directory structure

- **GIVEN** the prompt engine is initialized
- **THEN** the following templates SHALL be available:
  - `base_system.md` — base system prompt (role, code style, security)
  - `agent_code.md` — code agent role description
  - `agent_chat.md` — chat agent role description
  - `rules_tool_priority.md` — tool usage priority instructions
  - `runtime_context.md` — runtime context template with placeholders
