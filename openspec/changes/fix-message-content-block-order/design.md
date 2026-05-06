## Context

当前消息渲染的数据流如下：Rust 后端通过 Tauri 事件（`thinking-delta`、`stream-delta`、`tool-trace`）向渲染进程推送内容块。前端 `useAgent.ts` 将这些事件分发到 Message 的不同字段：

- `thinking-delta` → `appendThinkingToMessage()` → 更新 `message.thinkingContent`
- `stream-delta` → `appendToMessage()` → 更新 `message.content` + `message.contentBlocks`（仅 text 块）
- `tool-trace` → `applyToolTraceToMessage()` → 更新 `message.toolTraces`、`message.toolCalls`、`message.toolResults`

渲染时 `MessageBodyContent` 分别从三个字段取值，硬编码顺序为 Thinking → Text → ToolTraces。由于 ToolTraces 总是排在 Text 之后，最终显示顺序与实际执行时间线不符。

`ContentBlock` 类型已定义（`text`、`thinking`、`tool_use`、`tool_result`），`message.contentBlocks` 也已存在，但仅在 `appendToMessage` 中被部分使用（仅 text 块），从未被用作渲染数据源。

## Goals / Non-Goals

**Goals:**
- 将 `message.contentBlocks` 作为消息渲染的唯一顺序数据源
- 确保 contentBlocks 中的块顺序反映事件到达的实际时间顺序
- 修正主窗口聊天区的工具调用与文本回复的显示顺序
- 修正 Rust 端 `build_assistant_content_blocks` 中的排序逻辑
- 向后兼容已持久化的旧格式消息

**Non-Goals:**
- 不改变工具卡片（ToolTraceBlocks）的组合交互样式（输入+输出+状态合并在单个卡片中）
- 不修改 Tauri 事件协议或新增事件类型
- 不改变 Trace 面板的渲染逻辑（Trace 面板的 TurnCard 顺序已正确）
- 不改变流式缓冲机制（`DeltaBuffer` 的 requestAnimationFrame 合并逻辑）

## Decisions

### 决策 1: 在事件处理层而非渲染层统一顺序

**选择：** 在 `chatStore.appendThinkingToMessage` 和 `applyToolTraceToMessage` 中同步追加 ContentBlock 到 `contentBlocks`

**原因：** 在数据写入时确定顺序更可靠。渲染层只需遍历 `contentBlocks` 即可，无需理解各块之间的时序关系。事件到达顺序天然正确，数据层忠实记录即可。

**备选方案：** 在渲染层对 `thinkingContent`、`content`、`toolTraces` 进行排序合并。放弃原因：需要推断各块的相对时间（但旧格式没有足够的时间戳信息），合并逻辑复杂且易出错。

### 决策 2: 流式块的更新策略

**选择：** 对于相同类型的连续流式块，就地更新最后一个块的内容，而非每次 delta 追加新块。

**实现：**
- `appendToMessage` 收到 text delta：如果 `contentBlocks` 最后一个块是 `text`，更新其 `text` 字段；否则追加新 `text` 块
- `appendThinkingToMessage` 收到 thinking delta：同上，更新或追加 `thinking` 块
- `tool-trace` 事件：总是追加新块（`tool_use` 或 `tool_result`），因为每个工具调用是独立事件

**原因：** 流式传输每秒产生数十个 delta 事件，每个都追加新块会导致 `contentBlocks` 迅速膨胀。就地更新保持数组简洁且渲染高效。

### 决策 3: tool_use 和 tool_result 在 contentBlocks 中的表示

**选择：** tool_use 和 tool_result 各自作为独立的 ContentBlock 插入，不在 contentBlocks 中合并。

**原因：** 它们在时间线上是独立事件（请求 → 等待 → 结果），分开表示时间精度更高。渲染时 tool_use 块查找 `message.toolTraces` 获取完整状态（running/completed/failed/output），展示组合卡片。

**备选方案：** 只在 contentBlocks 中插入 tool_use，tool_result 到达后更新 block 内的状态。放弃原因：需要扩展 ContentBlock 的 tool_use 类型（增加 output、error 字段），破坏类型简洁性。

### 决策 4: 向后兼容的迁移时机

**选择：** 在 `normalizePersistedConversations` 中执行迁移，即从 localStorage 反序列化后、注入 Zustand store 前。

**迁移逻辑：**
```
对每条旧消息（contentBlocks 为空或仅含 text 块，但 thinkingContent / toolTraces 非空）：
  1. 如果 thinkingContent 非空 → 在前面插入 thinking 块
  2. 遍历 toolTraces（按 logicalIndex 排序）：
     - 插入 tool_use 块
     - 如果已完成/失败 → 插入 tool_result 块
  3. 如果 content 非空 → 在最后追加 text 块
```

**原因：** 在数据进入 store 时统一格式，后续所有代码只需处理新格式。迁移是一次性开销。

### 决策 5: Rust 端顺序修正

**选择：** 将 `build_assistant_content_blocks` 中的顺序从 `Thinking → Text → ToolCalls` 改为 `Thinking → ToolCalls → Text`。

**原因：** 当 Assistant 响应同时包含文本和工具调用时（虽然 Anthropic API 通常不会同时返回），工具调用发生在文本之前。修正后与执行时序一致。

## Risks / Trade-offs

- **[风险] 流式过程中 contentBlocks 频繁更新导致渲染抖动** → 缓解：保留现有的 `DeltaBuffer` 和 `requestAnimationFrame` 合并机制，contentBlocks 更新与现有 content 更新频率一致
- **[风险] 迁移逻辑可能遗漏边界情况** → 缓解：迁移针对明确条件（contentBlocks 为空或仅含 text，且独立字段非空），其他情况跳过；同时保留独立字段不删除，作为回退数据源
- **[风险] ToolTraceBlocks 组件的 `<details>` 展开状态在重新渲染时丢失** → 缓解：ContentBlock 的 `tool_use` 块携带 `toolCallId`，组件按 `toolCallId` 做 key，React 保持 DOM 状态
- **[权衡] contentBlocks 同时存储 thinking/text/tool_use/tool_result，与独立字段存在数据冗余** → 接受：独立字段暂时保留（用于向后兼容和 Trace 面板），后续可逐步移除

## Migration Plan

1. **部署：** 前端新版本发布后，用户打开应用时自动执行 `normalizePersistedConversations` 迁移
2. **回滚：** 旧版本代码忽略新增的 thinking/tool_use/tool_result 块（只处理 text 块），独立字段仍存在，回滚后功能不受影响
3. **数据清理：** 两个版本周期后，可考虑移除独立字段（`thinkingContent`、`toolTraces`、`toolCalls`、`toolResults`）及迁移代码

## Open Questions

- 是否需要在本次变更中移除 Message 的独立字段（`thinkingContent`、`toolTraces`、`toolCalls`、`toolResults`），还是留给后续清理？建议先保留。
