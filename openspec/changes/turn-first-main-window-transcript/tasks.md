## 1. Canonical turn transcript plumbing

- [ ] 1.1 为共享 turn 模型补齐 `assistantMessageId` 与 turn-scoped transcript / lifecycle 所需字段
- [ ] 1.2 更新 `useAgent`、`useTraceIpc`、`chatStore` 与相关 IPC/类型定义，使新 turn 元数据在主窗口和 Trace 窗口中同步可用
- [ ] 1.3 停止把 message 级 `thinkingContent` / `thinkingStartedAt` 作为主窗口 thinking 状态的 canonical 来源

## 2. Main-window turn projection

- [ ] 2.1 实现从 canonical turns 派生 assistant message turn sections 的投影辅助逻辑
- [ ] 2.2 重构 `MessageList` / `MessageBodyContent` / `ThinkingPanel`，按 turn sections 渲染 thinking、tools 和 response
- [ ] 2.3 确保多 turn assistant 回复下的复制、折叠、滚动与 streaming 跟随行为保持稳定

## 3. Provider transcript generation

- [ ] 3.1 实现从 user messages + canonical turns 构建 provider-compatible transcript 的 builder
- [ ] 3.2 替换当前基于扁平 `contentBlocks` 的 prompt 历史组装路径，保留合法 `tool_use -> tool_result` 邻接关系
- [ ] 3.3 清理或收敛仅服务于旧 prompt 组装路径的过滤逻辑，避免再次误删必需 `tool_result` blocks

## 4. Migration and compatibility

- [ ] 4.1 在 `normalizePersistedConversations` 中为 legacy conversations 增加 turn-first 兼容归一化逻辑
- [ ] 4.2 为无法精确恢复多 turn 边界的历史会话提供可读的 fallback turn 视图
- [ ] 4.3 保留必要 legacy 字段与回退路径，确保发布后可安全回滚

## 5. Verification

- [ ] 5.1 补充前端测试，覆盖多 turn thinking 独立状态、duration、cursor 与 turn section 渲染顺序
- [ ] 5.2 补充 transcript / prompt 组装测试，验证多轮工具调用后 `tool_use -> tool_result` 邻接关系仍合法
- [ ] 5.3 补充历史会话迁移测试，验证 legacy 数据可读且继续对话不会触发 provider 400 错误
- [ ] 5.4 进行主窗口与 Trace 窗口联动验证，确认两者对同一 turn 完成态保持一致
