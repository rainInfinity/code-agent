# trace-window-lifecycle Specification

## MODIFIED Requirements

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

## ADDED Requirements

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
