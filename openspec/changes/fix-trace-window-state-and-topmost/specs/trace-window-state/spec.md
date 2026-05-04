# trace-window-state Specification

## ADDED Requirements

### Requirement: Trace 窗口大小和位置持久化

Trace 窗口的大小和位置 SHALL 持久化到 `window-state.json` 文件中，与主窗口状态一同存储。`window-state.json` SHALL 使用 `HashMap<String, WindowState>` 格式，key 为窗口 label。

#### Scenario: 首次打开 Trace 窗口使用默认尺寸

- **GIVEN** 应用首次启动，无 `window-state.json` 文件或文件中无 `trace` key
- **WHEN** 用户打开 Trace 窗口
- **THEN** Trace 窗口 SHALL 使用默认尺寸 420×600
- **AND** 窗口 SHALL 在屏幕上居中显示

#### Scenario: 调整大小后重启恢复

- **GIVEN** 用户上次使用时将 Trace 窗口调整为 800×500，位置在 (200, 150)
- **AND** 应用正常关闭，窗口状态已保存
- **WHEN** 用户重新启动应用并打开 Trace 窗口
- **THEN** Trace 窗口 SHALL 恢复为 800×500 尺寸
- **AND** Trace 窗口 SHALL 恢复位置到 (200, 150)

#### Scenario: 最大化状态恢复

- **GIVEN** 用户上次使用时 Trace 窗口处于最大化状态
- **WHEN** 用户重新启动应用并打开 Trace 窗口
- **THEN** Trace 窗口 SHALL 恢复为最大化状态
- **AND** 标题栏的最大化按钮 SHALL 显示还原图标

#### Scenario: 窗口移动后防抖保存

- **GIVEN** Trace 窗口已创建并可见
- **WHEN** 用户拖拽窗口到新位置
- **THEN** 系统 SHALL 在最后一次移动/调整事件后约 500ms 保存窗口状态
- **AND** 连续快速拖拽时 SHALL NOT 每次移动都触发写盘

#### Scenario: 隐藏窗口前保存状态

- **GIVEN** Trace 窗口当前可见
- **WHEN** 用户点击 Trace 窗口的关闭按钮（调用 `hide_trace_window`）
- **THEN** 当前窗口状态 SHALL 在隐藏前保存到 `window-state.json`
- **AND** 下次调用 `open_trace_window` 时 SHALL 恢复该状态

#### Scenario: 主窗口关闭时级联保存

- **GIVEN** Trace 窗口当前可见或隐藏
- **WHEN** 用户关闭主窗口（触发 `CloseRequested`）
- **THEN** Trace 窗口的最终状态 SHALL 保存到 `window-state.json`
- **AND** Trace 窗口 SHALL 被彻底关闭（`.close()`）

#### Scenario: 屏幕边界校验

- **GIVEN** 保存的 Trace 窗口位置位于所有可用屏幕之外（如外接显示器断开）
- **WHEN** 应用启动并尝试恢复 Trace 窗口位置
- **THEN** 系统 SHALL 跳过位置恢复
- **AND** Trace 窗口 SHALL 使用默认尺寸并在当前可用屏幕上居中

### Requirement: 旧版 WindowState 格式向后兼容

系统 SHALL 兼容旧版 `window-state.json` 格式（单个 `WindowState` 对象），并在首次加载后自动迁移为新格式。

#### Scenario: 旧版格式自动迁移

- **GIVEN** `window-state.json` 包含旧版格式 `{ "x": 100, "y": 100, "width": 1200, "height": 800, "maximized": false }`
- **WHEN** 应用启动并加载窗口状态
- **THEN** 主窗口 SHALL 恢复旧版格式中的状态
- **AND** 下次保存时文件 SHALL 自动变为 `{ "main": { ... } }` 格式
