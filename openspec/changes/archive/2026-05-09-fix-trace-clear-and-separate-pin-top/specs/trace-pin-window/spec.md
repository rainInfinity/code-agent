## MODIFIED Requirements

### Requirement: Pin Button in Trace Title Bar

Trace 窗口自定义标题栏 SHALL 在"展开/折叠全部"按钮和"独立窗口"按钮之间包含一个"保持打开"（Pin）按钮。Pin 按钮 SHALL 具有激活/未激活两种视觉状态。Pin 按钮 SHALL 仅控制 `isPinned` 状态，不再联动 `alwaysOnTop`。

#### Scenario: Pin 按钮默认未激活

- **GIVEN** Trace 窗口首次打开
- **WHEN** 窗口渲染完成
- **THEN** Pin 按钮 SHALL 显示为未激活状态（默认色/无高亮）
- **AND** 按钮的 tooltip SHALL 显示"切换对话时保持 Trace 窗口打开"

#### Scenario: 点击 Pin 按钮切换状态

- **GIVEN** Pin 按钮处于未激活状态
- **WHEN** 用户点击 Pin 按钮
- **THEN** 按钮 SHALL 切换为激活状态（主题色高亮）
- **AND** `isPinned` 状态 SHALL 持久化到 chatStore（localStorage）
- **AND** 再次点击 SHALL 恢复未激活状态并更新持久化

#### Scenario: Pin 状态重启后恢复

- **GIVEN** 上次使用时 `isPinned` 为 `true` 并已持久化
- **WHEN** 用户重启应用并打开 Trace 窗口
- **THEN** `isPinned` SHALL 恢复为 `true`
- **AND** Pin 按钮 SHALL 显示为激活状态

### Requirement: Pin Mode — Trace Window Stays Open Across Conversation Switch

当 Pin 未激活时，切换对话 SHALL 自动隐藏 Trace 窗口。当 Pin 激活时，切换对话 SHALL 保持 Trace 窗口打开，并加载新对话的 trace 数据。

#### Scenario: 非 Pin 模式切换对话

- **GIVEN** Trace 窗口打开，Pin 未激活，当前为对话 A
- **WHEN** 用户切换到对话 B
- **THEN** Trace 窗口 SHALL 自动 hide
- **AND** 对话 A 的 `traceEnabled` SHALL 重置为 false

#### Scenario: Pin 模式切换对话

- **GIVEN** Trace 窗口打开，Pin 已激活，当前展示对话 A 的 turns
- **WHEN** 用户切换到对话 B
- **THEN** Trace 窗口 SHALL 保持打开
- **AND** Trace 窗口 SHALL 加载并展示对话 B 的 turns
- **AND** 对话 B 的 `traceEnabled` SHALL 设置为 true

#### Scenario: Pin 模式切换到无 Trace 的对话

- **GIVEN** Trace 窗口 Pin 已激活，对话 B 无历史 trace
- **WHEN** 用户切换到对话 B
- **THEN** Trace 窗口 SHALL 保持打开并显示空状态

## REMOVED Requirements

### Requirement: 标题栏按钮布局包含窗口置顶按钮

**Reason**: 窗口置顶按钮已移至主窗口 TitleBar。Trace 窗口标题栏不再需要独立的置顶按钮。

**Migration**: 标题栏按钮布局更新为：拖拽区域（标题）、展开/折叠全部、跟随最新、保持打开、独立窗口/贴靠左/贴靠右、清除、最小化、最大化/还原、关闭。置顶功能通过主窗口 TitleBar 的全局置顶按钮使用。

## ADDED Requirements

### Requirement: Pin 按钮在贴靠模式下禁用

贴靠模式下，Pin 按钮 SHALL 处于禁用状态，因为贴靠模式已强制 Trace 窗口随主窗口保持可见。当 Trace 窗口退出贴靠模式时，Pin 按钮 SHALL 恢复为进入贴靠前的状态。

#### Scenario: 贴靠模式禁用 Pin 按钮

- **GIVEN** Trace 窗口处于贴靠模式
- **WHEN** 用户查看 Pin 按钮
- **THEN** Pin 按钮 SHALL 显示为禁用状态
- **AND** 按钮 tooltip SHALL 说明贴靠模式下已强制保持打开

#### Scenario: 退出贴靠后恢复 Pin 状态

- **GIVEN** Trace 窗口进入贴靠前 Pin 为激活状态
- **AND** Trace 窗口当前处于贴靠模式
- **WHEN** 用户退出贴靠模式
- **THEN** Pin 按钮 SHALL 恢复为激活状态
- **AND** `isPinned` SHALL 恢复为 `true`
