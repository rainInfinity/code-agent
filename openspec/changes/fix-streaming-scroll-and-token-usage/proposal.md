## Why

流式输出过程中底部吸附跟随存在 bug：当用户在流式输出期间点击"滚动到底部"按钮后，smooth scroll 产生的 700ms 阻塞窗口会导致自动跟随失效；RAF 单帧锁在内容高速增长时跳过必要的滚动更新；markdown 渲染导致的高度跳变可能在 scrollTop 设置后被浏览器 layout 覆写。

此外，当前系统完全未捕获 LLM token 使用量信息。`AgentSession.token_usage` 字段定义了但从未被赋值；Anthropic API 的 `message_start.usage.input_tokens` 和 `message_delta.usage.output_tokens` 在 Rust 端解析后被静默丢弃；OpenAI provider 未请求 `stream_options.include_usage`。Trace 窗口缺少 Token 用量展示，用户无法评估每次调用的成本。

## What Changes

### 流式滚动修复

- **移除 tail/stable 分段渲染**：删除 `StreamingMessageContent` 组件、`splitStreamingContent`/`checkOpenCodeFence` 函数，流式和非流式状态统一使用 `MarkdownRenderer` 全量渲染。消除渲染模式边界，使内容高度随 `content.length` 线性增长，Zustand 签名自然跟踪
- **消除 smooth scroll 阻塞自动跟随**：`scrollToBottomInstant()` 在流式输出期间（`isStreaming === true`）忽略 `smoothScrollUntilRef` 阻塞
- **修复滚动签名捕获状态过渡**：`getStreamingScrollSignature` 在无 streaming 消息时返回过渡签名，确保 streaming→complete 切换时订阅触发
- **流式结束延迟强制滚动**：`isStreaming` 从 true→false 时，延迟 50ms 执行强制滚动，等待 SyntaxHighlighter DOM 稳定
- **RAF 双次滚动 + 重试标记**：RAF 回调中滚动后二次检查 scrollHeight，pending 时标记重试而非跳过

### Token 用量数据链路

- **Rust 后端 — ParseResult**：新增 `Usage { input_tokens: u32, output_tokens: u32 }` 变体
- **Rust 后端 — Anthropic/DeepSeek provider**：解析 `message_start.usage.input_tokens` 和 `message_delta.usage.output_tokens`，累积到 session
- **Rust 后端 — OpenAI provider**：请求 `stream_options.include_usage`，解析 usage chunk
- **Rust 后端 — llm.rs**：`stream_chat` / `stream_chat_with_tools` 回调中处理 Usage 变体，返回 TokenUsage
- **Rust 后端 — models.rs**：`StreamEndEvent` 和 `AgentCompleteEvent` 新增 `input_tokens`、`output_tokens` 字段
- **Rust 后端 — agent/runtime.rs**：`complete()` 传递 usage 到 AgentCompleteEvent
- **前端 TypeScript**：对应事件类型和 TurnTrace 新增 token 字段
- **Trace 窗口**：TurnCard 展示每 turn 的 token 用量

## Capabilities

### New Capabilities

- `token-usage-tracking`: LLM 响应的 token 用量采集全链路，从 Provider 解析 → Rust 事件 → 前端类型 → Trace 展示
- `streaming-scroll-fix`: 修复流式输出底部吸附的三个滚动 bug（smooth 阻塞、RAF 丢失、高度跳变）

### Modified Capabilities

- `streaming-render-performance`: 移除 tail/stable 分段渲染，统一全量 Markdown 渲染；滚动行为优化与现有的 RAF 节流/PlainCodeBlock 策略协同
- `agent-frontend`: 事件类型新增 token 字段

## Impact

### React Frontend
- `src/components/Chat/MessageList.tsx` — 移除 StreamingMessageContent、stableTick；统一 MarkdownRenderer；滚动五处修复
- `src/components/Chat/streamingMarkdown.ts` — 移除 splitStreamingContent/checkOpenCodeFence（如无其他引用则删除文件）
- `src/components/Chat/MarkdownRenderer.tsx` — 无需修改（已有 isStreaming 支持和 PlainCodeBlock）
- `src/types/index.ts` — StreamEndEvent/AgentCompleteEvent/TurnTrace 加 token 字段
- `src/components/Trace/TurnCard.tsx` — 展示 token 用量
- `src/stores/traceStore.ts` — 同步 token 数据到 turns

### Rust Backend
- `src-tauri/src/providers/mod.rs` — ParseResult 新增 Usage 变体
- `src-tauri/src/providers/anthropic.rs` — parse_stream_data 处理 MessageDelta/MessageStart 的 usage
- `src-tauri/src/providers/deepseek.rs` — 同上
- `src-tauri/src/providers/openai.rs` — 加 stream_options，解析 usage
- `src-tauri/src/llm.rs` — 流处理回调中收集 token 用量，返回 TokenUsage
- `src-tauri/src/models.rs` — StreamEvent 解析 usage，StreamEndEvent/AgentCompleteEvent 加字段，OpenAiStreamChunk 加 usage
- `src-tauri/src/agent/runtime.rs` — agent_loop/complete 传递 usage
- `src-tauri/src/agent/session.rs` — 更新 token_usage 字段赋值
- `src-tauri/src/commands.rs` — StreamEndEvent 携带 usage
