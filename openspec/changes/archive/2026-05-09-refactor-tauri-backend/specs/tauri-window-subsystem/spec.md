## tauri-window-subsystem

Tauri 窗口管理子系统：将 Trace 窗口停靠、窗口状态持久化、窗口生命周期管理从 `lib.rs` 提取到独立的 `window/` 模块中。

### 模块结构

```
window/
├── mod.rs          # 子模块声明 + 公共常量 + 公共类型重新导出
├── state.rs        # 窗口状态持久化
├── docking.rs      # Trace 窗口停靠计算
└── lifecycle.rs    # 窗口事件监听与生命周期
```

### window/state.rs

- SHALL 包含 `WindowState` 结构体及其序列化定义
- SHALL 包含 `load_window_state()`、`save_window_state_for_label()`、`capture_window_state()`、`restore_window_state()` 函数
- SHALL 包含 `PersistedWindowState` 及其加载逻辑
- SHALL 包含窗口位置合法性检查 `is_position_on_screen()`
- SHALL 包含防抖存储逻辑 `schedule_window_state_save()`

### window/docking.rs

- SHALL 包含 `TraceDockingState` 结构体、`TraceDockingSnapshot`、`TraceDockingSide` 枚举
- SHALL 包含停靠状态持久化函数（`load_trace_docking_state`、`save_trace_docking_state`）
- SHALL 包含停靠计算函数：`calculate_trace_docking_bounds()`、`clamp_trace_docking_width()`
- SHALL 包含停靠操作函数：`apply_trace_docking()`、`exit_trace_docking()`、`set_trace_docking_side()`
- SHALL 包含停靠辅助函数：`sync_trace_docking_width()`、`hide_trace_for_main_minimize()`、`schedule_trace_docking_width_sync()`
- SHALL 包含 `set_trace_always_on_top_state()`

### window/lifecycle.rs

- SHALL 包含 `setup_window_state()` 函数（Tauri setup 回调中的窗口初始化）
- SHALL 包含 `setup_trace_window_state()` 函数
- SHALL 包含 `save_trace_window_state()`、`restore_trace_window_state()` 函数
- SHALL 包含 `close_trace_window()` 函数
- SHALL 包含窗口事件监听器的注册逻辑

### 常量集中定义

- `window/mod.rs` SHALL 统一定义所有 Trace 窗口相关常量：`TRACE_WINDOW_LABEL`、`TRACE_DOCKING_DEFAULT_WIDTH`、`TRACE_DOCKING_MIN_WIDTH`、`TRACE_DOCKING_MAX_WIDTH`、`TRACE_DOCKING_RESIZE_SYNC_MS`、`DOCKING_DRAG_EXIT_THRESHOLD_MS`、`MAIN_TITLE_BAR_HEIGHT`、`MAIN_TRACE_GAP`
- 其他模块 SHALL 通过 `use crate::window::*` 引用这些常量，不再重复定义

### 约束

- `window/` 模块 SHALL NOT 依赖 `commands/`、`agent/`、`providers/`、`prompt/`、`tools/` 模块
- `window/` 模块 SHALL 仅依赖 `tauri` crate 和 `std` 标准库
- 每个子文件 SHALL NOT 超过 300 行
