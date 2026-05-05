## 1. 基础设施

- [x] 1.1 创建 `src/utils/foldUtils.ts` — 实现 `estimateTokens()` 估算函数和 `computeMessageFoldPoint()` 算法（接受 Message[]，通过 user 消息识别轮次，双阈值判断返回折叠点索引）
- [x] 1.2 创建 `src/config/foldConfig.ts` — 提取主窗口 `CHAT_FOLD_CONFIG` 和 Trace 窗口 `TRACE_FOLD_CONFIG` 常量（MAX_VISIBLE_TURNS, TOKEN_BUDGET, LOAD_MORE_TURNS, CHARS_PER_TOKEN）
- [x] 1.3 在 `src/i18n/locales/zh-CN.ts` 中添加折叠相关文案 key（`fold.divider.title`、`fold.divider.tokenInfo`、`fold.divider.loadMore`、`fold.divider.expandAll`）

## 2. FoldDivider 组件

- [x] 2.1 创建 `src/components/Chat/FoldDivider.tsx` — 实现折叠分割线 UI，包含折叠轮次统计、token 估算显示、"加载最近 N 轮"按钮和"展开全部"按钮
- [x] 2.2 FoldDivider 所有文案通过 i18n 获取，按钮点击回调通过 props 传入（`onLoadMore`、`onExpandAll`）

## 3. 折叠 Hook

- [x] 3.1 创建 `src/hooks/useMessageFold.ts` — 实现主窗口消息折叠 hook：从 chatStore 读取完整 messages，调用 `computeMessageFoldPoint` 计算初始折叠点，通过 `useState` 管理 `visibleTurnCount`，暴露 `visibleMessages`、`foldInfo`、`loadMore()`、`expandAll()`
- [x] 3.2 创建 `src/hooks/useTurnFold.ts` — 实现 Trace 窗口回合折叠 hook：从 chatStore 读取完整 turns，调用 `computeTurnFoldPoint` 计算初始折叠点，通过 `useState` 管理 `visibleTurnCount`，暴露 `visibleTurns`、`foldInfo`、`loadMore()`、`expandAll()`
- [x] 3.3 两个 hook 在 `conversationId` 变化时通过 `useEffect` 自动重置折叠状态

## 4. MessageList 集成

- [x] 4.1 在 `MessageList.tsx` 中引入 `useMessageFold`，将 `visibleMessages` 替代 `messages.map()` 作为渲染数据源
- [x] 4.2 在可见消息列表顶部渲染 `FoldDivider`（当 `foldInfo.isFolded` 为 true 时）
- [x] 4.3 处理加载更多时的滚动位置保持：捕获加载前 scrollHeight 和 scrollTop，`useLayoutEffect` 恢复视口位置

## 5. TracePanel 集成

- [x] 5.1 在 `TracePanel.tsx` 中引入 `useTurnFold`，将 `visibleTurns` 替代 `turns.map()` 作为 TurnCard 渲染数据源
- [x] 5.2 在可见回合列表顶部渲染 `FoldDivider`（当 `foldInfo.isFolded` 为 true 时）
- [x] 5.3 处理加载更多时的滚动位置保持（复用与 MessageList 相同的策略）

## 6. 验证与边缘情况

- [x] 6.1 验证短对话（不足阈值）不显示折叠分割线，全部消息正常渲染
- [x] 6.2 验证长对话切换时折叠生效，DOM 中不存在折叠消息的元素
- [x] 6.3 验证"加载更多"渐进展开正确：每次加载 5 轮，剩余不足一批时展开全部并隐藏分割线
- [x] 6.4 验证"展开全部"后分割线消失，所有消息可见
- [x] 6.5 验证流式接收期间折叠状态持续保持
- [x] 6.6 验证会话切换时折叠状态重置
- [x] 6.7 验证折叠不影响发送消息时的上下文构建（完整 messages[] 仍发送给 LLM）
- [x] 6.8 验证 Trace 窗口中回合折叠行为与主窗口一致
