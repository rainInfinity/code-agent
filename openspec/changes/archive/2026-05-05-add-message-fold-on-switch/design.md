## Context

当前折叠实现把“默认折叠点”当成一次临时计算：

- `useMessageFold` / `useTurnFold` 在读取到 `messages[]` / `turns[]` 后计算默认折叠点
- 组件本地 `useState` 记录 `visibleTurnCount`
- 当 `conversationId` 改变时，`useEffect` 直接把 `visibleTurnCount` 重置为新的默认值

这带来两个问题：

1. 用户一旦切走再回来，之前手动展开的结果会丢失
2. “首次加载”和“后续数据更新”没有被明确区分，Trace hydration、主窗口同步、流式新增内容都可能和折叠初始化时机交织在一起

本次变更要把折叠语义改成：

```text
某个 conversation 在某个视图中首次建立折叠状态
  -> 按双阈值算法计算一次默认折叠
之后该 conversation 再次出现
  -> 恢复已记住的折叠状态
后续流式追加内容
  -> 只追加可见尾部，不重新自动折叠历史
```

## Goals / Non-Goals

**Goals:**

- 聊天区和 Trace 区都只在 conversation 首次加载时自动折叠一次
- 已加载过的 conversation 在切换回来时恢复此前折叠状态
- 流式回复、新增消息、新增 turn 即使让总量越过阈值，也不重新自动折叠
- 最新消息 / 最新 turn 始终保持在可见区域
- 保持现有双阈值算法、隐藏内容不渲染到 DOM、渐进式加载和滚动恢复能力

**Non-Goals:**

- 不新增“重新折叠”按钮或用户设置项
- 不把折叠状态持久化为跨应用重启的长期偏好
- 不修改后端上下文压缩或 LLM 消息裁剪逻辑
- 不实现折叠摘要或虚拟列表

## Decisions

### Decision 1: 折叠状态改为按 conversation 记忆，而不是按组件实例瞬时保存

聊天区和 Trace 区都需要维护各自独立的 conversation-scoped fold state。该状态至少包含：

- `initialized`: 该 conversation 是否已经完成过首次折叠初始化
- `visibleTurnCount`: 当前可见轮次/回合数
- 派生出的 `foldStartIndex` / `isFolded` 可继续通过算法计算

**理由：**

- 只有按 conversation 记忆，才能在切换回来时恢复用户之前的展开状态
- 聊天区和 Trace 区需要彼此独立，避免“在聊天区展开全部”影响 Trace，反之亦然

### Decision 2: “首次加载”以首次建立状态为准，不以 `conversationId` 变化为准

首次加载的定义是：某个视图第一次遇到“还没有折叠状态记录”的 conversation。

这意味着：

- 正常切换到一个从未看过的 conversation 时，会初始化一次
- 如果组件先挂载空数组、后续再由 hydration 或 IPC 同步补齐消息/turns，也应在首次可用数据到达时完成初始化
- 已经初始化过的 conversation 即使再次切换回来，也不得再次重算默认折叠点

**理由：**

- 这样才能覆盖 Trace 窗口的 URL 参数初始化、主窗口同步、持久化恢复等非单一路径
- “首次加载”不再依赖组件 mount 顺序或 effect 时序

### Decision 3: 双阈值算法只用于默认值，不用于后续自动回退

`computeMessageFoldPoint` / `computeTurnFoldPoint` 仍然保留，但职责收敛为：

- 在 conversation 首次初始化时计算默认 `visibleTurnCount`
- 在需要根据当前 `visibleTurnCount` 推导可见切片时继续复用算法

不会再发生：

- 因 `messages.length` 增长而自动减少 `visibleTurnCount`
- 因 token 估算越过预算而把原本可见的内容重新折回历史区

**理由：**

- 阈值是初始化策略，不是持续干预策略
- 用户一旦已经看见某段内容，系统不应在没有显式操作的情况下把它收回去

### Decision 4: 用户交互结果写回记忆状态

以下行为都要更新 conversation-scoped fold state：

- 点击 `加载更多`
- 点击 `展开全部`
- 首次加载后保持默认折叠不动

因此切走再回来时：

- 之前展开过更多内容，就恢复更多内容
- 之前已经展开全部，就保持全部展开
- 之前从未操作过，就保持首次初始化出来的默认折叠结果

### Decision 5: 流式新增内容永远追加到可见尾部

当 conversation 已经初始化后：

- 新 user / assistant 消息追加到聊天区尾部时，历史折叠边界保持不变
- 新 Trace turn 追加到 Trace 区尾部时，历史折叠边界保持不变
- 即使 conversation 现在第一次越过 `MAX_VISIBLE_TURNS` 或 `TOKEN_BUDGET`，也不得自动新增隐藏历史

可以把它理解为：

```text
首次折叠决定“从哪里开始看历史”
之后所有流式内容都只是在“当前可见尾部”继续长出来
```

### Decision 6: 状态生命周期限定在视图会话内

本次只要求折叠状态在当前视图会话内保持：

- 主聊天区：在主窗口存活期间按 conversation 保持
- Trace 区：在 Trace 视图实例存活期间按 conversation 保持

不要求：

- 应用重启后保留折叠展开结果
- Trace 窗口完全关闭并重建后仍恢复旧的折叠展开结果

**理由：**

- 先解决“切换回来又折起来”和“流式时突然折叠”这两个直接可感知的问题
- 避免把本次变更扩大为新的跨窗口持久化设计

## Risks / Trade-offs

**[Trade-off] 初次加载后短对话变成长对话，也不会自动折叠**

这是一项有意选择。它牺牲了少量持续最优渲染效率，换取用户可预期性。用户已经看到的内容不应被系统突然收走。

**[Risk] conversation-scoped state 需要清理**

如果对话被删除或 Trace 目标会话失效，相关折叠状态应一起清理，避免无主状态持续增长。

**[Risk] 首次加载与 hydration 的竞态**

如果首次初始化早于真实数据到达，可能把空数组当成已初始化状态。实现时需要以“已有状态记录”而不是“hook 已经跑过一次”来判定首次加载是否完成。

## Open Questions

- 是否需要在未来支持“手动重新折叠到默认值”操作？本次先不包含
- 是否需要把 Trace 的折叠状态提升到跨窗口可恢复的层级？本次先不包含
