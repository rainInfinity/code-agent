# trace-window-always-on-top Specification

## ADDED Requirements

### Requirement: 窗口置顶按钮

Trace 窗口自定义标题栏 SHALL 在"保持打开"按钮和"清除"按钮之间包含一个独立的"窗口置顶"按钮。该按钮 SHALL 具有激活/未激活两种视觉状态。

#### Scenario: 置顶按钮默认未激活

- **GIVEN** Trace 窗口首次打开
- **WHEN** 窗口渲染完成
- **THEN** 窗口置顶按钮 SHALL 显示为未激活状态
- **AND** Trace 窗口 SHALL NOT 处于 Always on Top 模式

#### Scenario: 点击置顶按钮切换窗口置顶

- **GIVEN** 置顶按钮处于未激活状态，Trace 窗口在正常窗口层级
- **WHEN** 用户点击窗口置顶按钮
- **THEN** 按钮 SHALL 切换为激活状态（主题色高亮）
- **AND** Trace 窗口 SHALL 调用 `set_always_on_top(true)` 置于所有窗口之上
- **AND** 再次点击 SHALL 恢复未激活状态并调用 `set_always_on_top(false)`

#### Scenario: 窗口置顶不影响其他功能

- **GIVEN** Trace 窗口处于置顶状态
- **WHEN** 用户在主窗口操作（拖拽、调整大小、发送消息等）
- **THEN** 主窗口 SHALL NOT 受 Trace 窗口置顶状态影响
- **AND** 主窗口可以被拖拽到 Trace 窗口上方（若主窗口也有置顶则不适用）

### Requirement: 置顶状态不持久化

窗口置顶状态 SHALL NOT 跨应用会话持久化。重启应用后 Trace 窗口 SHALL 默认以非置顶模式打开。

#### Scenario: 重启后置顶状态重置

- **GIVEN** 上次使用时 Trace 窗口处于置顶状态
- **WHEN** 用户重启应用并打开 Trace 窗口
- **THEN** 窗口置顶按钮 SHALL 显示为未激活状态
- **AND** Trace 窗口 SHALL NOT 处于 Always on Top 模式

### Requirement: 置顶功能与保持打开功能独立

"窗口置顶"按钮和"保持打开"按钮 SHALL 独立运作，互不影响。

#### Scenario: 同时激活两个按钮

- **GIVEN** Trace 窗口分别激活了"保持打开"和"窗口置顶"按钮
- **WHEN** 用户切换对话
- **THEN** Trace 窗口 SHALL 保持打开（"保持打开"功能）
- **AND** Trace 窗口 SHALL 保持在所有窗口之上（"窗口置顶"功能）
- **AND** 关闭任一按钮 SHALL NOT 影响另一按钮的状态
