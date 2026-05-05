## Why

当对话会话积累大量轮次（如 50+ 轮）和长内容（含大量代码块和 Markdown）后，会话切换时全量渲染所有消息导致明显的 UI 卡顿。当前架构将所有 Message / TurnTrace 无条件映射为 React 组件并挂载到 DOM，SyntaxHighlighter 和 MarkdownRenderer 的累积开销成为性能瓶颈。通过引入双阈值折叠机制，历史消息在切换时默认不渲染，仅在用户主动触发时渐进式加载，从根本上减少 DOM 节点数和 React 协调开销。同时为后续上下文压缩预留折叠点计算逻辑。

## What Changes

- **新增** 消息/回合折叠算法：基于双阈值（轮次数量 + token 估算长度）计算折叠点，两条阈值取更严格者
- **新增** `FoldDivider` 组件：在折叠边界展示分割线和渐进式加载控制（每次加载 5 轮 + 展开全部）
- **新增** `useMessageFold` hook：为 MessageList 提供折叠状态管理，维护可见消息切片和展开控制
- **新增** `useTurnFold` hook：为 TracePanel 提供折叠状态管理，维护可见回合切片和展开控制
- **修改** `MessageList`：集成折叠逻辑，仅渲染可见范围内的 MessageItem，折叠消息完全不创建 React 元素
- **修改** `TracePanel`：集成折叠逻辑，仅渲染可见范围内的 TurnCard，折叠回合完全不创建 React 元素
- 折叠阈值作为模块级常量独立配置（主窗口和 Trace 窗口各自维护），不进入用户设置界面
- 折叠状态为组件本地状态，会话切换时重置；流式接收期间保持折叠状态不变

## Capabilities

### New Capabilities

- `message-fold-control`: 消息列表折叠机制——双阈值（轮次 + token 估算）触发折叠，渐进式加载（每次 5 轮），折叠的消息不渲染到 DOM
- `trace-fold-control`: Trace 窗口回合折叠机制——与消息折叠共享算法核心，独立配置阈值常量，TurnCard 按相同逻辑折叠

### Modified Capabilities

- `chat-message-rendering`: 新增折叠行为——MessageList 仅渲染折叠点之后的消息，折叠点之前的消息不创建 MessageItem 组件
- `agent-trace-window`: 新增折叠行为——TurnList 仅渲染折叠点之后的回合，折叠点之前的回合不创建 TurnCard 组件

## Impact

- 前端组件：`src/components/Chat/MessageList.tsx`、`src/components/Trace/TracePanel.tsx`
- 新增模块：`src/hooks/useMessageFold.ts`、`src/components/Chat/FoldDivider.tsx`、`src/utils/foldUtils.ts`
- 状态管理：Zustand store 不受影响，折叠的消息仍保留在 store 中用于构建 LLM 上下文
- 滚动系统：折叠分割线插入后需确保自动滚动和"回到底部"按钮行为正确
- 不影响后端（Rust/Tauri），纯前端渲染层优化
