## Context

当前 MessageList 和 TracePanel 在收到完整 `messages[]` / `turns[]` 后，无条件将所有条目映射为 React 组件。当对话累积 50+ 轮次时，单次渲染即产生 100+ 个 `MessageItem`（含嵌入式 MarkdownRenderer + SyntaxHighlighter）或 50+ 个 `TurnCard`（含 PromptView / ThinkingView / ResponseView）。DOM 节点数量与协调开销随轮次线性增长，会话切换时 JS 主线程长时间阻塞，直观表现为点击侧边栏后 UI 冻结。

现有优化（React.memo、delta batching、分段渲染）针对的是流式输出过程中的渲染效率，不解决会话切换时的大批量组件挂载问题。

## Goals / Non-Goals

**Goals:**
- 会话切换时仅渲染最近 N 轮（默认 10 轮）或 token 预算内的消息，取更严格者
- 折叠的消息/回合不创建 React 元素、不进入 DOM
- 用户可渐进式加载更多（每次 5 轮）或展开全部
- 流式接收期间保持折叠状态不变
- 折叠状态为组件本地状态，会话切换时自动重置
- 主窗口 MessageList 和 Trace 窗口 TracePanel 共享折叠算法核心，各自独立配置阈值
- 为未来上下文压缩预留统一的折叠点计算逻辑

**Non-Goals:**
- 不实现虚拟滚动（另行考虑，与折叠互补而非替代）
- 不修改 Zustand store 的消息存储结构
- 不修改后端 Rust 代码
- 不在用户设置界面暴露折叠阈值配置
- 不实现折叠消息的 LLM 摘要压缩（后续变更）

## Decisions

### Decision 1: 折叠算法提取为独立工具函数

选用独立 `foldUtils.ts` 模块，导出纯函数 `computeMessageFoldPoint` 和 `computeTurnFoldPoint`，分别接受 `Message[]` 和 `TurnTrace[]`。

**理由：** 两种数据结构不同（Message 需要先识别 user 消息作为 turn 边界；TurnTrace 本身即为 turn），但算法骨架相同（从后向前遍历，累加 turn 计数和 token 估算，双阈值触发停止）。独立函数便于单元测试，且后续上下文压缩可直接复用折叠点计算。

**替代方案：** 合并为单一 hook 内部逻辑。不选，因为数据结构的差异会导致 hook 内部充满条件分支，不如在函数签名层面区分清晰。

### Decision 2: 折叠状态使用组件本地 `useState`，不持久化

```typescript
// useMessageFold hook 内部
const [visibleTurnCount, setVisibleTurnCount] = useState(defaultVisibleTurnCount);
```

折叠展开的轮次计数由 `useState` 管理，会话切换时因组件 props 变化而自然重置（useEffect 监听 conversationId 变化重新计算初始值）。

**理由：** 折叠是 UI 渲染优化，不属于领域状态。每次切换会话时应重新折叠（用户查看历史是有意操作），持久化折叠状态反而造成困惑。

**替代方案：** 放入 chatStore。不选，增加 store 复杂度且需要处理跨会话折叠状态迁移。

### Decision 3: 折叠点基于"消息轮次"（user 消息出现次数），而非 trace 系统定义的"代理轮次"

消息轮次 = 一次 `send()` 调用产生的 user message + assistant message。折叠的判断依据是 user 消息的数量和内容长度。

**理由：** 用户理解"对话轮次"，不关心后端 agent loop 内部迭代了几次。且 MessageList 只关心 Message[]，不感知 TurnTrace。

### Decision 4: Token 估算采用字符比例法 `content.length / CHARS_PER_TOKEN`

```typescript
const estimateTokens = (text: string): number =>
  Math.ceil(text.length / CHARS_PER_TOKEN);
// CHARS_PER_TOKEN = 4 → 英文约每 4 字符 1 token，中文约每 1-2 字符 1 token
```

