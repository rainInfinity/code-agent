# trace-persistence Specification

## ADDED Requirements

### Requirement: Trace Data Per-Conversation Binding

Trace 数据 SHALL 按对话 ID 绑定，存储在 `Conversation.turns` 字段中。每次 Agent Turn 产生的新 trace 记录 SHALL 写入当前活跃对话的 `turns` 数组。切换对话时，Trace 窗口 SHALL 加载目标对话的 `turns` 数据。

#### Scenario: 首次运行 Agent 后持久化

- **GIVEN** 对话 A 无历史 trace 数据
- **WHEN** Agent 运行完成，产生 2 个 Turn 的 trace 记录
- **THEN** 对话 A 的 `conversation.turns` SHALL 包含 2 条 `TurnTrace` 记录
- **AND** 数据 SHALL 随 chatStore 持久化到 localStorage

#### Scenario: 切换对话回来加载已有 Trace

- **GIVEN** 对话 A 有 3 条历史 TurnTrace，对话 B 无 trace
- **WHEN** 用户在对话 A 中打开 Trace 窗口 → 切换到对话 B → 切回对话 A → 重新打开 Trace
- **THEN** Trace 窗口 SHALL 展示对话 A 的 3 条历史 TurnTrace
- **AND** 数据 SHALL NOT 被清空

#### Scenario: 删除对话时 Trace 跟随删除

- **GIVEN** 对话 A 有 5 条 TurnTrace
- **WHEN** 用户删除对话 A
- **THEN** 对话 A 的 turns 数据 SHALL 随 Conversation 一起从 localStorage 移除

### Requirement: Manual Trace Clear

清除 Trace 操作 SHALL 仅由用户主动触发，系统 SHALL NOT 自动清空任何对话的 turns。

#### Scenario: 用户手动清除 Trace

- **GIVEN** 对话 A 的 Trace 窗口打开，有 3 条 TurnTrace
- **WHEN** 用户点击"清除 Trace"按钮
- **THEN** 对话 A 的 `conversation.turns` SHALL 变为空数组
- **AND** Trace 窗口 SHALL 显示空状态

#### Scenario: 切换对话不清空 Trace

- **GIVEN** 对话 A 有 3 条 TurnTrace
- **WHEN** 用户切换到对话 B
- **THEN** 对话 A 的 `conversation.turns` SHALL 保持 3 条记录不变

### Requirement: Normalize Persisted Trace Data

持久化数据加载时，`turns` 字段 SHALL 被规范化为默认值 `[]`（若缺失或为 undefined）。

#### Scenario: 旧版本数据迁移

- **GIVEN** localStorage 中存在旧版本持久化的对话数据（无 `turns` 字段）
- **WHEN** 应用启动并 rehydrate chatStore
- **THEN** 所有对话的 `turns` SHALL 被规范化为 `[]`
