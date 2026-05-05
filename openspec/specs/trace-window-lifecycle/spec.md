# trace-window-lifecycle Specification

## ADDED Requirements

### Requirement: Trace 窗口创建时传递 URL 路由参数

`open_trace_window` 命令 SHALL 在创建 Trace 窗口时使用包含 `window=trace` 和 `conversationId=<id>` 查询参数的 URL，将窗口标识和初始对话 ID 作为 URL 查询参数传递给前端。

#### Scenario: 首次打开 Trace 窗口

- **GIVEN** Trace 窗口尚未创建，当前活跃对话 ID 为 `abc123`
- **WHEN** 用户点击 StatusBar 的 Trace 按钮
- **THEN** 创建一个新的 webview 窗口，URL 为 `index.html?window=trace&conversationId=abc123`
- **AND** 窗口使用 `.decorations(false)` 无原生标题栏
- **AND** 若有持久化的窗口状态，尺寸和位置从 `window-state.json` 恢复
- **AND** 若无持久化状态，默认尺寸为 420×600
- **AND** 若无持久化状态，窗口在屏幕上居中显示（`.center()`）
- **AND** 窗口 `.resizable(true)` 可独立调整大小
- **AND** 窗口最小尺寸为 320×400

#### Scenario: 再次打开已隐藏的 Trace 窗口

- **GIVEN** Trace 窗口已创建但处于隐藏状态
- **WHEN** 用户点击 StatusBar 的 Trace 按钮
- **THEN** 窗口调用 `.show()` 重新显示
- **AND** 窗口调用 `.set_focus()` 获得焦点
- **AND** 不创建新的 webview 窗口
- **AND** conversationId 通过 `emitTraceConversationChanged` 事件传递

### Requirement: Trace 窗口关闭使用 hide 而非 destroy

`hide_trace_window` 命令 SHALL 使用 `.hide()` 隐藏 Trace 窗口，而非 `.close()` 销毁窗口。在隐藏前 SHALL 保存当前窗口状态到 `window-state.json`。

#### Scenario: 用户通过按钮隐藏 Trace 窗口

- **GIVEN** Trace 窗口当前可见
- **WHEN** 用户点击 StatusBar 的 Trace 按钮（toggle 关闭）
- **THEN** 调用 `hide_trace_window` 命令
- **AND** Trace 窗口的当前大小和位置 SHALL 保存到 `window-state.json`
- **AND** Trace 窗口被隐藏（`.hide()`）
- **AND** 窗口的 webview 上下文保持不变
- **AND** 主窗口的 StatusBar 中 Trace 按钮状态更新为未激活

#### Scenario: 用户通过 Trace 窗口自定义关闭按钮隐藏

- **GIVEN** Trace 窗口当前可见
- **WHEN** 用户点击 Trace 窗口自定义标题栏的关闭按钮
- **THEN** 调用 `hide_trace_window` 命令
- **AND** Trace 窗口被隐藏
- **AND** 窗口状态已保存
- **AND** 主窗口的 Trace 按钮状态同步更新

#### Scenario: 主窗口关闭时销毁 Trace 窗口

- **GIVEN** Trace 窗口处于隐藏或可见状态
- **WHEN** 主窗口的 `CloseRequested` 事件触发
- **THEN** 保存 Trace 窗口状态到 `window-state.json`
- **AND** 调用 `close_trace_window`（`.close()`）彻底销毁 Trace 窗口
- **AND** 主窗口正常关闭

### Requirement: Trace 窗口自定义标题栏（含窗口控制按钮）

Trace 窗口 React 组件 (`TracePanel`) SHALL 在顶部渲染自定义标题栏，替代原生标题栏。标题栏 SHALL 包含可拖拽区域、窗口标题、以及最小化/最大化/关闭三件套按钮。

#### Scenario: 自定义标题栏渲染

- **GIVEN** Trace 窗口使用 `.decorations(false)` 创建
- **WHEN** `TracePanel` 组件挂载
- **THEN** 顶部显示自定义标题栏，包含 "Agent Trace" 标题文本
- **AND** 标题栏区域支持鼠标拖拽（调用 `getCurrentWindow().startDragging()`）
- **AND** 标题栏右侧依次显示：最小化按钮、最大化/还原按钮、关闭按钮

#### Scenario: 拖拽 Trace 窗口

- **GIVEN** Trace 窗口的自定义标题栏已渲染
- **WHEN** 用户在标题栏的拖拽区域按住鼠标左键并拖拽
- **THEN** 调用 `window.startDragging()` 触发系统级窗口拖拽
- **AND** Trace 窗口随鼠标移动到任意位置（包括跨显示器）

#### Scenario: 点击最小化按钮

- **GIVEN** Trace 窗口的自定义标题栏已渲染
- **WHEN** 用户点击标题栏的最小化按钮
- **THEN** 调用 `getCurrentWindow().minimize()`
- **AND** Trace 窗口最小化到任务栏

#### Scenario: 点击最大化/还原按钮

- **GIVEN** Trace 窗口的自定义标题栏已渲染
- **WHEN** 用户点击标题栏的最大化按钮
- **THEN** 调用 `getCurrentWindow().toggleMaximize()`
- **AND** 窗口最大化或还原，按钮图标相应切换

#### Scenario: 双击标题栏切换最大化

- **GIVEN** Trace 窗口的自定义标题栏已渲染
- **WHEN** 用户双击标题栏的拖拽区域
- **THEN** 调用 `getCurrentWindow().toggleMaximize()`
- **AND** 窗口最大化或还原

#### Scenario: 点击关闭按钮隐藏窗口

