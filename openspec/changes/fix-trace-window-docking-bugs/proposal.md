## Why

Trace 窗口贴靠模式在 `add-trace-window-docking` 中实现后，存在三个影响用户体验的 bug：单击标题栏意外退出贴靠、拖拽窗口边缘时的尺寸突变跳回、以及主窗口最大化时 Trace 遮挡标题栏控制按钮。这些问题削弱了贴靠模式的可用性，需要针对性修复。

## What Changes

- **修复点击退出贴靠**：将退出贴靠的判定从前端 `onMouseDown` 移至 Rust 侧 Trace 窗口 `Moved` 事件，仅在检测到用户拖拽（非程序化位置同步）时才退出贴靠，单击标题栏不再触发退出。
- **修复尺寸拖拽突变**：贴靠模式下通过 `set_min_inner_size` / `set_max_inner_size` 在 OS 层级锁定 Trace 窗口尺寸约束，高度锁定为主窗口高度，宽度限制在 [580, 800] 范围，消除拖拽后的跳变。
- **修复最大化遮挡**：主窗口最大化时，`calculate_trace_docking_bounds` 中将 Trace 窗口高度减去主窗口标题栏高度 (42 逻辑像素)，y 坐标下移对应距离，确保主窗口标题栏按钮始终可见。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `trace-window-docking`: 贴靠模式下拖拽退出判定从"点击标题栏"改为"用户实际拖拽窗口"；贴靠尺寸约束从"事后 clamp"改为"OS 级事先锁定"；最大化时 Trace 高度需避开主窗口标题栏区域。

## Impact

- **Rust 后端**：`src-tauri/src/lib.rs` — `calculate_trace_docking_bounds` 增加最大化高度偏移；`setup_trace_window_state` 的 `Moved` 事件增加用户拖拽检测和自动退出贴靠；`apply_trace_docking` 增加 OS 级 size 约束设置；`exit_trace_docking` 恢复原始 size 约束。
- **前端**：`src/components/Trace/TracePanel.tsx` — `startDragging` 移除贴靠模式的 `exitTraceDocking` 调用。
