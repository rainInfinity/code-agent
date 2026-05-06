## Why

主窗口聊天区中，工具调用和对话回复的展示顺序不符合 Agent 实际执行的时间线：文本回复总是渲染在工具调用之前，而实际上工具调用和执行发生在最终文本回复生成之前。这误导用户对 Agent 行为的理解，影响使用体验。同时，消息内容分散存储在 Message 的多个字段（`thinkingContent`、`content`、`toolTraces`）中，渲染时各自取值硬编码顺序，导致逻辑不一致。

## What Changes

- **将 `contentBlocks` 提升为消息内容的唯一渲染数据源**：`thinking-delta`、`stream-delta`、`tool-trace` 等事件到达时，同步追加对应类型的 ContentBlock 到 `contentBlocks` 数组
- **修正 MessageBodyContent 渲染逻辑**：从分别渲染 `thinkingContent` → `content` → `toolTraces` 的硬编码顺序，改为遍历 `contentBlocks` 按事件到达时间顺序渲染
- **修正 Rust 端 `build_assistant_content_blocks` 排序**：将 Thinking → Text → ToolCalls 修正为 Thinking → ToolCalls → Text
- **向后兼容**：`normalizePersistedConversations` 中为旧消息从独立字段重建 `contentBlocks`
- **保持现有工具卡片交互**：`ToolTraceBlocks` 的组合卡片（输入+输出+状态）样式保持不变，通过 `contentBlocks` 中的 tool 标记确定渲染位置

## Capabilities

### New Capabilities

- `content-block-unified-rendering`: 将 `contentBlocks` 作为消息渲染的唯一数据源，确保所有内容块（thinking、tool_use、tool_result、text）严格按照事件到达时间顺序渲染

### Modified Capabilities

- `chat-message-rendering`: 修正工具过程块的排序要求——工具过程块 SHALL 在时间线上位于文本回复之前，渲染顺序 SHALL 基于 contentBlocks 的插入时间而非组件硬编码
- `content-block-messages`: 修正 ContentBlock 的语义——assistant 消息中的 ToolUse 块 SHALL 在 Text 块之前（因为工具调用发生在文本响应之前）

## Impact

- **前端**：`chatStore.ts`（`appendThinkingToMessage`）、`traceUtils.ts`（`applyToolTraceToMessage`）、`MessageList.tsx`（`MessageBodyContent`）、`ToolTraceBlocks.tsx`
- **后端**：`session.rs`（`build_assistant_content_blocks` 及对应测试）
- **持久化**：`normalizePersistedConversations` 需要迁移逻辑
- **无破坏性变更**：现有消息通过迁移兼容，API 和事件协议不变
