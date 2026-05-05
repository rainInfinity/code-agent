# token-usage-tracking Specification

## ADDED Requirements

### Requirement: Anthropic Provider Token Extraction

Anthropic provider 的 `parse_stream_data` SHALL 从 `message_start` 事件中提取 `usage.input_tokens`，从 `message_delta` 事件中提取 `usage.output_tokens`，并返回为 `ParseResult::Usage` 变体。

#### Scenario: message_start 包含 input_tokens

- **GIVEN** Anthropic streaming 响应包含 `{"type": "message_start", "message": {"usage": {"input_tokens": 1054}}}`
- **WHEN** `parse_stream_data` 处理该事件
- **THEN** SHALL 返回 `ParseResult::Usage { input_tokens: 1054, output_tokens: 0 }`

#### Scenario: message_delta 包含 output_tokens

- **GIVEN** Anthropic streaming 响应包含 `{"type": "message_delta", "usage": {"output_tokens": 342}}`
- **WHEN** `parse_stream_data` 处理该事件
- **THEN** SHALL 返回 `ParseResult::Usage { input_tokens: 0, output_tokens: 342 }`

#### Scenario: 非 Anthropic 事件不影响现有逻辑

- **GIVEN** `StreamEvent::Error` 或其他非 usage 事件
- **WHEN** `parse_stream_data` 处理
- **THEN** SHALL 保持现有行为不变

### Requirement: DeepSeek Provider Token Extraction

DeepSeek provider SHALL 采用与 Anthropic 相同的逻辑（DeepSeek 使用 Anthropic 兼容的事件格式），从 `message_start` 和 `message_delta` 中提取 token 用量。

### Requirement: OpenAI Provider Token Extraction

OpenAI provider 的 `build_chat_request` SHALL 在请求体中包含 `stream_options: { include_usage: true }`。`OpenAiStreamChunk` SHALL 新增 `usage` 字段。`parse_stream_data` SHALL 在检测到 usage chunk（choices 为空且 usage 存在）时返回 `ParseResult::Usage`。

#### Scenario: OpenAI usage chunk 解析

- **GIVEN** OpenAI streaming 响应包含 `{"choices": [], "usage": {"prompt_tokens": 500, "completion_tokens": 200, "total_tokens": 700}}`
- **WHEN** `parse_stream_data` 处理该 chunk
- **THEN** SHALL 返回 `ParseResult::Usage { input_tokens: 500, output_tokens: 200 }`

#### Scenario: 不带 stream_options 的兼容

- **GIVEN** OpenAI API endpoint 不支持 `stream_options.include_usage`
- **WHEN** streaming 响应中无 usage chunk
- **THEN** chat 功能 SHALL 正常工作，token 字段为 0

### Requirement: Token Accumulation in llm.rs

`stream_chat` 和 `stream_chat_with_tools` SHALL 累积所有 `ParseResult::Usage` 变体，以 message_start 的 `input_tokens` 和 message_delta 的 `output_tokens` 为最终值，在流结束时返回。

#### Scenario: Anthropic 两阶段 token 合并

- **GIVEN** stream 中先收到 `Usage { input_tokens: 1054, output_tokens: 0 }`（message_start），后收到 `Usage { input_tokens: 0, output_tokens: 342 }`（message_delta）
- **WHEN** 流结束
- **THEN** 最终 usage SHALL 为 `{ input_tokens: 1054, output_tokens: 342 }`

### Requirement: StreamEndEvent Carries Token Usage

`StreamEndEvent` SHALL 新增 `input_tokens` 和 `output_tokens` 字段。`send_message` 命令 SHALL 在流结束时将累积的 token 用量填入事件并 emit 到前端。

#### Scenario: 正常消息流结束携带 usage

- **GIVEN** 一次 chat 请求消耗 input_tokens=500, output_tokens=200
- **WHEN** 流结束，Rust 后端 emit `stream-end` 事件
- **THEN** 事件 payload SHALL 包含 `input_tokens: 500, output_tokens: 200`

### Requirement: AgentCompleteEvent Carries Token Usage

`AgentCompleteEvent` SHALL 新增 `input_tokens` 和 `output_tokens` 字段，包含整个 Agent 会话所有 Turn 的累计 token 用量。

### Requirement: Frontend TurnTrace Token Storage

`TurnTrace` 类型 SHALL 新增 `usage?: { inputTokens: number; outputTokens: number }` 字段。`useTraceIpc` SHALL 在 `onAgentComplete` 回调中将 token 数据写入当前 TurnTrace。

### Requirement: Token Display in TurnCard

TurnCard 头部 Meta 区域 SHALL 在耗时信息后展示 token 用量，格式为 `↑X.Xk ↓X.Xk`（>1000 使用 k 后缀，保留 1 位小数）。

#### Scenario: 大数量 token 格式化

- **GIVEN** Turn 的 usage 为 `{ inputTokens: 1054, outputTokens: 342 }`
- **WHEN** TurnCard 渲染
- **THEN** SHALL 显示 `↑1.1k ↓0.3k`

#### Scenario: 小数 token 直接显示

- **GIVEN** Turn 的 usage 为 `{ inputTokens: 500, outputTokens: 200 }`
- **WHEN** TurnCard 渲染
- **THEN** SHALL 显示 `↑500 ↓200`

#### Scenario: 无 usage 数据时隐藏

- **GIVEN** Turn 的 `usage` 为 undefined（旧数据或非 Agent 模式）
- **WHEN** TurnCard 渲染
- **THEN** Token 用量 SHALL NOT 显示
