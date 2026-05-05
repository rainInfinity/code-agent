## ADDED Requirements

### Requirement: 贴靠模式下用户主动隐藏 Trace 窗口后保持隐藏

贴靠模式下，当用户通过主窗口 Trace 按钮或 Trace 窗口关闭按钮隐藏 Trace 窗口时，系统 SHALL 设置 `hidden_while_docked` 标记。在标记有效期间，主窗口移动、调整大小、获得焦点等事件触发的 `apply_trace_docking` SHALL NOT 调用 `trace.show()` 重新显示 Trace 窗口。用户重新打开 Trace 窗口时，系统 SHALL 清除标记并恢复正常贴靠显示。

#### Scenario: 贴靠模式下主窗口 Trace 按钮关闭后拖动主窗口

- **GIVEN** Trace 窗口处于右侧贴靠模式且可见
- **WHEN** 用户点击主窗口 StatusBar 的 Trace 按钮关闭 Trace 窗口
- **AND** 用户拖动主窗口
- **THEN** Trace 窗口 SHALL 保持隐藏状态
- **AND** 主窗口 Trace 按钮 SHALL 显示为非激活状态

#### Scenario: 贴靠模式下 Trace 关闭按钮点击后主窗口获得焦点

- **GIVEN** Trace 窗口处于左侧贴靠模式且可见
- **WHEN** 用户点击 Trace 窗口标题栏的关闭按钮
- **THEN** Trace 窗口 SHALL 隐藏
- **AND** 主窗口获得焦点时 SHALL NOT 导致 Trace 窗口重新显示
- **AND** 主窗口 Trace 按钮 SHALL 同步为非激活状态

#### Scenario: 贴靠模式下隐藏后重新打开恢复贴靠

- **GIVEN** Trace 窗口处于右侧贴靠模式
- **AND** 用户已通过主窗口 Trace 按钮关闭了 Trace 窗口（hidden_while_docked = true）
- **WHEN** 用户再次点击主窗口 Trace 按钮打开 Trace 窗口
- **THEN** Trace 窗口 SHALL 显示并恢复右侧贴靠
- **AND** 贴靠宽度 SHALL 与隐藏前一致
- **AND** `hidden_while_docked` 标记 SHALL 被清除

#### Scenario: 贴靠模式下隐藏后切换贴靠侧重新打开

- **GIVEN** Trace 窗口处于右侧贴靠模式
- **AND** 用户已关闭 Trace 窗口（hidden_while_docked = true）
- **WHEN** 用户重新打开 Trace 窗口并切换到左侧贴靠
- **THEN** Trace 窗口 SHALL 以左侧贴靠模式显示
- **AND** `hidden_while_docked` 标记 SHALL 被清除

#### Scenario: 独立窗口模式下关闭按钮行为不变

- **GIVEN** Trace 窗口处于独立窗口模式（非贴靠）
- **WHEN** 用户点击 Trace 窗口标题栏的关闭按钮
- **THEN** Trace 窗口 SHALL 隐藏（行为不变）
- **AND** `hidden_while_docked` SHALL NOT 被设置
