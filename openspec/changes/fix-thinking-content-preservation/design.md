## Context

当前消息流转中，thinking 内容仅在 stream 处理时通过 `on_thinking_delta` 回调转发给 Trace UI 显示，不参与消息存储和后续 API 请求的构造。

```
Turn 1: LLM stream 返回
  ├── text_delta      → 累积到 full_content ✓
  ├── thinking_delta  → 仅发 Trace 事件，丢弃 ✗
  └── tool_use        → 存入 tool_calls ✓

Turn 1 结束时:
  ChatMessage {
    role: "assistant",
    content_blocks: [
      Text { text: "..." },        ← 只有文本
      ToolUse { ... }              ← 工具调用
      // ❌ 缺少 Thinking 块
    ]
  }

Turn 2: 发送历史消息 → API 400: "thinking must be passed back"
```

目标数据流：

```
Turn 1: LLM stream 返回
  ├── text_delta      → 累积到 full_content ✓
  ├── thinking_delta  → 累积到 thinking_content ✓ (新增)
  └── tool_use        → 存入 tool_calls ✓

Turn 1 结束时:
  ChatMessage {
    role: "assistant",
    content_blocks: [
      Thinking { thinking: "..." },  ← 新增
      Text { text: "..." },
      ToolUse { ... }
    ]
  }

Turn 2: 发送历史消息 → API 接受 ✓
```

## Goals / Non-Goals

**Goals:**
- `ContentBlock` 枚举新增 `Thinking` 变体，正确序列化为 Anthropic API 格式
- `stream_chat_with_tools` 流处理中累积 thinking 内容
- `LlmStreamResult` 返回 thinking 内容
- `add_assistant_message` 支持传入 thinking content 并构造 Thinking 块
- 确保 Anthropic 和 DeepSeek 两个 provider 都能正确序列化 Thinking 块

**Non-Goals:**
- 不修改前端 Trace UI（thinking 事件的 emit 逻辑不变）
- 不修改 user message 的内容块结构（thinking 只出现在 assistant 消息中）
- 不处理 OpenAI provider 的 thinking（OpenAI 的推理格式不同，暂不涉及）
- 不修改 `stream_chat`（无工具版本），因为我们不使用它进行 agent 对话

## Decisions

### 1. ContentBlock::Thinking 的序列化格式

**选择**：新增变体 `Thinking { thinking: String }`，利用现有 `#[serde(tag = "type", rename_all = "snake_case")]` 属性自动序列化。

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlock {
    Text { text: String },
    Thinking { thinking: String },        // 新增
    ToolUse { id: String, name: String, input: serde_json::Value },
    ToolResult { tool_use_id: String, content: String, is_error: Option<bool> },
}
```

序列化结果：`{"type": "thinking", "thinking": "..."}` — 符合 Anthropic API 格式。

**理由**：Anthropic/DeepSeek API 中 thinking 块的 type 为 `"thinking"`，字段名为 `"thinking"`。直接复用 serde 的 tag 重命名规则即可，无需自定义序列化。

### 2. LlmStreamResult 扩展

**选择**：新增 `thinking_content: String` 字段。

```rust
pub struct LlmStreamResult {
    pub full_content: String,      // text 内容
    pub thinking_content: String,  // 新增：thinking 内容
    pub usage: TokenUsage,
}
```

**理由**：最简单的方式。备选方案（如 `Option<String>`）会增加不必要的调用方分支判断，即使没有 thinking 内容也应该是空字符串。

### 3. thinking 内容收集位置

**选择**：在 `stream_chat_with_tools` 的流处理循环中，`ParseResult::ThinkingDelta` 分支添加累积逻辑。

```rust
let mut thinking_content = String::new();  // 新增

// 在 stream 处理中:
Ok(Some(ParseResult::ThinkingDelta(delta))) => {
    thinking_content.push_str(&delta);       // 新增：累积
    on_thinking_delta(delta);                // 保留：Trace UI
}
```

**理由**：最小侵入。`ThinkingDelta` 处理分支已存在，只需增加一行累积逻辑。已有的 `on_thinking_delta` 回调保持不变，Trace UI 不受影响。

### 4. add_assistant_message 签名修改

**选择**：新增 `thinking_content: String` 参数。

```rust
// 旧签名
fn add_assistant_message(&mut self, content: String, tool_calls: Vec<ContentBlock>)

