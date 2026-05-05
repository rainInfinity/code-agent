## MODIFIED Requirements

### Requirement: Trace Window Follows Main Window Geometry
贴靠模式下，Trace 窗口 SHALL 跟随主窗口移动和尺寸变化，并 SHALL 保持与主窗口相同的高度。当主窗口最大化时，Trace 窗口 SHALL 留出主窗口标题栏区域，确保不遮挡主窗口的最小化、最大化和关闭按钮。

#### Scenario: 主窗口移动时同步贴靠位置
- **GIVEN** Trace 窗口处于右侧贴靠模式
- **WHEN** 主窗口被移动
- **THEN** Trace 窗口 SHALL 重新定位到主窗口右侧
- **AND** Trace 窗口顶部 SHALL 与主窗口顶部对齐

#### Scenario: 主窗口调整高度时同步 Trace 高度
- **GIVEN** Trace 窗口处于左侧或右侧贴靠模式
- **WHEN** 主窗口高度发生变化
- **THEN** Trace 窗口高度 SHALL 更新为主窗口高度
- **AND** Trace 窗口顶部 SHALL 与主窗口顶部保持一致

#### Scenario: 主窗口最大化时贴靠到内侧并避开标题栏
- **GIVEN** Trace 窗口处于右侧贴靠模式
- **WHEN** 主窗口最大化
- **THEN** Trace 窗口 SHALL 贴靠到主窗口内侧右边缘
- **AND** Trace 窗口高度 SHALL 为主窗口高度减去标题栏高度
- **AND** Trace 窗口 y 坐标 SHALL 下移一个标题栏高度
- **AND** 主窗口标题栏的控制按钮 SHALL 保持可见且可操作

#### Scenario: 主窗口从最大化恢复时重新贴靠外侧
- **GIVEN** Trace 窗口处于左侧贴靠模式且主窗口已最大化
- **WHEN** 主窗口从最大化恢复
- **THEN** Trace 窗口 SHALL 根据恢复后的主窗口 bounds 重新贴靠
- **AND** Trace 窗口 SHALL 保持用户选择的左侧贴靠模式
- **AND** Trace 窗口高度 SHALL 恢复为主窗口完整高度（无需减去标题栏高度）

### Requirement: Docked Trace Width Persistence
贴靠模式下，Trace 窗口宽度 SHALL 可由用户拖拽调整，系统 SHALL 通过 OS 级尺寸约束将宽度限制在 [580, 800] 范围内，高度 SHALL 锁定为主窗口高度。用户拖拽过程中 SHALL NOT 出现尺寸超出限制后突变跳回的现象。

#### Scenario: 用户调整贴靠宽度时 OS 级约束
- **GIVEN** Trace 窗口处于右侧贴靠模式
- **WHEN** 用户拖拽 Trace 窗口边缘调整尺寸
- **THEN** 操作系统 SHALL 仅在 [580, 800] 宽度范围内允许拖拽
- **AND** Trace 窗口高度 SHALL 在拖拽过程中保持与主窗口高度一致
- **AND** 用户 SHALL NOT 能将窗口拖拽到允许范围之外

#### Scenario: 贴靠宽度不覆盖独立窗口尺寸
- **GIVEN** Trace 窗口处于独立窗口模式且已有独立窗口尺寸
- **WHEN** 用户进入贴靠模式并调整贴靠宽度后退出贴靠
- **THEN** Trace 窗口 SHALL 恢复独立窗口尺寸
- **AND** 独立窗口尺寸 SHALL NOT 被贴靠宽度覆盖

#### Scenario: 重新进入贴靠时恢复贴靠宽度
- **GIVEN** 用户此前在贴靠模式保存过贴靠宽度
- **WHEN** Trace 窗口再次进入贴靠模式
- **THEN** Trace 窗口 SHALL 使用最近保存的贴靠宽度

### Requirement: Docked Trace Window Controls
贴靠模式下，Trace 窗口 SHALL 禁用最大化操作。用户拖拽 Trace 标题栏导致窗口实际移动时，系统 SHALL 自动退出贴靠模式；仅单击标题栏而不产生窗口移动时 SHALL NOT 退出贴靠。

#### Scenario: 贴靠模式禁用最大化按钮
- **GIVEN** Trace 窗口处于左侧或右侧贴靠模式
- **WHEN** 用户查看 Trace 标题栏窗口控制区
- **THEN** 最大化按钮 SHALL 处于禁用状态
- **AND** 最大化按钮 SHALL 提供中文可访问提示说明贴靠模式不可最大化

#### Scenario: 拖拽标题栏导致窗口移动时退出贴靠
- **GIVEN** Trace 窗口处于右侧贴靠模式
- **WHEN** 用户从 Trace 标题栏开始拖拽窗口并产生实际移动
- **THEN** Trace 窗口 SHALL 自动退出贴靠模式
- **AND** Trace 窗口 SHALL 变为独立窗口
- **AND** 用户拖拽 SHALL 继续作为独立窗口拖拽处理

#### Scenario: 单击标题栏不退出贴靠
- **GIVEN** Trace 窗口处于贴靠模式
- **WHEN** 用户在 Trace 标题栏上按下并释放鼠标而未产生窗口移动
- **THEN** Trace 窗口 SHALL 保持贴靠模式
- **AND** 贴靠状态 SHALL NOT 发生变化
