# trace-pin-window Specification

## MODIFIED Requirements

### Requirement: Pin Button in Trace Title Bar

Trace 窗口自定义标题栏 SHALL 在"窗口置顶"按钮左侧包含一个"保持打开"（Pin）按钮。Pin 按钮 SHALL 具有激活/未激活两种视觉状态。Pin 按钮的 i18n 文案 SHALL 使用"保持打开"而非"置顶"。

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

## ADDED Requirements

### Requirement: 标题栏按钮布局包含窗口置顶按钮

Trace 窗口自定义标题栏 SHALL 在"保持打开"按钮和"清除"按钮之间包含一个独立的"窗口置顶"按钮。两个按钮 SHALL 可独立激活/关闭，互不影响。

#### Scenario: 标题栏按钮完整布局

- **GIVEN** Trace 窗口已打开
- **WHEN** 窗口渲染完成
- **THEN** 标题栏从左到右依次显示：拖拽区域（标题）、保持打开按钮、窗口置顶按钮、清除按钮、最小化按钮、最大化/还原按钮、关闭按钮

#### Scenario: 两个按钮独立操作

- **GIVEN** "保持打开"按钮已激活
- **WHEN** 用户点击"窗口置顶"按钮
- **THEN** "窗口置顶"按钮 SHALL 切换为激活状态
- **AND** "保持打开"按钮 SHALL 保持激活状态不变
