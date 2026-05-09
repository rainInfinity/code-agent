# main-window-always-on-top Specification

## ADDED Requirements

### Requirement: 主窗口 TitleBar 置顶按钮

主窗口自定义标题栏 SHALL 在窗口控制按钮区（最小化按钮左侧）包含一个"窗口置顶"按钮。该按钮 SHALL 具有激活/未激活两种视觉状态。按钮的 i18n 文案 SHALL 使用"窗口置顶"。

#### Scenario: 置顶按钮默认未激活

- **GIVEN** 应用首次启动
- **WHEN** 主窗口渲染完成
- **THEN** 置顶按钮 SHALL 显示为未激活状态
- **AND** 主窗口 SHALL NOT 处于 Always on Top 模式
- **AND** Trace 窗口（若打开）SHALL NOT 处于 Always on Top 模式

#### Scenario: 点击置顶按钮同时置顶主窗口和 Trace 窗口

- **GIVEN** 置顶按钮处于未激活状态，Trace 窗口处于独立窗口模式且可见
- **WHEN** 用户点击置顶按钮
- **THEN** 按钮 SHALL 切换为激活状态（主题色高亮）
- **AND** 主窗口 SHALL 调用 `set_always_on_top(true)` 置于所有窗口之上
- **AND** Trace 窗口 SHALL 同时调用 `set_always_on_top(true)` 置于所有窗口之上
- **AND** 再次点击 SHALL 恢复未激活状态，两个窗口均取消置顶

#### Scenario: Trace 窗口未打开时仍可置顶主窗口

- **GIVEN** 置顶按钮处于未激活状态，Trace 窗口未打开
- **WHEN** 用户点击置顶按钮
- **THEN** 主窗口 SHALL 设置为 Always on Top
- **AND** 置顶按钮 SHALL 显示为激活状态

#### Scenario: Trace 窗口后续打开时继承主窗口置顶状态

- **GIVEN** 主窗口已置顶，Trace 窗口尚未创建
- **WHEN** 用户打开 Trace 窗口
- **THEN** Trace 窗口 SHALL 以 Always on Top 模式创建或显示

### Requirement: 置顶状态不持久化

全局置顶状态 SHALL NOT 跨应用会话持久化。重启应用后主窗口和 Trace 窗口 SHALL 默认以非置顶模式运行。

#### Scenario: 重启后置顶状态重置

- **GIVEN** 上次使用时主窗口处于置顶状态
- **WHEN** 用户重启应用
- **THEN** 主窗口 TitleBar 置顶按钮 SHALL 显示为未激活状态
- **AND** 主窗口 SHALL NOT 处于 Always on Top 模式
- **AND** Trace 窗口（若打开）SHALL NOT 处于 Always on Top 模式

### Requirement: 置顶命令 Rust 后端实现

Rust 后端 SHALL 提供 `set_main_always_on_top` command，接收 `always_on_top: bool` 参数。该 command SHALL 设置主窗口的 always-on-top 属性，并在 Trace 窗口存在且可见时同步设置 Trace 窗口的 always-on-top。

#### Scenario: 主窗口和 Trace 窗口同时设置置顶

- **GIVEN** 主窗口和 Trace 窗口均可见
- **WHEN** 前端调用 `set_main_always_on_top(true)`
- **THEN** 主窗口 SHALL 调用 `set_always_on_top(true)`
- **AND** Trace 窗口 SHALL 调用 `set_always_on_top(true)`
- **AND** 返回操作结果

#### Scenario: 贴靠模式下全局置顶不覆盖 dock 强制置顶

- **GIVEN** Trace 窗口处于贴靠模式（已强制 always-on-top）
- **WHEN** 前端调用 `set_main_always_on_top(false)`（关闭置顶）
- **THEN** 主窗口 SHALL 取消 always-on-top
- **AND** Trace 窗口 SHALL 保持 always-on-top（由贴靠模式强制）
