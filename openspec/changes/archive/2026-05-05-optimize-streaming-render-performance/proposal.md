## Why

多轮对话中，LLM 流式输出的每个 text delta（约 10-30ms 一个）都会触发从 Tauri 事件 → Zustand 状态更新 → MessageList 全量重渲染的完整链路。随着对话历史增长，每次重渲染需要遍历所有消息（包括已完成的历史消息），重新执行 ReactMarkdown AST 解析和 SyntaxHighlighter 语法高亮，导致界面在流式输出阶段出现明显卡顿。

核心问题链：
1. `MessageList` 通过 `useChatStore()` 无 selector 订阅整个 store，任何变更都触发重渲染
2. `.map()` 遍历所有消息且无 `React.memo`，已完成的历史消息无法跳过重渲染
3. 每个重渲染周期都重新执行 `ReactMarkdown` markdown 解析和 `SyntaxHighlighter` Prism.js 语法高亮
4. 流式输出时消息内容不完整，代码块语法高亮不仅无效还极其昂贵
5. 无虚拟列表机制，长对话 DOM 节点数线性增长

## What Changes

- 引入"冻结尾部"（FrozenTail）架构：将消息列表分为已完成消息（冻结区）和流式消息（活跃区），只有活跃区参与渲染更新
- 提取 `MessageItem` 独立组件，通过 Zustand selector 精确订阅单条消息，配合 `React.memo` 利用对象引用相等跳过已完成消息的重渲染
- 在 delta 事件处理层引入 `requestAnimationFrame` 节流，将帧率绑定到 60fps，避免无效的中间态渲染
- 流式消息内容分段渲染：稳定部分正常 markdown 渲染，未闭合代码块延迟语法高亮，变化尾部纯文本渲染
- 流式输出期间，未闭合的代码块使用纯文本 `<pre><code>` 替代 `SyntaxHighlighter`，仅在消息完成后启用语法高亮

## Capabilities

### New Capabilities

- `streaming-render-performance`: 流式渲染性能优化，通过冻结尾部架构、delta 节流、分段渲染策略消除流式输出期间的界面卡顿

## Impact

### Rust Backend
- `src-tauri/src/agent/runtime.rs`: 无需修改，当前 delta 事件发出机制已满足需求

### React Frontend
- `src/components/Chat/MessageList.tsx`: 提取 `MessageItem` 组件、`FrozenTail` / `LiveTail` 分段、移除全量订阅
- `src/components/Chat/MarkdownRenderer.tsx`: 添加 `React.memo`、流式消息中延迟语法高亮逻辑
- `src/hooks/useAgent.ts`: delta 事件处理层加入 RAF 节流
- `src/stores/chatStore.ts`: 无需修改，当前精确更新模式已支持对象引用不变
