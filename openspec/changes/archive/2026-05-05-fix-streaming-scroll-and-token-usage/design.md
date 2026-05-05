## Context

流式输出的滚动系统有三层触发：Zustand 订阅（content 长度签名变化）、ResizeObserver（DOM 高度变化）、onScroll 事件（用户或程序化滚动）。当前实现存在三个缺陷导致底部吸附失效。

Token 用量数据链路在 Rust 后端有完整的事件结构定义（`StreamEvent::MessageStart` 含 `message.usage`，`StreamEvent::MessageDelta` 含 `usage`），但在 `parse_stream_data` 中被 `_ => Ok(None)` 丢弃。`ParseResult` 枚举没有 `Usage` 变体来承载这些数据。`AgentSession.token_usage: usize` 字段定义了但从未被赋值。

## Goals / Non-Goals

**Goals:**
- 修复流式输出期间底部吸附跟随的三个已知 bug
- 打通从 Provider → Rust → TypeScript 的 token 用量全链路
- Trace 窗口 TurnCard 展示每 turn 的 input/output token 数量

**Non-Goals:**
- 完整重构滚动系统（仅做针对性修复）
- Token 计费/成本计算
- Token 用量历史统计图表

## Decisions

### Decision 1: 流式期间 smooth scroll 不阻塞自动跟随

**问题**: `scrollToBottom()` 设置 `smoothScrollUntilRef = Date.now() + 700`，期间 `scrollToBottomInstant()` 对非 force 调用直接返回。用户点击"回到底部"后，700ms 内自动跟随失效。

**修复**: `scrollToBottomInstant()` 在 `isStreaming === true` 时忽略 `smoothScrollUntilRef` 阻塞。

```typescript
const scrollToBottomInstant = useCallback((force = false) => {
    // 流式输出期间不受 smooth scroll 阻塞，保持自动跟随
    if (!force && !isStreaming && Date.now() < smoothScrollUntilRef.current) {
      return;
    }
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [isStreaming]);
```

### Decision 2: 移除 tail/stable 分段，全量 Markdown 直接渲染

**问题**: `StreamingMessageContent` 将流式内容分为 stable（Markdown 渲染）和 tail（纯文本）。每 200ms 的 tail→stable 迁移造成渲染模式边界——纯文本突然变为 h1/code block/paragraph 等 Markdown DOM，高度跳变不伴随 `content.length` 变化，Zustand 滚动签名无法跟踪。这是滚动抖动和底部吸附失效的根因。

**方案**: 移除 `StreamingMessageContent` 组件及 `splitStreamingContent`/`checkOpenCodeFence` 逻辑，在流式和非流式状态下统一使用 `MarkdownRenderer`。

**理由**:
- Markdown 源码和渲染后 DOM 的高度天然不同，分段机制人为制造渲染模式切换
- 全量 Markdown 渲染使高度随 `content.length` 线性增长，Zustand 签名自然跟踪每个 delta
- `react-markdown` 能正确处理未闭合代码块（吞入 code block 作为纯文本）
- `MarkdownRenderer` 已有 `isStreaming` prop 控制 `PlainCodeBlock` vs `SyntaxHighlighter`
- 移除分段逻辑净减少代码量，消除 `stableTick` 定时器和 tail 字符串切割

**唯一剩余的高度跳变**: 流式结束时 `PlainCodeBlock` → `SyntaxHighlighter` 切换。但这是单次跳变（而非每 200ms），且仅影响代码块部分（纯文本部分高度不变）。由 Decision 3 处理。

### Decision 3: 流式结束延迟强制滚动

**问题**: 流式结束时，`MarkdownRenderer` 从 `isStreaming=true` 切换为 `isStreaming=false`，代码块从 `PlainCodeBlock` 变为 `SyntaxHighlighter`。这是唯一剩余的高度跳变。同时，`getStreamingScrollSignature` 在无 streaming 消息时返回 `""`，`if (nextSignature && ...)` 导致 Zustand 订阅不触发。

**修复**:
1. `getStreamingScrollSignature` 在最后一条消息非 streaming 时返回 `"completed:<messageId>"`，确保订阅触发
2. `isStreaming` 从 `true→false` 时，延迟 50ms 后执行 `syncScrollInFrame(true)`，等待 SyntaxHighlighter DOM 稳定

### Decision 4: RAF 回调内双次滚动

**问题**: `syncScrollInFrame()` 的单帧锁 `if (scrollFrameRef.current !== null) return` 导致同一帧内后续触发被忽略。在内容高速增长时，RAF 回调只滚动到当时的 scrollHeight，可能落后于同时到达的新内容。

**修复**: RAF 回调中，滚动后再检查一次当前 scrollHeight，如不同则再滚动一次。同时移除单帧锁，改为在 pending 时设置重试标记。

```typescript
const syncScrollInFrame = useCallback((force = false) => {
    if (scrollFrameRef.current !== null) {
      needsFollowUpScrollRef.current = true;
      return;
    }
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      if (force || autoFollowRef.current) {
        scrollToBottomInstant(force);
        const laterHeight = listRef.current?.scrollHeight ?? 0;
        if (listRef.current && listRef.current.scrollTop < laterHeight - 10) {
          scrollToBottomInstant(true);
        }
      }
      if (needsFollowUpScrollRef.current) {
        needsFollowUpScrollRef.current = false;
        syncScrollInFrame();
      }
      updateScrollAffordance();
    });
  }, [scrollToBottomInstant, updateScrollAffordance]);
```

