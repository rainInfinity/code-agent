## MODIFIED Requirements

### Requirement: Docked Trace Always On Top

贴靠模式下，Trace 窗口 SHALL 强制保持 always-on-top；退出贴靠时 SHALL 恢复进入贴靠前的 always-on-top 状态（由主窗口全局置顶按钮控制）。贴靠模式下 Trace 窗口的 Z-order SHALL 始终大于主窗口。

#### Scenario: 进入贴靠时强制置顶

- **GIVEN** Trace 窗口处于独立窗口模式且未置顶
- **WHEN** 用户将 Trace 窗口切换到贴靠模式
- **THEN** Trace 窗口 SHALL 设置为 always-on-top
- **AND** 系统 SHALL 记录进入贴靠前的 always-on-top 状态

#### Scenario: 贴靠模式下 Trace Z-order 大于主窗口

- **GIVEN** Trace 窗口处于贴靠模式且主窗口也处于 always-on-top 状态
- **WHEN** 用户在主窗口上进行操作（点击、输入等）
- **THEN** Trace 窗口 SHALL 保持在主窗口上层显示
- **AND** 主窗口 SHALL NOT 遮挡 Trace 窗口
- **AND** `apply_trace_docking` 每次同步 SHALL 确保 Trace Z-order 优先

#### Scenario: 退出贴靠时恢复原置顶状态

- **GIVEN** Trace 窗口进入贴靠前未置顶（主窗口全局置顶关闭）
- **AND** Trace 窗口当前处于贴靠模式且已强制置顶
- **WHEN** 用户退出贴靠模式
- **THEN** Trace 窗口 SHALL 关闭 always-on-top

#### Scenario: 退出贴靠时保留全局置顶

- **GIVEN** Trace 窗口进入贴靠前主窗口全局置顶已开启
- **AND** Trace 窗口当前处于贴靠模式
- **WHEN** 用户退出贴靠模式
- **THEN** Trace 窗口 SHALL 保持 always-on-top（由全局置顶控制）

### Requirement: 贴靠模式下用户主动隐藏 Trace 窗口后保持隐藏

贴靠模式下，当用户通过主窗口 Trace 按钮或 Trace 窗口关闭按钮隐藏 Trace 窗口时，系统 SHALL 设置 `hidden_while_docked` 标记。在标记有效期间，主窗口移动、调整大小、获得焦点等事件触发的 `apply_trace_docking` SHALL NOT 调用 `trace.show()` 重新显示 Trace 窗口。用户重新打开 Trace 窗口时，系统 SHALL 清除标记并恢复正常贴靠显示，同时 SHALL 恢复 Trace > Main 的 Z-order 优先级。

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
- **AND** Trace 窗口 SHALL 恢复为 Always on Top 并优先于主窗口 Z-order

#### Scenario: 独立窗口模式下关闭按钮行为不变

- **GIVEN** Trace 窗口处于独立窗口模式（非贴靠）
- **WHEN** 用户点击 Trace 窗口标题栏的关闭按钮
- **THEN** Trace 窗口 SHALL 隐藏（行为不变）
- **AND** `hidden_while_docked` SHALL NOT 被设置
