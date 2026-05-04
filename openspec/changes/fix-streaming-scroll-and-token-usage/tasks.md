## 1. Rust — ParseResult 扩展

- [x] 1.1 `src-tauri/src/providers/mod.rs`: ParseResult 枚举新增 `Usage { input_tokens: u32, output_tokens: u32 }` 变体

## 2. Rust — Anthropic provider token 解析

- [x] 2.1 `src-tauri/src/providers/anthropic.rs`: `parse_stream_data` 中处理 `StreamEvent::MessageStart`，提取 `message.usage.input_tokens`，返回 `ParseResult::Usage { input_tokens, output_tokens: 0 }`
- [x] 2.2 `src-tauri/src/providers/anthropic.rs`: `parse_stream_data` 中处理 `StreamEvent::MessageDelta`，提取 `usage.output_tokens`，返回 `ParseResult::Usage { input_tokens: 0, output_tokens }`

## 3. Rust — DeepSeek provider token 解析

- [x] 3.1 `src-tauri/src/providers/deepseek.rs`: 同 Anthropic，处理 MessageStart 和 MessageDelta 的 usage（DeepSeek 使用与 Anthropic 兼容的事件格式）

## 4. Rust — OpenAI provider token 解析

- [x] 4.1 `src-tauri/src/providers/openai.rs`: `build_chat_request` 中请求体新增 `stream_options: { include_usage: true }`
- [x] 4.2 `src-tauri/src/models.rs`: `OpenAiStreamChunk` 新增 `usage: Option<serde_json::Value>` 字段
- [x] 4.3 `src-tauri/src/providers/openai.rs`: `parse_stream_data` 中检测 usage chunk（choices 为空且 usage 存在），返回 `ParseResult::Usage`

## 5. Rust — llm.rs 收集 token 用量

- [x] 5.1 `src-tauri/src/llm.rs`: `stream_chat()` 函数签名新增 `on_usage` 回调参数（或返回 TokenUsage 结构体）
- [x] 5.2 `src-tauri/src/llm.rs`: 流循环中匹配 `ParseResult::Usage`，累积 `final_input_tokens`（取最大值，message_start 为准）和 `final_output_tokens`（取 message_delta 的值）
- [x] 5.3 `src-tauri/src/llm.rs`: `stream_chat_with_tools()` 同样处理 Usage 变体

## 6. Rust — 事件类型更新

- [x] 6.1 `src-tauri/src/models.rs`: `StreamEndEvent` 新增 `input_tokens: u32` 和 `output_tokens: u32` 字段
- [x] 6.2 `src-tauri/src/models.rs`: `AgentCompleteEvent` 新增 `input_tokens: u32` 和 `output_tokens: u32` 字段

## 7. Rust — agent/runtime.rs 传递 token

- [x] 7.1 `src-tauri/src/agent/runtime.rs`: `agent_loop()` 中收集 token 用量，传递给 `complete()` 和 `AgentCompleteEvent`
- [x] 7.2 `src-tauri/src/agent/session.rs`: 更新 `token_usage` 字段赋值（累积总 token）

## 8. Rust — commands.rs 传递 token

- [x] 8.1 `src-tauri/src/commands.rs`: `send_message()` 中 `StreamEndEvent` 携带 token 用量

## 9. 前端 — TypeScript 类型更新

- [x] 9.1 `src/types/index.ts`: `StreamEndEvent` 新增 `inputTokens: number`、`outputTokens: number`
- [x] 9.2 `src/types/index.ts`: `AgentCompleteEvent` 新增 `inputTokens: number`、`outputTokens: number`
- [x] 9.3 `src/types/index.ts`: `TurnTrace` 新增 `usage?: { inputTokens: number; outputTokens: number }` 字段

## 10. 前端 — 事件处理适配

- [x] 10.1 `src/hooks/useAgent.ts`: `onStreamEnd` 回调中将 token 数据存入对应 Message（可选：在 Message 上加 usage 字段）
- [x] 10.2 `src/hooks/useTraceIpc.ts`: `onAgentComplete` 回调中将 token 数据存入当前 TurnTrace

## 11. 前端 — Token 展示

- [x] 11.1 `src/components/Trace/TurnCard.tsx`: Meta 区域新增 token 用量展示，格式 `↑1.2k ↓0.5k`
- [x] 11.2 Token 数量格式化：>1000 用 "k" 后缀，保留 1 位小数

## 12. 前端 — 移除 tail/stable 分段渲染

- [x] 12.1 `src/components/Chat/streamingMarkdown.ts`: 移除 `splitStreamingContent`、`checkOpenCodeFence`、`STABLE_THRESHOLD_MS`、`TAIL_CHARS`（如无其他引用）
- [x] 12.2 `src/components/Chat/MessageList.tsx`: 移除 `StreamingMessageContent` 组件定义
- [x] 12.3 `src/components/Chat/MessageList.tsx`: `MessageBodyContent` 中流式和非流式状态统一使用 `<MarkdownRenderer content={content} isStreaming={status === "streaming"} />`
- [x] 12.4 `src/components/Chat/MessageList.tsx`: 移除 `stableTick` 状态和 200ms 定时器逻辑
- [x] 12.5 `src/components/Chat/MessageList.tsx`: 移除 `StreamingTail` styled component 和相关 import

## 13. 前端 — 滚动修复

- [x] 13.1 `src/components/Chat/MessageList.tsx`: `scrollToBottomInstant` 在 `isStreaming === true` 时跳过 `smoothScrollUntilRef` 阻塞
- [x] 13.2 `src/components/Chat/MessageList.tsx`: `syncScrollInFrame` 新增 `needsFollowUpScrollRef`，pending 时标记重试而非跳过
- [x] 13.3 `src/components/Chat/MessageList.tsx`: RAF 回调中执行双次滚动检查（滚动后检测 scrollHeight 是否变化，如有变化再滚动一次）
- [x] 13.4 `src/components/Chat/MessageList.tsx`: `getStreamingScrollSignature` 在无 streaming 消息时返回 `"completed:<lastMessageId>"` 过渡签名，确保 Zustand 订阅捕获 streaming→complete 状态变更
- [x] 13.5 `src/components/Chat/MessageList.tsx`: `isStreaming` 从 `true→false` 过渡时，延迟 50ms 执行 `syncScrollInFrame(true)`，等待 SyntaxHighlighter DOM 稳定

## 14. i18n

- [x] 14.1 `src/i18n/zh-CN.ts`: 新增 token 相关文案（如 `trace.inputTokens`、`trace.outputTokens`、`trace.tokensK`）

## 15. 验证

- [ ] 15.1 发送消息，在流式输出过程中点击"回到底部"按钮 → 验证自动跟随不被阻断
- [ ] 15.2 高速流式输出（长代码块生成）→ 验证始终吸附底部，无"掉队"现象
- [ ] 15.3 流式输出中包含代码块 → 验证代码块渲染时底部跟随正常，无滚动条抖动
- [ ] 15.4 流式输出结束后 → 验证 PlainCodeBlock→SyntaxHighlighter 切换后页面保持在底部
- [ ] 15.5 使用 Anthropic provider 发送消息 → 验证 StreamEndEvent 包含 inputTokens 和 outputTokens
- [ ] 15.6 使用 DeepSeek provider 发送消息 → 同上验证
- [ ] 15.7 使用 Agent 模式（多 Turn）→ 验证 AgentCompleteEvent 包含 token 数据
- [ ] 15.8 打开 Trace 窗口 → 验证 TurnCard 展示 token 用量信息
- [ ] 15.9 验证已有对话的正常滚动和流式输出不受影响（回归测试）
