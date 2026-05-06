## 1. 数据模型

- [x] 1.1 `ContentBlock` 枚举新增 `Thinking { thinking: String }` 变体（`models.rs`）
- [x] 1.2 `LlmStreamResult` 新增 `thinking_content: String` 字段（`llm.rs`）

## 2. 流处理中收集 thinking 内容

- [x] 2.1 `stream_chat_with_tools` 中新增 `thinking_content` 累积变量
- [x] 2.2 `ParseResult::ThinkingDelta` 分支添加 thinking 累积逻辑
- [x] 2.3 返回 `LlmStreamResult` 时包含 `thinking_content`

## 3. Session 消息构造

- [x] 3.1 `add_assistant_message` 签名新增 `thinking_content: String` 参数（`session.rs`）
- [x] 3.2 方法体内构造 `ContentBlock::Thinking` 并按正确顺序（thinking → text → tool_use）组装 content_blocks
- [x] 3.3 同步更新 `AgentEventEmitter` trait 中无影响的代码（仅签名检查，实际 trait 无需修改）

## 4. Agent Loop 集成

- [x] 4.1 `agent_loop` 中 `add_assistant_message` 调用处传入 `stream_result.thinking_content`

## 5. tool_result 批处理

- [x] 5.1 `AgentSession` 新增 `add_tool_results_batch` 方法，将所有 tool_result 合并到单条 user 消息
- [x] 5.2 `agent_loop` 收集所有工具执行结果后一次性调用 `add_tool_results_batch`
- [x] 5.3 确保 `agent_loop` 中 `add_assistant_message` 在前、`add_tool_results_batch` 在后（assistant → user 交替）

## 6. 验证

- [x] 6.1 验证 `ContentBlock::Thinking` 序列化为 `{"type": "thinking", "thinking": "..."}` 格式
- [x] 6.2 使用 DeepSeek Reasoner 模型进行多轮 agent 对话，确认不再出现 400 错误
- [x] 6.3 验证 thinking 内容正确出现在 `trace-prompt` 事件的 messages 中
- [x] 6.4 验证无 thinking 模式（deepseek-chat / claude 模型）下 `thinking_content` 为空字符串，不影响正常流程
- [x] 6.5 运行现有单元测试（66 passed），确保新增字段不破坏已有测试
- [x] 6.6 多工具并行场景下验证 tool_result 合并到单条 user 消息，API 不再报 tool_use/tool_result 不匹配