**理由：** 折叠判断对精度要求低，只需要数量级正确。`content.length * 0.25` 在现有代码中已用于思考面板 token 显示，保持一致的估算方式。引入 tiktoken 级精确计算对渲染决策无额外价值。

### Decision 5: FoldDivider 作为独立通用组件，不区分主窗口/Trace 窗口

```typescript
<FoldDivider
  foldedTurnCount={15}
  estimatedTokens={3200}
  onLoadMore={() => loadMore(5)}
  onExpandAll={expandAll}
/>
```

组件仅负责渲染，所有文案通过 i18n 获取。行为和阈值由父组件通过 props 和回调控制。

**理由：** 主窗口和 Trace 窗口的折叠分割线 UI 形态一致，复用减少重复代码。

### Decision 6: 折叠消息不渲染到 DOM 的实现方式

在 `MessageList` 渲染循环中直接切片：

```typescript
const { visibleMessages, foldInfo } = useMessageFold(messages, conversationId, thresholds);

return (
  <>
    {foldInfo.isFolded && <FoldDivider ... />}
    {visibleMessages.map(msg => <MessageItem key={msg.id} ... />)}
  </>
);
```

`visibleMessages` 是一个 `Message[]` 切片引用（来自 `useMemo`），只包含折叠点之后的消息。折叠的消息不会经过 `.map()` 迭代，自然不会创建任何 `MessageItem` 组件。

**理由：** 这是"不渲染"的最直接实现——从数据源头排除。不需要 CSS 技巧，不需要条件渲染 null，切片天然排除。

### Decision 7: 加载更多时保持滚动位置

使用 `useLayoutEffect` 在加载更多操作前后捕获并恢复滚动位置：

```typescript
const loadMore = useCallback(() => {
  const el = listRef.current;
  const beforeHeight = el?.scrollHeight ?? 0;
  const beforeScrollTop = el?.scrollTop ?? 0;
  
  setVisibleTurnCount(prev => prev + LOAD_MORE_TURNS);
  
  // useLayoutEffect after DOM update:
  // el.scrollTop = beforeScrollTop + (newScrollHeight - beforeHeight);
}, []);
```

**理由：** 在已渲染内容上方插入新 DOM 节点会导致内容向下推移。用户点击"加载更多"时期望看到更多历史内容出现在上方，而当前视口位置保持稳定。

## Risks / Trade-offs

**[风险] 折叠分割线的滚动位置恢复可能在不同浏览器/平台有轻微抖动**
→ 缓解：`useLayoutEffect` 在 DOM 更新后同步执行，现代浏览器均支持。如有抖动，可增加 `scroll-behavior: auto` 强制同步滚动。

**[风险] 用户可能不理解折叠机制，误以为历史消息丢失**
→ 缓解：折叠分割线明确标注轮次数量和 token 估算值，提供醒目的加载按钮。不自动折叠不足阈值的短对话。

**[取舍] 折叠的消息不在 DOM 中，浏览器的文本搜索 (Ctrl+F) 无法找到被折叠的内容**
→ 取舍：这是"不渲染到 DOM"的必然结果。用户需要展开后搜索。可后续考虑增加对话内搜索功能。

**[取舍] 会话切换时 scrollToBottom 行为与折叠的交互**
→ 取合：当前的 `scrollToBottomInstant` 基于 `scrollHeight`，折叠后 scrollHeight 减小，滚动到底部的逻辑不受影响。已验证现有代码使用 `el.scrollTop = el.scrollHeight`，折叠减少 scrollHeight 后行为仍然正确。

**[边界] 边缘情况——消息为空或只有一条消息**
→ 折叠算法应在 turn 计数未达到阈值时返回"不折叠"，`foldInfo.isFolded = false`，FoldDivider 不渲染。

## Open Questions

- 在首次实现中，是否需要"折叠区摘要"（如显示被折叠轮次的对话主题列表）？当前设计仅显示轮次计数和 token 估算，简洁但信息密度低。可后续迭代。
