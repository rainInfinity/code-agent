## MODIFIED Requirements

### Requirement: Manual Trace Clear

清除 Trace 操作 SHALL 仅由用户主动触发，系统 SHALL NOT 自动清空任何对话的 turns。清除操作 SHALL 设置 `turnsCleared` 标记以防止 normalize 过程从 messages 重建 turns。

#### Scenario: 用户手动清除 Trace

- **GIVEN** 对话 A 的 Trace 窗口打开，有 3 条 TurnTrace
- **WHEN** 用户点击"清除 Trace"按钮
- **THEN** 对话 A 的 `conversation.turns` SHALL 变为空数组
- **AND** 对话 A 的 `turnsCleared` SHALL 设置为 `true`
- **AND** Trace 窗口 SHALL 显示空状态

#### Scenario: 清除后主窗口不回推同步

- **GIVEN** 用户已在 Trace 窗口清除对话 A 的 Trace 历史
- **WHEN** 主窗口收到 `trace-clear-conversation` 事件
- **THEN** 主窗口 SHALL 调用本地 `clearConversationTurns`
- **AND** 主窗口 SHALL NOT emit `trace-sync-conversations` 回推

#### Scenario: 切换对话不清空 Trace

- **GIVEN** 对话 A 有 3 条 TurnTrace
- **WHEN** 用户切换到对话 B
- **THEN** 对话 A 的 `conversation.turns` SHALL 保持 3 条记录不变

### Requirement: Normalize Persisted Trace Data

持久化数据加载时，`turns` 字段 SHALL 被规范化为默认值 `[]`（若缺失或为 undefined）。当 `turns` 为空数组且 `turnsCleared` 为 `true` 时，normalize SHALL NOT 从 messages 重建 fallback turns。

#### Scenario: 旧版本数据迁移（无 turns 字段）

- **GIVEN** localStorage 中存在旧版本持久化的对话数据（无 `turns` 字段）
- **WHEN** 应用启动并 rehydrate chatStore
- **THEN** 所有对话的 `turns` SHALL 被规范化为 `[]`

#### Scenario: 已清除的 turns 不被重建

- **GIVEN** 对话 A 的 `turns` 为空数组且 `turnsCleared` 为 `true`
- **AND** 对话 A 有 2 条 assistant messages
- **WHEN** `normalizeConversationTurns` 被调用
- **THEN** 对话 A 的 turns SHALL 保持为空数组
- **AND** SHALL NOT 从 assistant messages 生成 fallback turns

#### Scenario: 清除后重启应用 turns 保持为空

- **GIVEN** 用户已在上次会话中清除对话 A 的 turns
- **WHEN** 应用重新启动并 rehydrate chatStore
- **THEN** 对话 A 的 `turns` SHALL 保持为空数组
- **AND** Trace 窗口打开对话 A 时 SHALL 显示空状态

## ADDED Requirements

### Requirement: turnsCleared 标记

Conversation 类型 SHALL 包含 `turnsCleared?: boolean` 字段。当 `clearConversationTurns` 被调用时，系统 SHALL 将目标 conversation 的 `turnsCleared` 设置为 `true`。`turnsCleared` 标记 SHALL 随 conversation 持久化。

#### Scenario: 清除时设置标记

- **GIVEN** 对话 A 有 3 条 turns
- **WHEN** `clearConversationTurns("A")` 被调用
- **THEN** 对话 A 的 `turnsCleared` SHALL 为 `true`

#### Scenario: 新建 conversation 无 turnsCleared 标记

- **GIVEN** 用户创建新对话
- **WHEN** conversation 被创建
- **THEN** `turnsCleared` SHALL 为 `undefined` 或不存在

#### Scenario: 清除后运行 Agent 重置 turnsCleared

- **GIVEN** 对话 A 的 `turnsCleared` 为 `true`
- **WHEN** 用户在对话 A 中运行 Agent 产生新的 turn
- **THEN** 对话 A 的 `turnsCleared` SHALL 被重置为 `false` 或移除
