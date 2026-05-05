## MODIFIED Requirements

### Requirement: Trace 窗口关闭使用 hide 而非 destroy

`hide_trace_window` 命令 SHALL 使用 `.hide()` 隐藏 Trace 窗口，而非 `.close()` 销毁窗口。在隐藏前 SHALL 保存当前窗口状态到 `window-state.json`。当 Trace 窗口处于贴靠模式时，`hide_trace_window` SHALL 设置 `hidden_while_docked` 标记为 `true`，以阻止后续 `apply_trace_docking` 重新显示窗口；SHALL NOT 退出贴靠模式。

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

#### Scenario: 贴靠模式下隐藏 Trace 窗口并标记 hidden_while_docked

- **GIVEN** Trace 窗口处于右侧贴靠模式且可见
- **WHEN** 用户点击 Trace 窗口关闭按钮或主窗口 Trace 按钮
- **THEN** `hide_trace_window` SHALL 设置 `hidden_while_docked = true`
- **AND** docking 配置（侧边、宽度）SHALL 保持不变
- **AND** Trace 窗口 SHALL NOT 退出贴靠模式
- **AND** 后续主窗口移动/焦点事件 SHALL NOT 重新显示 Trace 窗口

#### Scenario: 主窗口关闭时销毁 Trace 窗口

- **GIVEN** Trace 窗口处于隐藏或可见状态
- **WHEN** 主窗口的 `CloseRequested` 事件触发
- **THEN** 保存 Trace 窗口状态到 `window-state.json`
- **AND** 调用 `close_trace_window`（`.close()`）彻底销毁 Trace 窗口
- **AND** 主窗口正常关闭
