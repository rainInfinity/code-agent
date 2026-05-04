# trace-window-lifecycle Specification

## ADDED Requirements

### Requirement: Trace 窗口创建时传递 URL 路由参数

`open_trace_window` 命令 SHALL 在创建 Trace 窗口时使用 `WebviewUrl::App("index.html?window=trace".into())`，将窗口标识作为 URL 查询参数传递给前端。

#### Scenario: 首次打开 Trace 窗口

- **GIVEN** Trace 窗口尚未创建
- **WHEN** 用户点击 StatusBar 的 Trace 按钮
- **THEN** 创建一个新的 webview 窗口，URL 为 `index.html?window=trace`
- **AND** 窗口使用 `.decorations(false)` 无原生标题栏
- **AND** 窗口默认尺寸为 420×600，最小尺寸为 320×400
- **AND** 窗口 `.resizable(true)` 可独立调整大小
- **AND** 窗口在屏幕上居中显示（`.center()`）

#### Scenario: 再次打开已隐藏的 Trace 窗口

- **GIVEN** Trace 窗口已创建但处于隐藏状态
- **WHEN** 用户点击 StatusBar 的 Trace 按钮
- **THEN** 窗口调用 `.show()` 重新显示
- **AND** 窗口调用 `.set_focus()` 获得焦点
- **AND** 不创建新的 webview 窗口

### Requirement: Trace 窗口关闭使用 hide 而非 destroy

`hide_trace_window` 命令 SHALL 使用 `.hide()` 隐藏 Trace 窗口，而非 `.close()` 销毁窗口，以避免销毁/重建竞态。

#### Scenario: 用户通过按钮隐藏 Trace 窗口

- **GIVEN** Trace 窗口当前可见
- **WHEN** 用户点击 StatusBar 的 Trace 按钮（toggle 关闭）
- **THEN** 调用 `hide_trace_window` 命令
- **AND** Trace 窗口被隐藏（`.hide()`）
- **AND** 窗口的 webview 上下文保持不变
- **AND** 主窗口的 StatusBar 中 Trace 按钮状态更新为未激活

#### Scenario: 用户通过 Trace 窗口自定义关闭按钮隐藏

- **GIVEN** Trace 窗口当前可见
- **WHEN** 用户点击 Trace 窗口自定义标题栏的关闭按钮
- **THEN** 调用 `hide_trace_window` 命令
- **AND** Trace 窗口被隐藏
- **AND** 主窗口的 Trace 按钮状态同步更新

#### Scenario: 主窗口关闭时销毁 Trace 窗口

- **GIVEN** Trace 窗口处于隐藏或可见状态
- **WHEN** 主窗口的 `CloseRequested` 事件触发
- **THEN** 调用 `close_trace_window`（`.close()`）彻底销毁 Trace 窗口
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

`main.tsx` 中的路由逻辑 SHALL 以 URL 查询参数 `?window=trace` 为主判定依据，`getCurrentWebviewWindow().label` 为辅助判定。

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