### Decision 5: Token 用量数据链路

**Rust 端 ParseResult 扩展**:
```rust
pub enum ParseResult {
    TextDelta(String),
    ThinkingDelta(String),
    ToolUseStart { index: usize, id: String, name: String },
    ToolUseDelta { index: usize, input_json_delta: String },
    ToolUseComplete { index: usize },
    Usage { input_tokens: u32, output_tokens: u32 },  // NEW
}
```

**Anthropic/DeepSeek provider 处理**:
```rust
// 在 parse_stream_data 中新增
StreamEvent::MessageStart { message } => {
    let input_tokens = message["usage"]["input_tokens"].as_u64().unwrap_or(0) as u32;
    // 暂存到 self 的临时字段，等待 message_delta 的 output_tokens
    Ok(Some(ParseResult::Usage { input_tokens, output_tokens: 0 }))
}
StreamEvent::MessageDelta { delta: _, usage } => {
    let output_tokens = usage
        .and_then(|u| u["output_tokens"].as_u64())
        .unwrap_or(0) as u32;
    Ok(Some(ParseResult::Usage { input_tokens: 0, output_tokens }))
}
```

注意：`message_start` 和 `message_delta` 中的 usage 需要合并。在 Anthropic API 中，`message_start.usage.output_tokens` 通常为 1（占位），真实值在 `message_delta.usage.output_tokens`。所以最终使用：
- `input_tokens`: 来自 `message_start.usage.input_tokens`
- `output_tokens`: 来自 `message_delta.usage.output_tokens`

**llm.rs 收集逻辑**: 在 `stream_chat_with_tools()` 的流循环中，累积 Usage 变体：`final_input_tokens` 取最大的一次（message_start 的值），`final_output_tokens` 取 message_delta 的值。流结束时通过回调或返回值传出。

**OpenAI provider**:
```rust
// build_chat_request 中
"stream_options": { "include_usage": true }
```
```rust
// OpenAiStreamChunk 中新增字段
pub usage: Option<serde_json::Value>,
```
```rust
// parse 逻辑中检测 usage chunk（choices 为空且有 usage）
if chunk.choices.is_empty() && chunk.usage.is_some() {
    let usage = chunk.usage.unwrap();
    return Ok(Some(ParseResult::Usage {
        input_tokens: usage["prompt_tokens"].as_u64().unwrap_or(0) as u32,
        output_tokens: usage["completion_tokens"].as_u64().unwrap_or(0) as u32,
    }));
}
```

**事件类型更新**:
```typescript
// StreamEndEvent
interface StreamEndEvent {
  conversationId: string;
  messageId: string;
  fullContent: string;
  inputTokens: number;   // NEW
  outputTokens: number;  // NEW
}

// AgentCompleteEvent
interface AgentCompleteEvent {
  // ... existing fields
  inputTokens: number;   // NEW
  outputTokens: number;  // NEW
}

// TurnTrace
interface TurnTrace {
  // ... existing fields
  usage?: {              // NEW
    inputTokens: number;
    outputTokens: number;
  };
}
```

**前端收集**: `useAgent.ts` 的 `onStreamEnd` 回调中将 token 数据存入 Message。`useTraceIpc.ts` 的 `onAgentComplete` 回调中将 token 数据存入当前 TurnTrace。

### Decision 6: Trace 窗口 token 展示

**选择**: TurnCard 头部 Meta 区域展示 token 用量：

```
Turn 1 · 完成 · 2.3s · ↑1.2k ↓0.5k
```

使用 `↑` 表示 input tokens，`↓` 表示 output tokens。简化显示：>1000 用 "k" 后缀。

## Risks / Trade-offs

- **全量 Markdown 渲染性能**: 每个 delta 触发完整 markdown 解析（而非仅 tail 追加）。→ 已被 RAF delta 批处理（每 16ms 一次）和 `React.memo`（content 同则跳过）缓解。实测中单次 `< 500 行` 的 markdown 解析 < 1ms。
- **双次滚动增加 RAF 回调复杂度**: 需要性能测试确保不影响流式渲染帧率。→ 一次 RAF 内的两次 scrollTop 赋值非常轻量，不会有可感知的性能影响。
- **Token 数据来源差异**: Anthropic 的 usage 在两个事件中分开到达（input 在 message_start，output 在 message_delta），OpenAI 的 usage 在一个 chunk 中。需要在 provider 层做归一化处理。
- **MessageStart 解析破坏性**: `StreamEvent::MessageStart { message: serde_json::Value }` 当前未使用，新增解析不会破坏现有逻辑。
- **OpenAI stream_options 兼容性**: `include_usage` 是 OpenAI 标准 streaming 参数，所有兼容 API（包括 DeepSeek 的 OpenAI 模式）都支持。但如果用户使用不支持此参数的自定义 endpoint，usage 数据将为空（降级处理，不影响正常 chat 功能）。

## Open Questions

无。关键技术决策已在上文确定。
