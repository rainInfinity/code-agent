# trace-window-lifecycle Specification

## MODIFIED Requirements

### Requirement: Trace 数据持久化

主窗口 SHALL 将 Agent Trace 生命周期数据写入当前 conversation 的 `turns` 字段，并通过主窗口聊天历史持久化 key `code-agent-chat-history` 保存。

#### Scenario: Agent 运行时持久化 Trace turn

- **GIVEN** 用户在对话 `abc123` 中启动 Agent
- **WHEN** 后端 emit `agent-turn`
- **THEN** 主窗口 SHALL 在 conversation `abc123` 的 `turns` 中追加一个 `TurnTrace`
- **AND** 新 turn SHALL 包含 `turnNumber`、`sessionId`、`conversationId`、`startTime`、`status`、空 thinking 和空 response
- **AND** conversation SHALL 通过 chatStore persist 写入 `code-agent-chat-history`

#### Scenario: Trace prompt 和内容增量持久化

- **GIVEN** conversation `abc123` 已有正在运行的最新 turn
- **WHEN** 主窗口收到 `trace-prompt`、`thinking-delta`、`stream-delta`、`trace-thinking-end`
- **THEN** 主窗口 SHALL 更新 conversation `abc123` 的最新 turn
- **AND** prompt、thinking content、response content、thinking status SHALL 保存在 `turns` 中

#### Scenario: Agent 完成时持久化完整 Trace

- **GIVEN** conversation `abc123` 的最新 turn 正在运行
- **WHEN** 主窗口收到 `agent-complete`
- **THEN** 主窗口 SHALL 将最新 turn 标记为 `complete` 或 `error`
- **AND** SHALL 写入 `endTime`、thinking endTime、response endTime 和 usage token 信息
- **AND** 完整 turns SHALL 被持久化到 `code-agent-chat-history`

### Requirement: Trace 窗口初始化加载历史数据

Trace 窗口前端 SHALL 在 IPC 监听器安装完成后，先从主窗口持久化快照 `code-agent-chat-history` hydrate conversations，再通过 `trace-window-ready` 请求主窗口推送实时全量 conversations。

#### Scenario: 首次创建时从 URL 参数和持久化快照加载

- **GIVEN** Trace 窗口首次创建，URL 为 `index.html?window=trace&conversationId=abc123`
- **AND** 主窗口持久化快照中 conversation `abc123` 包含 3 条历史 `TurnTrace`
- **WHEN** Trace 窗口加载完成并安装 IPC 监听器
- **THEN** Trace 窗口 SHALL 从 URL 参数设置 `traceStore.conversationId` 为 `abc123`
- **AND** SHALL 从 `code-agent-chat-history` 读取 conversations
- **AND** SHALL 在 Trace 面板中展示 conversation `abc123` 的 3 条历史 turns
- **AND** SHALL emit `trace-window-ready` 请求主窗口补发实时快照

#### Scenario: 主窗口无 activeConversationId 时仍同步全量数据

- **GIVEN** Trace 窗口首次创建，URL 中无 `conversationId`
- **AND** 主窗口有 5 条 conversations，但 `activeConversationId` 为 `null`
- **WHEN** Trace 窗口 emit `trace-window-ready`
- **THEN** 主窗口 SHALL emit `trace-sync-conversations`
- **AND** payload SHALL 包含全部 5 条 conversations
- **AND** 主窗口 SHALL NOT emit `trace-conversation-changed`

#### Scenario: 主窗口有 activeConversationId 时同步当前对话

- **GIVEN** Trace 窗口已安装监听器
- **AND** 主窗口 `activeConversationId` 为 `xyz789`
- **WHEN** Trace 窗口 emit `trace-window-ready`
- **THEN** 主窗口 SHALL emit `trace-sync-conversations`，payload 包含全量 conversations
- **AND** 主窗口 SHALL emit `trace-conversation-changed`，payload 为 `xyz789`
- **AND** Trace 窗口 SHALL 选择 conversation `xyz789` 并展示其 turns

### Requirement: Trace 同步合并保护

Trace 窗口收到 conversations 快照时 SHALL 合并 incoming conversations 与本地 conversations，并保护本地已有 turns 不被空 turns 覆盖。

#### Scenario: incoming 空 turns 不覆盖本地已有 turns

- **GIVEN** Trace 窗口本地 conversation `abc123` 已有 2 条 turns
- **AND** 主窗口 emit 的 `trace-sync-conversations` 中 conversation `abc123` 的 `turns` 为空数组或缺失
- **WHEN** Trace 窗口处理同步事件
- **THEN** Trace 窗口 SHALL 保留本地 conversation `abc123` 的 2 条 turns
- **AND** Trace 面板 SHALL 继续展示这 2 条 turns

#### Scenario: incoming 有 turns 时更新本地历史

- **GIVEN** Trace 窗口本地 conversation `abc123` 已有 1 条 turn
- **AND** 主窗口 emit 的 `trace-sync-conversations` 中 conversation `abc123` 有 3 条 turns
- **WHEN** Trace 窗口处理同步事件
- **THEN** Trace 窗口 SHALL 使用 incoming conversation 更新本地 conversation
- **AND** Trace 面板 SHALL 展示 3 条 turns

### Requirement: 清除当前对话 Trace 历史

Trace 窗口的清除按钮 SHALL 清除当前 conversation 的本地 turns，并通知主窗口清除同一 conversation 的持久化 turns。

#### Scenario: 点击清除按钮清除本地和主窗口历史

- **GIVEN** Trace 窗口当前 conversationId 为 `abc123`
- **AND** Trace 窗口本地 conversation `abc123` 有 3 条 turns
- **AND** 主窗口持久化 history 中 conversation `abc123` 有 3 条 turns
- **WHEN** 用户点击 Trace 清除按钮
- **THEN** Trace 窗口 SHALL 调用本地 `clearTurns("abc123")`
- **AND** Trace 窗口 SHALL emit `trace-clear-conversation`，payload 为 `abc123`
- **AND** 主窗口 SHALL 调用 `clearConversationTurns("abc123")`
- **AND** 主窗口持久化 history 中 conversation `abc123` 的 `turns` SHALL 变为空数组
- **AND** 主窗口 SHALL emit `trace-sync-conversations` 回推清除后的快照

#### Scenario: 清除后重新打开 Trace 不恢复旧历史

- **GIVEN** 用户已在 Trace 窗口清除 conversation `abc123` 的 Trace 历史
- **WHEN** 用户关闭并重新打开 Trace 窗口到 conversation `abc123`
- **THEN** Trace 窗口 SHALL 从持久化快照读取到空 turns
- **AND** Trace 面板 SHALL 显示等待状态或 `Turn 0/0`
