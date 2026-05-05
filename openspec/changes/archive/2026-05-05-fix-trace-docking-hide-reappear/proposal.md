## Why

Trace 窗口在贴靠模式下通过主窗口 Trace 按钮或自身关闭按钮隐藏后，docking 状态未被清理。主窗口移动/获得焦点时，`apply_trace_docking` 无条件调用 `trace.show()` 导致 Trace 窗口自动重新显示，用户无法在贴靠模式下正常隐藏 Trace 窗口。

## What Changes

- 在 `TraceDockingState` 中新增 `hidden_while_docked` 字段，标记用户在贴靠模式下主动隐藏 Trace 窗口的意图
- `hide_trace_window` 在贴靠模式下隐藏时，设置 `hidden_while_docked = true` 而非退出 docking
- `apply_trace_docking` 检测到 `hidden_while_docked` 时，跳过 `trace.show()` 调用，但仍更新窗口位置和大小
- `open_trace_window` 打开时清除 `hidden_while_docked` 标记，恢复正常的贴靠显示
- `exit_trace_docking` 退出贴靠时清除 `hidden_while_docked` 标记

## Capabilities

### New Capabilities

<!-- 本次修改不需要新建 capability，所有变更均在已有 spec 范畴内 -->

### Modified Capabilities

- `trace-window-docking`: 新增「贴靠模式下用户主动隐藏 Trace 窗口」的需求，要求隐藏后在主窗口移动/焦点变化时保持隐藏，直到用户重新打开
- `trace-window-lifecycle`: `hide_trace_window` 在贴靠模式下的行为变更——隐藏时保留 docking 配置但标记隐藏意图，而非退出 docking

## Impact

- **Rust 后端**:
  - `src-tauri/src/lib.rs` — `TraceDockingState` 结构体新增字段；`apply_trace_docking` 新增 `hidden_while_docked` 判断；`exit_trace_docking` 清除标记
  - `src-tauri/src/commands.rs` — `hide_trace_window` 设置标记；`open_trace_window` 清除标记
- **前端**: 无需修改（`hideTraceWindow` / `openTraceWindow` IPC 调用不变）
- **持久化**: `window-state.json` 中 `traceDocking` 对象新增 `hiddenWhileDocked` 字段（向后兼容，旧数据缺少时反序列化为 `false`）
