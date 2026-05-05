## Why

当对话或 Trace 历史变长后，首次进入时自动折叠历史内容仍然有明确的性能价值，但“每次切换会话都重新折叠”会破坏用户连续性：

- 用户刚刚手动展开过的内容，切走再回来又被重新折叠，状态不被尊重
- 同一个 conversation 在流式回复过程中可能越过阈值，如果再次自动折叠，会让刚刚还能看到的内容突然消失
- Trace 区和聊天区的行为不一致会进一步放大困惑

我们希望把自动折叠从“切换时重算”收敛为“首次加载时初始化一次”。这样既保留首屏性能保护，也让后续浏览更稳定、更符合预期。

## What Changes

- **修改** 自动折叠触发时机：聊天区 `MessageList` 和 Trace 区 `TracePanel` 仅在某个 conversation 首次加载到对应视图时计算默认折叠点
- **新增** 按 conversation 记忆的折叠 UI 状态：聊天区和 Trace 区分别维护自己的已初始化状态、可见轮次和展开结果
- **修改** 会话切换行为：切回已加载过的 conversation 时恢复此前折叠/展开状态，而不是重新按阈值折叠
- **修改** 流式更新行为：当新消息或新 turn 在流式过程中追加，哪怕总轮次或 token 估算首次越过阈值，也不再自动触发二次折叠
- **保留** 双阈值折叠算法、渐进式“加载更多”、`展开全部`、隐藏内容不进入 DOM 等既有能力

## Capabilities

### New Capabilities

- `conversation-scoped-fold-state`: 折叠状态按 conversation 维度维护，并在该 conversation 首次加载后保持，直到视图实例销毁或状态被显式清理

### Modified Capabilities

- `message-fold-control`: 自动折叠从“会话切换时重置”改为“首次加载时初始化一次，之后保持状态”
- `trace-fold-control`: Trace 自动折叠从“切换监控 conversation 时重置”改为“首次加载时初始化一次，之后保持状态”
- `chat-message-rendering`: 流式追加内容不得触发新的自动折叠
- `agent-trace-window`: 流式追加 turn 不得触发新的自动折叠

## Impact

- 前端状态管理：需要为聊天区和 Trace 区分别引入按 conversation 维度的折叠状态，而不是仅依赖组件本地 `useState`
- 首次加载判定：需要覆盖正常切换、持久化 hydration、Trace 初次同步等入口，确保“首次加载”只初始化一次
- 交互一致性：`加载更多` / `展开全部` 的结果需要在切换 conversation 后恢复
- 流式渲染：新消息和新 turn 必须始终保持可见，且不能因为阈值被跨越而让旧内容突然重新折叠