- **GIVEN** Trace 窗口的自定义标题栏已渲染
- **WHEN** 用户点击标题栏的关闭按钮
- **THEN** 调用前端 IPC `hideTraceWindow()`
- **AND** Trace 窗口隐藏（非销毁）
- **AND** 主窗口 StatusBar 的 Trace 按钮状态同步为非激活

### Requirement: 前端入口根据 URL 参数路由到正确的根组件

`main.tsx` 中的路由逻辑 SHALL 以 URL 查询参数 `?window=trace` 为主判定依据，`getCurrentWebviewWindow().label` 为辅助判定。Trace 窗口 SHALL 从 URL 参数 `conversationId` 读取初始对话 ID。

#### Scenario: URL 参数判定为主

- **GIVEN** 页面 URL 包含 `?window=trace` 查询参数
- **WHEN** `main.tsx` 执行 `isTraceWindow()` 判断
- **THEN** 返回 `true`，渲染 `<TraceApp />` 组件
- **AND** 不依赖 `getCurrentWebviewWindow()` 的返回值

#### Scenario: IPC 标签判定为辅（开发/HMR 场景）

- **GIVEN** 页面 URL 不包含 `?window=trace`（如 Vite HMR 热更新后 URL 参数丢失）
- **WHEN** `main.tsx` 执行 `isTraceWindow()` 判断
- **THEN** 回退到检查 `getCurrentWebviewWindow().label === 'trace'`
- **AND** 若 label 匹配，渲染 `<TraceApp />`

#### Scenario: 主窗口正常渲染

- **GIVEN** 页面 URL 不包含 `?window=trace` 且 `getCurrentWebviewWindow().label` 不是 `'trace'`
- **WHEN** `main.tsx` 执行路由判断
- **THEN** 返回 `false`，渲染 `<App />` 组件

### Requirement: Trace 窗口不影响主窗口功能

Trace 窗口 SHALL 作为独立窗口运行，无论可见或隐藏，均不影响主窗口的交互能力，包括但不限于窗口拖拽、窗口关闭、对话消息发送与接收。

#### Scenario: Trace 窗口显示时主窗口拖拽正常

- **GIVEN** Trace 窗口处于可见状态
- **WHEN** 用户在主窗口的自定义标题栏区域拖拽
- **THEN** 主窗口正常响应拖拽操作
- **AND** 主窗口可以正常最小化、最大化、关闭

#### Scenario: Trace 窗口显示时主窗口对话正常

- **GIVEN** Trace 窗口处于可见状态并已正确渲染 `<TraceApp />`
- **WHEN** 用户在主窗口发送消息触发 Agent 运行
- **THEN** Agent 事件正常流式传输到主窗口
- **AND** 对话消息正常更新
- **AND** Trace 窗口同步接收并显示 Agent 事件数据

#### Scenario: Trace 窗口可独立于主窗口操作

- **GIVEN** Trace 窗口和主窗口均可见
- **WHEN** 用户在 Trace 窗口上进行拖拽、调整大小、最小化、最大化等操作
- **THEN** 仅 Trace 窗口受影响
- **AND** 主窗口的位置、大小和状态保持不变

### Requirement: Trace 窗口状态持久化

Trace 窗口运行时，其大小和位置的变更 SHALL 以 500ms 防抖延迟保存到 `window-state.json`。`window-state.json` SHALL 同时存储主窗口和 Trace 窗口的状态。

#### Scenario: 窗口移动时防抖保存

- **GIVEN** Trace 窗口已创建并可见
- **WHEN** 用户拖拽窗口改变位置
- **THEN** `Moved` 事件触发后约 500ms，系统 SHALL 保存最新位置
- **AND** 连续快速拖拽时 SHALL NOT 每次事件都立即写盘

#### Scenario: 窗口调整大小时防抖保存

- **GIVEN** Trace 窗口已创建并可见
- **WHEN** 用户拖拽窗口边缘调整大小
- **THEN** `Resized` 事件触发后约 500ms，系统 SHALL 保存最新尺寸
- **AND** 保存的状态包含最大化标志

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

### Requirement: Trace 窗口数据加载初始化

Trace 窗口前端 SHALL 在监听器安装完成后，从 URL 查询参数 `conversationId` 或通过 `trace-window-ready` / `trace-conversation-changed` 事件获取初始对话 ID。若初始 conversationId 未设置且 URL 参数中存在，SHALL 使用 URL 参数初始化。

#### Scenario: 窗口首次创建时从 URL 参数加载

- **GIVEN** Trace 窗口首次创建，URL 为 `index.html?window=trace&conversationId=abc123`
- **AND** 对话 `abc123` 有 3 条历史 TurnTrace
- **WHEN** 窗口加载完成，React 组件挂载，IPC 监听器安装完毕
- **THEN** `useTraceIpc` SHALL 从 URL 参数读取 `conversationId=abc123`
- **AND** traceStore 的 `conversationId` SHALL 设置为 `abc123`
- **AND** Trace 窗口 SHALL 展示 3 条历史 TurnTrace

#### Scenario: 窗口已存在时通过事件更新

- **GIVEN** Trace 窗口已创建并处于隐藏状态，监听器已安装
- **WHEN** 用户切换对话后打开 Trace 窗口
- **THEN** `emitTraceConversationChanged` 事件 SHALL 更新 traceStore 的 conversationId
- **AND** Trace 窗口 SHALL 加载新对话的 turns 数据

#### Scenario: 就绪后主动同步

- **GIVEN** Trace 窗口首次创建，URL 中无 `conversationId` 参数
- **WHEN** IPC 监听器全部安装完毕且 `conversationId` 仍为 `null`
- **THEN** Trace 窗口 SHALL emit `trace-window-ready` 事件到主窗口
- **AND** 主窗口收到后 SHALL 重新 emit `trace-conversation-changed` 事件
