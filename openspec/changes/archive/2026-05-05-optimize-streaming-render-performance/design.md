# optimize-streaming-render-performance Design Document

## Context

当前流式渲染架构中，LLM 输出的每个 text delta 触发完整的状态更新 → 全量重渲染链路：

```
LLM delta (30+ 次/秒)
  → Tauri event → chatStore.appendToMessage()
  → Zustand set() → MessageList 全量重渲染
  → .map() 遍历所有消息 → ReactMarkdown + SyntaxHighlighter
```

`appendToMessage` 更新后，已完成消息保持相同的 JS 引用（`m.id !== messageId, return m`），但 `MessageList` 组件未利用此特性来跳过子组件的重渲染。

## Goals / Non-Goals

**Goals:**
- 流式输出期间，已完成的**历史消息 0 次重渲染**
- 流式消息重渲染频率从 ~30+ 次/秒降至 ~60fps 上限
- 流式输出中代码块不执行语法高亮，仅纯文本渲染
- 保持现有的自动滚动、复制、展开/折叠等交互行为不变

**Non-Goals:**
- 不引入虚拟列表（`react-virtuoso`）。冻结尾部架构独立于虚拟化，可作为后续优化
- 不修改 Rust 后端的 delta 发出策略
- 不改变 chatStore 的数据结构和持久化逻辑
- 不改变 Tauri 事件通信协议

## Decisions

### 1. 消息隔离：提取 MessageItem + 精确订阅

**Choice:** 将消息渲染从内联 `.map()` 提取为独立 `MessageItem` 组件，通过 Zustand 的精确 selector 订阅单条消息，配合 `React.memo` 实现跳过已完成消息的重渲染。

**Alternative:** 在 `MessageList` 层面使用 `useShallow` + selector 过滤。但 Zustand 的比较机制在数组层面无法利用单条消息的引用相等，因为顶层的 `conversations` 数组引用始终是新的。

**Implementation Notes:**
- `MessageList` 退化为只读取消息 ID 列表和基本元信息（id, role, status）
- `MessageItem` 通过 `useChatStore(s => s.conversations.find(...)?.messages.find(...)` 订阅精确消息
- `React.memo` 默认 `Object.is` 浅比较 —— 已完成消息引用不变 → 不重渲染
- 流式消息引用每次更新都是新对象 → 正常触发重渲染

### 2. Delta 节流：requestAnimationFrame 批量提交

**Choice:** 在 `useAgent.ts` 的 `onStreamDelta` 事件处理层引入 RAF 缓冲：收到 delta 时先累加到 `bufferRef`，已挂起的 RAF 不再注册新的，RAF 回调中一次性将缓冲内容提交到 `chatStore.appendToMessage`。

**Alternative:** 使用 `throttle`（固定时间间隔如 50ms）。但 RAF 的优势是与浏览器渲染周期同步，在非活跃标签页中自动降频。

**Implementation Notes:**
```
bufferRef += delta;
if (!rafPending) {
  rafPending = true;
  requestAnimationFrame(() => {
    chatStore.appendToMessage(convId, msgId, bufferRef);
    bufferRef = '';
    rafPending = false;
  });
}
```
- 同一 RAF 周期内的所有 delta 被合并为一次 Zustand 更新
- 结果：渲染从 30+ 次/秒降至 ≤60 次/秒

### 3. 流式内容分段渲染

**Choice:** 将流式消息的内容分为三个区域，分别采用不同的渲染策略：

```
┌─────────────────────────────────────┐
│ 稳定部分 (>200ms 未变)              │ → ReactMarkdown 正常渲染
├─────────────────────────────────────┤
│ 未闭合代码块                        │ → <pre><code> 纯文本，不高亮
├─────────────────────────────────────┤
│ 变化尾部 (最后 ~100 chars)          │ → 纯文本 <span>
└─────────────────────────────────────┘
```

**Alternative:** 整个流式消息都用纯文本渲染直到完成。收益最大但一致性差，用户看不到 markdown 格式化的渐进效果。

**Implementation Notes:**
- `STABLE_THRESHOLD_MS = 200`: 内容在该时间窗口内未变化视为稳定
- `TAIL_CHARS = 100`: 尾部保留的变更窗口大小
- 切割点选择最近的换行符，避免在单词中间切割
- 代码块闭合检测：统计 ``` 出现次数，奇数为未闭合

### 4. 代码块延迟高亮

**Choice:** 流式消息中，未闭合的代码块（``` 数量为奇数）跳过 `SyntaxHighlighter`，使用纯文本 `<pre><code>` 渲染。仅在 `status === 'complete'` 时启用完整语法高亮。

**Alternative:** 使用 `React.memo` 包裹 `CodeBlock`，通过 `code` 字符串比较跳过已闭合代码块的高亮重算。这可以配合方案使用，进一步优化已完成消息中的代码块。

**Implementation Notes:**
- `checkOpenFence(content)`: 统计 ``` 出现次数的奇偶性
- 消息 complete 时切换为完整渲染（含语法高亮），这是单次操作，无性能影响

## Risks / Trade-offs

### Risk: RAF 节流可能造成视觉上的"跳跃感"

**Mitigation:** RAF 节流将帧率绑定到 60fps（16ms 一帧），这在人类视觉感知范围内是平滑的。每次 delta 的字符量通常较小（3-10 chars），16ms 的合并不会产生可感知的延迟。

### Risk: 分段渲染的稳定阈值难以调优

**Mitigation:** 将 `STABLE_THRESHOLD_MS` 和 `TAIL_CHARS` 设为常量，方便后续调整。初始值基于常见 LLM 输出速率（30-50 tokens/s）估算，后续可根据实际体验微调。

### Risk: chatStore 的 `appendToMessage` 中已完成消息引用可能因结构调整而不保持相等

**Mitigation:** 当前代码已验证 `m.id !== messageId ? return m : ...` 模式确实返回原始引用。在 `MessageItem` 的 selector 中通过 `DeepPartial` 浅读取消息 ID 和内容字段进行比较，确保引用相等降级为值相等时也能正确判断。

## Open Questions

1. 哪些文件或 hooks 是否需要跟随尾部滚动更新（ResizeObserver、auto-follow 的 scrollToBottomInstant）做调整？
2. 是否需要将 delta 缓冲持久化到 chatStore（用于崩溃恢复），还是保持在 `useAgent` 层的内存中即可？
