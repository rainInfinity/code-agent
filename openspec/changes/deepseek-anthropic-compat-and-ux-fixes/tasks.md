# deepseek-anthropic-compat-and-ux-fixes 任务清单

## 1. DeepSeek → Anthropic 兼容端点 (Rust 后端)

- [x] 1.1 重写 `src-tauri/src/providers/deepseek.rs`：`chat_path` 返回 `"/v1/messages"`，`auth_header` 返回 `("x-api-key", api_key)`，`extra_headers` 返回 `[("anthropic-version", "2023-06-01")]`
- [x] 1.2 重写 `build_chat_request`：使用 `AnthropicRequest` 结构体构建请求（model、max_tokens、messages、stream、tools），与 `anthropic.rs` 保持一致
- [x] 1.3 重写 `parse_stream_data`：解析 `StreamEvent`（Anthropic SSE 格式），提取 `text_delta`、`tool_use` 事件、**特别提取 `thinking_delta`** 返回 `ParseResult::ThinkingDelta`
- [x] 1.4 重写 `parse_models_response`：使用 `ModelsResponse`（Anthropic 格式）解析模型列表，保留硬编码回退列表 `[deepseek-chat, deepseek-reasoner]`
- [x] 1.5 修改 `src-tauri/src/providers/mod.rs`：`ParseResult` 新增 `ThinkingDelta(String)` 变体；`default_endpoint("deepseek")` 改为 `"https://api.deepseek.com/anthropic"`
- [x] 1.6 在 `src-tauri/src/providers/mod.rs` 中更新 `built_in_provider_ids`：移除 `"openai"`，返回 `["anthropic", "deepseek"]`
- [x] 1.7 在 `src-tauri/src/providers/mod.rs` 中更新 `default_model("openai")` 和 `default_endpoint("openai")` 分支——保留但改为 unreachable（或直接删除这两个 match 分支）

## 2. Thinking 思考过程 — 后端事件流

- [x] 2.1 在 `src-tauri/src/models.rs` 中新增 `StreamThinkingEvent` 结构体（`conversation_id`、`message_id`、`delta`）
- [x] 2.2 修改 `src-tauri/src/llm.rs` 的 `stream_chat` 和 `stream_chat_with_tools` 方法：匹配 `ParseResult::ThinkingDelta`，通过 `app.emit("thinking-delta", ...)` 推送事件
- [x] 2.3 修改 `src-tauri/src/commands.rs` 的 `send_message` 和 `run_agent`：接收 `app` handle 并在流回调中发射 `thinking-delta` 事件

## 3. Thinking 思考过程 — 前端 UI

- [x] 3.1 在 `src/types/index.ts` 中新增 `StreamThinkingEvent` 接口
- [x] 3.2 在 `src/hooks/useIpc.ts` 中新增 `onThinkingDelta()` 监听器
- [x] 3.3 在 `src/stores/chatStore.ts` 中新增 `appendThinkingToMessage(conversationId, messageId, delta)` action，累积到 `Message.thinkingContent` 字段
- [x] 3.4 扩展 `Message` 接口新增 `thinkingContent?: string` 字段
- [x] 3.5 在 `src/hooks/useChat.ts` 中注册 `thinking-delta` 事件监听，调用 `chatStore.appendThinkingToMessage`
- [x] 3.6 在 `src/components/Chat/MessageList.tsx` 中新增 `ThinkingPanel` 组件：使用 `<details open>` + `<summary>` 实现可折叠面板，内部渲染 `thinkingContent` 纯文本，流式进行中时显示脉冲动画指示器

## 4. 隐藏 OpenAI 提供商

- [x] 4.1 修改 `src/config/providers.ts`：`PROVIDER_IDS` 从 `['anthropic', 'deepseek', 'openai']` 改为 `['anthropic', 'deepseek']`
- [x] 4.2 修改 `src/types/index.ts`：`ProviderId` 从 `'anthropic' | 'deepseek' | 'openai'` 改为 `'anthropic' | 'deepseek'`
- [x] 4.3 修改 `src/i18n/zh-CN.ts`：`providerOptions` 中删除 `openai: 'OpenAI'`
- [x] 4.4 修改 `src/components/common/SettingsModal.tsx`：删除 `SiOpenai` 导入和 `providerIcons` 中的 `openai` 映射；`ProviderRadioGroup` grid 从 3 列改为 2 列
- [x] 4.5 修改 `src/stores/settingsStore.ts`：`defaultApiKeyConfigured` 删除 `openai: false`

## 5. 修复底部模型显示 Bug

- [x] 5.1 修改 `src/components/Layout/StatusBar.tsx`：selector 从 `s.activeProviderSettings.model` 改为 `s.providers[s.activeProviderId]?.model ?? ''`，确保始终从单一数据源读取

## 6. 修复空白会话重复创建

- [x] 6.1 修改 `src/components/Layout/Sidebar.tsx` 的 `handleCreateConversation`：创建前检查当前活动会话 `messages.length === 0`，若为空则直接 return（已在空白会话中，无需新建）

## 7. 修复删除会话后跨模式错位

- [x] 7.1 修改 `src/stores/chatStore.ts` 的 `deleteConversation`：在 `activeConversationId` 回退逻辑中，使用 `selectedWorkDir` 过滤（code 模式下优先同目录的会话），避免跳到另一模式的会话
- [x] 7.2 修改 `src/components/Layout/Sidebar.tsx` 的 `DeleteButton onClick`：调用 `deleteConversation` 时传入当前 `agentMode` 和 `effectiveWorkDir` 作为过滤上下文

## 8. 依赖顺序

```
1 (DeepSeek 端点) ──→ 2 (Thinking 后端) ──→ 3 (Thinking 前端)
                         │
4 (隐藏 OpenAI) ─────────┤ (无依赖，可并行)
5 (模型显示 Bug) ────────┤ (无依赖，可并行)
6 (空白会话去重) ────────┤ (无依赖，可并行)
7 (跨模式会话) ──────────┘ (无依赖，可并行)
```

