## REMOVED Requirements

### Requirement: 窗口置顶按钮

**Reason**: 窗口置顶按钮职责转移至主窗口 TitleBar（参见 `main-window-always-on-top`）。Trace 窗口不再独立控制自身的 always-on-top 状态。

**Migration**: 置顶功能由主窗口 TitleBar 的新置顶按钮统一控制。Trace 窗口的 `alwaysOnTop` 状态通过主窗口 `set_main_always_on_top` command 间接管理。

### Requirement: 置顶状态不持久化

**Reason**: 置顶功能转移至主窗口，对应的不持久化要求已在新 spec `main-window-always-on-top` 中定义。

**Migration**: 参见 `main-window-always-on-top` spec。

### Requirement: 置顶功能与保持打开功能独立

**Reason**: 置顶按钮已从 Trace 窗口移除，"保持打开"功能（Pin）不再需要与置顶功能共存于同一窗口。Pin 按钮的新行为在 `trace-pin-window` delta spec 中定义。

**Migration**: Pin 功能不受影响，仅解除了与 alwaysOnTop 的联动。
