## Why

当使用 DeepSeek Reasoner（deepseek-reasoner）等支持 thinking 模式的模型进行多轮 agent 对话时，API 返回 400 错误：

```
The `content[].thinking` in the thinking mode must be passed back to the API.
```

根因是：stream 响应中的 `thinking_delta` 仅被转发到 Trace UI 显示，但未存储到 `ChatMessage.content_blocks` 中。后续轮次发送历史消息给 API 时，缺少 `thinking` 内容块，DeepSeek API 拒绝请求。

同时，`ContentBlock` 枚举缺少 `Thinking` 变体，无法表达 thinking 内容块的语义。

此外，多工具并行执行时，`agent_loop` 逐个调用 `add_tool_result` 导致每个 tool_result 独占一条 user 消息。Anthropic/DeepSeek API 要求 assistant 消息中**所有** `tool_use` 块的对应 `tool_result` 必须在**紧接的同一条** user 消息中。拆成多条 user 消息会导致后续 tool_use 在错误偏移处查找 tool_result，触发 400 错误：

```
Each `tool_use` block must have a corresponding `tool_result` block in the next message.
```

## What Changes

- `ContentBlock` 枚举新增 `Thinking` 变体
- `LlmStreamResult` 新增 `thinking_content` 字段，收集完整的 thinking 文本
- `stream_chat_with_tools` 流处理中累积 thinking 内容
- `agent_loop` 将 thinking content 传递给 `add_assistant_message`
- `AgentSession::add_assistant_message` 接受 thinking 内容并构造 `Thinking` 块
- `AgentSession` 新增 `add_tool_results_batch` 方法，将所有 tool_result 合并到单条 user 消息中
- `agent_loop` 收集所有工具执行结果后一次性调用 batch 方法

## Capabilities

### Modified Capabilities

- `content-block-messages`: `ContentBlock` 枚举扩展 `Thinking` 变体
- `agent-core-loop`: `add_assistant_message` 支持 thinking 块

## Impact

- `src-tauri/src/models.rs` — `ContentBlock` 新增 `Thinking` 变体
- `src-tauri/src/llm.rs` — `LlmStreamResult` 新增 `thinking_content`；流处理中收集 thinking
- `src-tauri/src/agent/session.rs` — `add_assistant_message` 签名扩展，支持 thinking 参数；新增 `add_tool_results_batch` 方法
- `src-tauri/src/agent/runtime.rs` — `agent_loop` 传递 thinking 内容；改用 batch 方式添加 tool_result
