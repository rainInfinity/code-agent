## Context

当前贴靠模式在 `src-tauri/src/lib.rs` 中实现，核心流程：

1. **进入贴靠** → `set_trace_docking_side` 设置 `docking.side` → `apply_trace_docking` 计算并设置 Trace 窗口位置/尺寸
2. **位置跟随** → 主窗口 `Moved`/`Resized`/`Focused` 事件触发 `apply_trace_docking` 重新同步
3. **宽度同步** → Trace 窗口 `Resized` 事件经 160ms 去抖后调用 `sync_trace_docking_width`
4. **退出贴靠** → 前端 `startDragging` 调用 `exitTraceDocking()` → Rust `exit_trace_docking` 清除 side 并恢复窗口状态
5. **最大化内侧贴靠** → `calculate_trace_docking_bounds` 中 `main_maximized` 决定 Trace 放主窗口内侧/外侧

三个 bug 分别对应上述流程的三个环节：
- Bug 1：步骤 4 的退出判定太灵敏（`onMouseDown` 即退出）
- Bug 2：步骤 3 的约束方案太被动（事后 clamp 而非事先限制）
- Bug 3：步骤 5 缺少对主窗口自定义标题栏的空间预留

## Goals / Non-Goals

**Goals:**
- 仅拖拽标题栏（窗口实际移动）才退出贴靠，单击不退出
- 贴靠模式下 OS 级锁定 Trace 窗口尺寸，消除拖拽后的突变
- 主窗口最大化时 Trace 窗口不遮挡主窗口标题栏按钮

**Non-Goals:**
- 不改变贴靠模式的核心架构（Rust 侧权威、前端消费状态）
- 不修改进入贴靠的逻辑（按钮、快捷键等）
- 不引入新的 IPC 命令或事件
- 不改变贴靠宽度持久化逻辑

## Decisions

### 1. 拖拽退出判定移至 Rust Moved 事件层

**选择**：在 Rust 侧 Trace 窗口 `WindowEvent::Moved` 处理中，使用时间戳区分程序化位置同步和用户拖拽。`apply_trace_docking` 设置位置后记录时间戳，`Moved` 事件触发时若距上次程序化设置超过阈值（150ms），则判定为用户拖拽并自动退出贴靠。

**前端变更**：`startDragging` 不再调用 `exitTraceDocking`，统一调用 `window.startDragging()`。

**理由**：
- `Tauri` 的 `startDragging()` 是异步、调用即返回的 API，前端无法可靠感知拖拽何时开始和结束
- 在 OS 窗口事件层判定拖拽更准确，`Moved` 事件天然区分"窗口被移动了"和"窗口没动"
- 时间戳守卫防止 `apply_trace_docking` 自身触发的 `Moved` 事件导致错误退出

**备选**：前端用 `mousemove` 事件检测拖拽阈值（>3px）再调用 `exitTraceDocking`。淘汰原因：与 `startDragging()` 配合复杂，且无法在 `startDragging()` 完成后可靠调用。

### 2. OS 层尺寸约束替代事后 clamp

**选择**：贴靠模式下，在 `apply_trace_docking` 中调用 `trace.set_min_inner_size` 和 `trace.set_max_inner_size`，将宽度锁定在 [580, 800] 范围，高度锁定为主窗口高度（精确值，min = max）。退出贴靠时在 `exit_trace_docking` 中恢复原始约束。

**理由**：
- OS 级别约束让系统窗口管理器在用户拖拽时就阻止超出范围，而非事后拉回
- 消除了"拖拽 → 松开 → 突变"的视觉跳变
- Tauri `WebviewWindow` 提供 `set_min_inner_size` / `set_max_inner_size` API，无需额外依赖

**备选**：实时同步（无去抖）clamp。淘汰原因：仍然会有"拖拽中自由、松手后跳回"的问题，且高频 `set_size` 调用性能差。

**宽度同步事件变更**：保留 `schedule_trace_docking_width_sync`（用于用户拖宽后保存新宽度），但移除其中的 `apply_trace_docking` 调用，因为尺寸已被 OS 约束，无需重新应用位置。仅需更新 `docking.attached_width` 并持久化。

### 3. 最大化时标题栏高度偏移

**选择**：在 `calculate_trace_docking_bounds` 中新增 `main_title_bar_height` 参数（常量 `MAIN_TITLE_BAR_HEIGHT: u32 = 42`）。当 `main_maximized == true` 时，Trace 窗口 y 坐标下移 `42` 物理像素，高度减去 `42` 物理像素。

**理由**：
- 42px 是主窗口 TitleBar 组件的高度 (`TITLEBAR_HEIGHT = 42` in `TitleBar.tsx`)
- 两个窗口都使用 `decorations(false)`，`inner_size` 返回的物理像素尺寸包含 web 内容全高
- 仅在最大化时需要偏移，因为非最大化时 Trace 在主窗口外侧，不存在遮挡问题

**风险**：`inner_size` 返回 `PhysicalSize`（物理像素），在高 DPI 下 42 逻辑像素可能对应 84 或更多物理像素。但 `PhysicalSize` 实际上是 web 内容的物理尺寸，Tauri 的 `inner_position` 和 `inner_size` 在 Windows 上已经包含了 DPI 缩放，42px 在 webview 中渲染为 42 物理像素（因为 webview 内容本身已经按 DPI 渲染）。需在实现时验证。

## Risks / Trade-offs

- [Risk] 拖拽退出判定阈值 150ms 可能在慢设备上误判程序化位置同步为用户拖拽。→ 阈值可调整为 200-250ms，留有足够余量。
- [Risk] `set_max_inner_size` 在某些平台/WM 上可能行为不一致。→ 在 Windows 上验证为主要目标；macOS/Linux 同样支持此 API。
- [Risk] 标题栏高度 42px 硬编码于 Rust 和前端两处，未来改动需同步。→ 考虑后续提取为共享常量或配置，但当前范围不做此优化。
- [Risk] 退出贴靠时的 `set_max_inner_size` 恢复需找到合适的"无限制"值。→ 使用 `f64::MAX` 或 `i32::MAX` 作为恢复值即可。
