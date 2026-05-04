# deepseek-anthropic-compat-and-ux-fixes 设计文档

## Context

当前有三个 LLM 提供商：Anthropic（原生 API）、DeepSeek（OpenAI 兼容格式）、OpenAI（标准格式）。DeepSeek 已推出 `https://api.deepseek.com/anthropic` 端点，兼容 Anthropic Messages API。迁移后可统一 DeepSeek 和 Anthropic 的流式解析逻辑，降低维护成本。

同时存在一批 UI/UX bug 需要修复，涉及会话管理、模型显示、思考过程展示。

关键约束：
- 不删除 OpenAI 后端代码和类型定义，仅从 UI 选择列表中隐藏
- DeepSeek 的 Anthropic 兼容端点需支持 `deepseek-chat` 和 `deepseek-reasoner` 两个模型
- 思考过程展示需跨全栈实现（Rust → Tauri Event → React），不能仅在前端 mock

## Goals / Non-Goals

**Goals:**
- DeepSeek 完全迁移到 Anthropic 兼容格式（请求构建 + 流式解析 + 模型列表）
- 从所有用户可见的提供商选择 UI 中移除 OpenAI
- 实现助手思考过程的端到端数据流和 UI 渲染
- 修复底部状态栏模型名称显示不同步问题
- 修复空白会话重复创建和跨模式会话错位问题

**Non-Goals:**
- 不删除 OpenAI 的 Rust 后端代码（`openai.rs` 保留但不再注册到 factory）
- 不修改 `redesign-settings-and-sidebar-layout` change 范围内的功能
- 不实现 thinking 模式的实际回落（thinking 内容目前仅来自 API 返回，不做本地推理）

## Decisions

### 1. DeepSeek 复用 Anthropic 流式解析

**选择:** 重写 `deepseek.rs`，使其 `build_chat_request` 和 `parse_stream_data` 采用与 `anthropic.rs` 相同的代码路径。基本是两个 provider 共享同一套逻辑，仅 `default_endpoint` 不同。

**理由:** DeepSeek 的 Anthropic 兼容端点使用相同的 Messages API 格式（`/v1/messages`、`x-api-key`、SSE `StreamEvent`）。不再需要 OpenAI 兼容的 `OpenAiChatRequest` 和 `OpenAiStreamChunk` 解析。

**实现要点:**
```rust
// deepseek.rs — 与 anthropic.rs 高度相似
impl LlmProvider for DeepSeekProvider {
    fn chat_path(&self) -> &str { "/v1/messages" }
    fn auth_header(&self, api_key: &str) -> (String, String) {
        ("x-api-key".to_string(), api_key.to_string())
    }
    fn extra_headers(&self) -> Vec<(String, String)> {
        vec![("anthropic-version".to_string(), "2023-06-01".to_string())]
    }
    fn build_chat_request(&self, model: &str, messages: &[ChatMessage]) -> serde_json::Value {
        // 与 AnthropicProvider 相同的 AnthropicRequest 格式
    }
    fn parse_stream_data(&self, data: &str) -> Result<Option<ParseResult>, String> {
        // 与 AnthropicProvider 相同的 StreamEvent 解析
        // 额外处理 thinking_delta
    }
}
```

### 2. 思考过程的数据流

**选择:** 新增 `ParseResult::ThinkingDelta(String)` 变体，在 `LlmClient` 流解析循环中匹配并推送。前端通过 `thinking-delta` Tauri event 接收，累积到 chatStore 中，由 `ThinkingPanel` 组件渲染。

**数据流:**
```
Anthropic SSE: content_block_delta { type: "thinking_delta", thinking: "..." }
  → parse_stream_data() → ParseResult::ThinkingDelta(text)
  → LlmClient 匹配 → emit "thinking-delta" event { conversationId, messageId, delta }
  → useAgent onThinkingDelta → chatStore.appendThinkingToMessage()
  → MessageList 渲染 <ThinkingPanel> 折叠面板
```

**事件 payload:**
```rust
// models.rs
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamThinkingEvent {
    pub conversation_id: String,
    pub message_id: String,
    pub delta: String,
}
```

