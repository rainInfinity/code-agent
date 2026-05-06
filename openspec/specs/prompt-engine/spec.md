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

### Requirement: Provider-compatible transcript shall preserve tool adjacency across turns

系统在构建 provider 请求历史时 SHALL 保留合法的 `assistant(tool_use) -> user(tool_result)` 邻接关系，即使主窗口将多个 turn 投影到单条 assistant 回复中展示。

#### Scenario: Continue conversation after one tool turn

- **GIVEN** 上一轮 assistant 回复中包含一个 tool turn，并且工具结果已返回
- **WHEN** 用户继续发起下一轮对话
- **THEN** provider history SHALL 包含带有 `tool_use` 的 assistant transcript entry
- **AND** 紧随其后 SHALL 包含对应 `tool_result` blocks 的 user transcript entry

#### Scenario: Continue conversation after multiple tool turns

- **GIVEN** 上一轮 assistant 回复中连续经历多个 turns，且至少两个 turns 包含工具调用
- **WHEN** 系统构建 provider history
- **THEN** 每个 tool turn 的 `tool_use` 和 `tool_result` SHALL 保持各自合法邻接
- **AND** 后续 turn 的文本或 thinking SHALL NOT 插入到前一个 tool turn 的 `tool_use` 和 `tool_result` 之间

### Requirement: Prompt sanitization shall not drop required tool_result blocks from canonical transcript

任何 prompt sanitization 或 UI filtering 逻辑 SHALL 只作用于渲染投影层，不得删除 canonical transcript 中为 provider 协议所必需的 `tool_result` blocks。

#### Scenario: Main-window filtering differs from provider history

- **GIVEN** 主窗口选择隐藏或折叠某些可视 blocks
- **WHEN** 系统构建 provider history
- **THEN** sanitization SHALL 以 canonical transcript 的协议正确性为准
- **AND** SHALL NOT 因为 assistant UI blocks 的过滤规则而遗漏必需的 `tool_result`

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
