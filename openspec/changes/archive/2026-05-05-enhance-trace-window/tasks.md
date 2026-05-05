## 1. 类型定义 — Conversation 新增 turns 字段

- [x] 1.1 `src/types/index.ts`: Conversation 接口新增 `turns: TurnTrace[]` 字段
- [x] 1.2 `src/types/index.ts`: TraceState 新增 `isPinned: boolean` 和 `clearTurns(conversationId)` action

## 2. chatStore — persist 适配

- [x] 2.1 `src/stores/chatStore.ts`: `normalizePersistedConversations()` 添加 `turns` 默认值 `[]`
- [x] 2.2 `src/stores/chatStore.ts`: 新增 `appendTurn(conversationId, turn)` action
- [x] 2.3 `src/stores/chatStore.ts`: 新增 `updateLatestTurn(conversationId, updater)` action
- [x] 2.4 `src/stores/chatStore.ts`: 新增 `clearConversationTurns(conversationId)` action

## 3. traceStore — 重构为 chatStore 代理

- [x] 3.1 `src/stores/traceStore.ts`: 移除独立的 `turns` 数组，actions 改为读写 chatStore 当前对话的 turns
- [x] 3.2 `src/stores/traceStore.ts`: `startTurn` 改为通过 chatStore.appendTurn 操作当前对话
- [x] 3.3 `src/stores/traceStore.ts`: `addPrompt`/`startThinking`/`endThinking`/`appendThinking`/`appendResponse`/`endTurn` 改为通过 chatStore.updateLatestTurn 操作
- [x] 3.4 `src/stores/traceStore.ts`: `reset` 改为仅切换 conversationId（不清空数据）
- [x] 3.5 `src/stores/traceStore.ts`: 新增 `clearTurns` action（用户手动清除）
- [x] 3.6 `src/stores/traceStore.ts`: 新增 `isPinned` 状态和 `setPinned` action
- [x] 3.7 `src/stores/traceStore.ts`: 加载对话时从 chatStore 读取该对话的 turns 初始化

## 4. useTraceIpc — 适配新 traceStore

- [x] 4.1 `src/hooks/useTraceIpc.ts`: `onTraceConversationChanged` 改为切换 conversationId 并加载持久化 turns
- [x] 4.2 `src/hooks/useTraceIpc.ts`: 验证所有事件回调与新 traceStore actions 签名兼容

## 5. Trace 窗口 — Pin 按钮

- [x] 5.1 `src/components/Trace/TracePanel.tsx`: 标题栏最小化按钮左侧新增 pin 按钮
- [x] 5.2 Pin 按钮样式：激活态高亮（如主题色边框），未激活态默认色
- [x] 5.3 Pin 按钮点击：切换 `traceStore.isPinned`，emit 事件通知主窗口
- [x] 5.4 Pin 状态持久化：将 `isPinned` 存入 traceStore 并随窗口生命周期保持

## 6. 对话切换 — 自动关闭 Trace

- [x] 6.1 `src/components/Layout/StatusBar.tsx`: `useEffect([activeConversationId])` 中增加非 pin 模式下的自动 hide
- [x] 6.2 自动关闭逻辑：`if (!isPinned) { hideTraceWindow(); setConversationTraceEnabled(id, false); }`
- [x] 6.3 Pin 模式：切换对话时 emit 新 conversationId 到 Trace 窗口

## 7. 模块复制按钮

- [x] 7.1 `src/components/Trace/PromptView.tsx`: 新增复制按钮，复制系统提示 + 所有消息内容
- [x] 7.2 `src/components/Trace/ThinkingView.tsx`: 新增复制按钮，复制 thinking.content
- [x] 7.3 `src/components/Trace/ResponseView.tsx`: 新增复制按钮，复制 response.content
- [x] 7.4 复制按钮复用 MessageList 中的三态反馈模式（success/error/idle + 1.6s 重置）

## 8. Turn 时间信息展示

- [x] 8.1 `src/components/Trace/TurnCard.tsx`: Meta 区域展示格式化时间（startTime、耗时）
- [x] 8.2 时间格式化：复用 `formatThinkingDuration()` 模式（<1s→ms, <60s→s, ≥60s→m+s）
- [x] 8.3 流式进行中的 Turn：显示实时计时器（类似 ThinkingPanel 的 elapsed timer）

## 9. 清除 Trace 操作

- [x] 9.1 `src/components/Trace/TracePanel.tsx`: 标题栏或状态栏区域新增"清除"按钮
- [x] 9.2 清除按钮点击：调用 `traceStore.clearTurns(conversationId)`，清空当前对话的 turns
- [x] 9.3 清除确认：无需二次确认，直接清除（可在后续版本加 undo）

## 10. i18n

- [x] 10.1 `src/i18n/zh-CN.ts`: trace 命名空间新增 pin/pinTooltip/copyPrompt/copyThinking/copyResponse/copied/clearTrace/clearTraceTooltip/timePrefix 等文案

## 11. 验证

- [ ] 11.1 在对话 A 中运行 Agent，打开 Trace 窗口，验证 turns 正确记录
- [ ] 11.2 切换到对话 B → Trace 窗口自动关闭
- [ ] 11.3 切换回对话 A，打开 Trace → 之前记录的 turns 仍然存在
- [ ] 11.4 激活 Pin 按钮，切换对话 B → Trace 窗口保持打开，展示对话 B 的 turns
- [ ] 11.5 点击清除按钮 → 当前对话 turns 清空
- [ ] 11.6 验证 PromptView/ThinkingView/ResponseView 复制按钮功能
- [ ] 11.7 验证 TurnCard 时间信息正确展示
- [ ] 11.8 删除对话 A → trace 数据随对话一起清除
