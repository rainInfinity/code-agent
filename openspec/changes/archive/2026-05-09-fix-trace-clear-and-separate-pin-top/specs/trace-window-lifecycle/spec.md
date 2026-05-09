## MODIFIED Requirements

### Requirement: 清除当前对话 Trace 历史

Trace 窗口的清除按钮 SHALL 清除当前 conversation 的本地 turns（附带 `turnsCleared` 标记），并通知主窗口同步清除。主窗口收到通知后 SHALL 清除本地 turns，但 SHALL NOT 回推 `trace-sync-conversations`。

#### Scenario: 点击清除按钮清除本地和主窗口历史

- **GIVEN** Trace 窗口当前 conversationId 为 `abc123`
- **AND** Trace 窗口本地 conversation `abc123` 有 3 条 turns
- **AND** 主窗口持久化 history 中 conversation `abc123` 有 3 条 turns
- **WHEN** 用户点击 Trace 清除按钮
- **THEN** Trace 窗口 SHALL 调用本地 `clearTurns("abc123")`（设置 `turnsCleared: true`）
- **AND** Trace 窗口 SHALL emit `trace-clear-conversation`，payload 为 `abc123`
- **AND** 主窗口 SHALL 调用 `clearConversationTurns("abc123")`（设置 `turnsCleared: true`）
- **AND** 主窗口 SHALL NOT emit `trace-sync-conversations` 回推
- **AND** 主窗口持久化 history 中 conversation `abc123` 的 `turns` SHALL 变为空数组

#### Scenario: 清除后重新打开 Trace 不恢复旧历史

- **GIVEN** 用户已在 Trace 窗口清除 conversation `abc123` 的 Trace 历史
- **WHEN** 用户关闭并重新打开 Trace 窗口到 conversation `abc123`
- **THEN** Trace 窗口 SHALL 从持久化快照读取到空 turns
- **AND** Trace 面板 SHALL 显示等待状态或 `Turn 0/0`
