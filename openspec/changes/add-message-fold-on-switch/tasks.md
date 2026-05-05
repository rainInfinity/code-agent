## 1. 语义调整

- [x] 1.1 更新聊天区折叠语义：从“切换 conversation 时重置”改为“conversation 首次加载时初始化一次”
- [x] 1.2 更新 Trace 区折叠语义：从“切换监控 conversation 时重置”改为“conversation 首次加载时初始化一次”
- [x] 1.3 明确“流式新增内容即使越过阈值也不自动再次折叠”的规则，并同步到 proposal / design / specs

## 2. 聊天区状态模型

- [x] 2.1 将 `useMessageFold` 的状态从组件局部瞬时值调整为按 conversation 记忆的 fold state
- [x] 2.2 定义聊天区首次加载判定，覆盖正常切换与持久化 hydration 场景
- [x] 2.3 确保切回已加载过的 conversation 时恢复此前 `visibleTurnCount`

## 3. Trace 区状态模型

- [x] 3.1 将 `useTurnFold` 的状态从组件局部瞬时值调整为按 conversation 记忆的 fold state
- [x] 3.2 定义 Trace 区首次加载判定，覆盖 URL 初始化、主窗口同步、IPC hydration 场景
- [x] 3.3 确保切回已加载过的 Trace conversation 时恢复此前 `visibleTurnCount`

## 4. 流式稳定性

- [x] 4.1 聊天区在 streaming 过程中保持既有折叠边界，不因轮次或 token 超阈值而重新折叠
- [x] 4.2 Trace 区在 running / streaming 过程中保持既有折叠边界，不因新增 turn 超阈值而重新折叠
- [x] 4.3 验证最新消息和最新 turn 始终位于可见区域

## 5. 用户交互保持

- [x] 5.1 `加载更多` 后切换离开再回来，聊天区保持展开结果
- [x] 5.2 `展开全部` 后切换离开再回来，聊天区保持展开结果
- [x] 5.3 `加载更多` / `展开全部` 后切换离开再回来，Trace 区保持展开结果

## 6. 验证

- [x] 6.1 验证长对话首次加载时会自动折叠
- [x] 6.2 验证同一 conversation 再次进入时不会被重新按默认阈值折叠
- [x] 6.3 验证首次加载时未超阈值、后续因流式新增而超阈值，也不会突然自动折叠
- [x] 6.4 验证折叠内容仍然不进入 DOM，且不影响发送给 LLM 的完整上下文
- [x] 6.5 验证 Trace 区与聊天区在上述行为上保持一致
