# window-init-optimization Specification

## ADDED Requirements

### Requirement: Window shall appear at saved size without flash

应用窗口 SHALL 在首次可见时即为保存的尺寸，不应出现从默认尺寸跳变到保存尺寸的视觉闪烁。

#### Scenario: App launch with saved window state

- **WHEN** 用户启动应用
- **AND** 存在有效的窗口状态文件（window-state.json）
- **THEN** 窗口首次渲染即为保存的尺寸和位置
- **AND** 用户看不到窗口尺寸的变化过程

#### Scenario: First launch without saved state

- **WHEN** 用户首次启动应用（无 window-state.json）
- **THEN** 窗口以 tauri.conf.json 中配置的默认尺寸（1200x800）居中显示
- **AND** 窗口正常可见，无闪烁

#### Scenario: Saved maximized state

- **WHEN** 用户上次关闭时窗口为最大化状态
- **AND** 用户重新启动应用
- **THEN** 窗口恢复为最大化状态
- **AND** 首次可见时即为最大化

### Requirement: Window state shall still be persisted on resize and close

窗口尺寸和位置变更 SHALL 继续在窗口移动、调整大小和关闭时持久化保存。

#### Scenario: Save state on resize

- **WHEN** 用户调整窗口大小
- **THEN** 在 debounce（500ms）后将新尺寸保存到 window-state.json

#### Scenario: Save state on move

- **WHEN** 用户移动窗口
- **THEN** 在 debounce（500ms）后将新位置保存到 window-state.json

#### Scenario: Save state on close

- **WHEN** 用户关闭窗口
- **THEN** 立即保存当前窗口状态到 window-state.json

### Requirement: Window hidden state shall not affect loading experience

窗口隐藏到显示的过程 SHALL NOT 引入可感知的延迟或空白屏幕。

#### Scenario: App shows within acceptable time

- **WHEN** 应用启动
- **THEN** 窗口在 setup 完成后 200ms 内显示
- **AND** 窗口显示时前端已完成首帧渲染