// 新签名
fn add_assistant_message(
    &mut self,
    content: String,
    thinking_content: String,      // 新增
    tool_calls: Vec<ContentBlock>,
)
```

消息构造顺序（thinking 在前，遵循 Anthropic API content block 顺序约定）：

```rust
let mut content_blocks = Vec::new();
if !thinking_content.is_empty() {
    content_blocks.push(ContentBlock::Thinking {
        thinking: thinking_content,
    });
}
if !content.is_empty() {
    content_blocks.push(ContentBlock::Text { text: content });
}
content_blocks.extend(tool_calls);
```

**理由**：Anthropic API 要求 content blocks 的顺序为 `thinking → text → tool_use`。作为必选参数（而非 Option）可以简化调用方逻辑——传空字符串表示无 thinking 内容。

### 5. agent_loop 中的集成

**选择**：在 `agent_loop` 中，从 `stream_result.thinking_content` 提取值并传递给 `add_assistant_message`。

```rust
session.add_assistant_message(
    stream_result.full_content,
    stream_result.thinking_content,  // 新增
    tool_blocks,
);
```

**理由**：改动最小，单行新增。LlmClient 返回 thinking 内容后，agent_loop 直接转发。

### 6. Provider 序列化 — 无需修改

**选择**：不变更 `build_chat_request` 中的消息序列化逻辑。

`AnthropicProvider` 和 `DeepSeekProvider` 都使用：
```rust
serde_json::to_value(blocks).unwrap_or(...)
```

新增的 `ContentBlock::Thinking` 变体会被 serde 自动序列化为正确的 API 格式 `{"type": "thinking", "thinking": "..."}`，无需额外修改。

**理由**：serde 的 tag-based 枚举序列化已经正确处理了所有变体，Thinking 变体的序列化格式与 Anthropic API 完全一致。

## Risks / Trade-offs

- **[低] 消息体积增加**：thinking 内容可能较长（几 KB），存储到消息历史中会增大每轮 API 请求的 payload。但这是 DeepSeek API 的硬性要求，无法绕过。
- **[低] Anthropic API 兼容性**：Anthropic 的 extended thinking 功能也使用 thinking 块。如果未来切换到 Anthropic 的 extended thinking，相同的机制可以复用。
- **[低] 序列化兼容性**：`Thinking` 变体反序列化时，如果消息历史中包含旧格式（无 thinking），`serde` 会尝试匹配其他变体或报错。实际上反序列化路径仅用于测试，运行时 messages 来自代码构造，不受影响。

### 7. tool_result 批处理（附加修复）

**问题**：`agent_loop` 逐个调用 `add_tool_result`，每个 tool_result 独占一条 user 消息。当 assistant 消息中有多个 `tool_use` 块时，API 要求所有 `tool_result` 在紧接的下一条 user 消息中——拆成多条消息会导致 API 400 错误。

```
当前（错误）:
  msg[3]: assistant { tool_use_1, tool_use_2, ..., tool_use_7 }
  msg[4]: user { tool_result_1 }     ← API 期望全部 7 个结果在这里
  msg[5]: user { tool_result_2 }     ← API 报错: call_02~07 无对应结果
  ...

修复后:
  msg[3]: assistant { tool_use_1, tool_use_2, ..., tool_use_7 }
  msg[4]: user { tool_result_1, tool_result_2, ..., tool_result_7 }  ← 单条消息
```

**选择**：新增 `add_tool_results_batch` 方法，接收 `Vec<(String, &ToolResult)>`，构造单条含多个 `ToolResult` 块的 user 消息。`agent_loop` 先收集所有结果到 `Vec` 中，循环结束后调用一次 batch 方法。

```rust
// session.rs 新增方法
pub fn add_tool_results_batch(&mut self, results: Vec<(String, &ToolResult)>) {
    let blocks: Vec<ContentBlock> = results
        .into_iter()
        .map(|(tool_use_id, result)| {
            let content = result.error.clone().unwrap_or_else(|| result.output.clone());
            ContentBlock::ToolResult { tool_use_id, content, is_error: Some(!result.success) }
        })
        .collect();
    self.messages.push(ChatMessage {
        role: "user".to_string(),
        content: String::new(),
        content_blocks: Some(blocks),
    });
}
```

**理由**：保留原有 `add_tool_result` 单条方法（供未来单工具场景使用），新增 batch 方法用于 agent loop。`agent_loop` 改动仅涉及循环体——将 `zip(results.into_iter())` 改为 `zip(results.iter())` 收集引用后统一调用 batch。