**前端 store 扩展:**
```typescript
// chatStore.ts — Message 新增字段
interface Message {
  // ...existing...
  thinkingContent?: string;  // 累积的思考过程文本
}
```

**UI 决策:** 思考过程默认展开（用户刚接触时需要看到思考过程），可手动折叠。使用 `<details>` + `<summary>` 实现零 JS 折叠，内部为等宽字体的纯文本，带脉冲动画指示器表示"正在思考中"。

### 3. 模型显示 Bug 修复

**选择:** 修改 `StatusBar.tsx` 的 Zustand selector，直接从 `state.providers[state.activeProviderId]?.model` 取值，而非从 `state.activeProviderSettings.model` 取值。

**根因:** `activeProviderSettings` 是 `merge` 函数中从 `providers` 计算出来的快照值。当 `loadSettings` IPC 返回后 `setState` 更新 `providers` 时，如果未同步更新 `activeProviderSettings`，状态栏就显示过时数据。

**修复:**
```typescript
// StatusBar.tsx — Before
const model = useSettingsStore((s) => s.activeProviderSettings.model);

// After
const model = useSettingsStore((s) => s.providers[s.activeProviderId]?.model ?? '');
```

这确保了 model 始终从单一数据源（`providers` map）派生，不会出现引用过期问题。

### 4. 空白会话去重

**选择:** 在 `createConversation` 调用前（Sidebar 组件中）检查当前活动会话是否为空。

**实现:**
```typescript
// Sidebar.tsx handleCreateConversation
const handleCreateConversation = () => {
  // 去重：如果当前会话为空，直接切换到它
  const activeConv = conversations.find(c => c.id === activeConversationId);
  if (activeConv && activeConv.messages.length === 0) {
    return; // 已经在空白会话中
  }
  
  if (agentMode === 'code') {
    if (!effectiveWorkDir) return;
    createConversation(effectiveWorkDir);
  } else {
    createConversation();
  }
};
```

### 5. 跨模式会话选择修复

**选择:** `deleteConversation` 使用从 `Sidebar.filteredConversations` 相同的过滤逻辑选择下一个活动会话。

**实现:**
```typescript
// chatStore.ts — deleteConversation 增加 mode/workDir 参数
deleteConversation: (id: string, fallbackFilter?: { agentMode: AgentMode; workDir?: string }) =>
  set((state) => {
    const filtered = state.conversations.filter((c) => c.id !== id);
    
    let nextId: string | null = null;
    if (state.activeConversationId === id) {
      // 优先在同一过滤视图中选择
      if (fallbackFilter) {
        const modeFiltered = filtered.filter(c => 
          fallbackFilter.agentMode === 'code' 
            ? c.workDir === fallbackFilter.workDir 
            : true
        );
        nextId = modeFiltered[0]?.id ?? null;
      } else {
        nextId = filtered[0]?.id ?? null;
      }
    } else {
      nextId = state.activeConversationId;
    }
    
    return { conversations: filtered, activeConversationId: nextId };
  }),
```

## Risks / Trade-offs

### Risk: DeepSeek Anthropic 兼容端点可能缺少某些 Anthropic 特性

**缓解:** 降级策略——如果 DeepSeek 端点返回未知事件类型，`parse_stream_data` 会走 `_ => Ok(None)` 分支静默跳过，不影响正常流式输出。模型列表保留硬编码回退。

### Risk: 思考内容可能很长，影响阅读

**缓解:** 思考过程放在可折叠面板中，默认展开但用户可以收起。面板内部设置 `max-height` 和滚动。

### Risk: `StreamThinkingEvent` 是新 Tauri event，旧版前端不识别

**缓解:** 这是新增事件，不影响现有 `stream-delta`、`stream-end`、`stream-error` 事件的语义。旧版前端不监听此事件即可。

## Open Questions

1. **DeepSeek reasoner 模型的 thinking 输出格式**：`deepseek-reasoner` 在 Anthropic 兼容端点下，思考过程是否也以 `thinking_delta` 形式返回？还是用其他格式？需要实测验证。
2. **thinking 内容是否持久化**：思考过程是否需要像消息内容一样保存到 localStorage？当前设计是跟随消息持久化（新增 `thinkingContent` 字段到 Message 类型）。
