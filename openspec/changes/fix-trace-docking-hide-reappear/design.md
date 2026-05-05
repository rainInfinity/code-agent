## Context

当前 Trace 窗口贴靠系统通过 `TraceDockingState` 管理贴靠状态（侧边、宽度、置顶等）。当 Trace 窗口处于贴靠模式时，主窗口的 Move/Resize/Focus 事件会触发 `apply_trace_docking()` 重新计算并应用 Trace 窗口的位置和大小。该函数在第 497 行无条件调用 `trace.show()`，确保贴靠的 Trace 窗口始终可见。

问题在于：用户通过主窗口 Trace 按钮或 Trace 窗口关闭按钮调用 `hide_trace_window` 时，仅执行 `trace.hide()` 并发出 `trace-window-closed` 事件，**不清除 `docking.side` 状态**。这导致下一次主窗口事件触发 `apply_trace_docking` 时，Trace 窗口被重新显示。

## Goals / Non-Goals

**Goals:**
- 在贴靠模式下隐藏 Trace 窗口后，主窗口移动/调整大小/获得焦点时 Trace 窗口保持隐藏
- 贴靠模式下 Trace 窗口的关闭按钮能正常工作（隐藏窗口）
- 保留用户的贴靠配置（侧边、宽度），重新打开时恢复贴靠
- 不改变独立窗口模式下的任何行为

**Non-Goals:**
- 不改变主窗口最小化时的 Trace 随同隐藏/恢复行为（`hidden_with_main` 逻辑独立不变）
- 不改变 Trace 窗口拖拽退出贴靠的行为
- 不修改前端代码

## Decisions

### 决策 1：新增 `hidden_while_docked` 标记，而非退出 docking

**选择**：在 `TraceDockingState` 中新增 `hidden_while_docked: bool` 字段。

**备选方案**：在 `hide_trace_window` 中直接调用 `exit_trace_docking` 退出贴靠。

**理由**：
- 保留贴靠配置（侧边、宽度），用户重新打开 Trace 时无需重新设置贴靠模式
- `exit_trace_docking` 会触发位置恢复、置顶恢复、事件发送等较多副作用，仅需隐藏时过于重型
- 与现有的 `hidden_with_main` 模式一致——都是临时隐藏状态，docking 配置保持不变

### 决策 2：`apply_trace_docking` 在隐藏标记下仍更新位置/大小，仅跳过 `show()`

**选择**：`apply_trace_docking` 检测到 `hidden_while_docked` 时，仍执行位置计算、大小约束和 `set_position`/`set_size`，但跳过 `trace.show()`、`trace.set_always_on_top(true)` 和 `trace.set_focus()`。

**备选方案**：检测到标记时完全跳过 `apply_trace_docking`（early return）。

**理由**：
- 确保主窗口移动时，隐藏的 Trace 窗口位置同步更新。用户重新打开时窗口出现在正确位置，不会出现"闪现到旧位置再跳回"的视觉问题
- 窗口隐藏状态下 `set_position`/`set_size` 不会产生视觉副作用

### 决策 3：标记清除时机

- `open_trace_window`：用户主动打开 Trace 时清除标记，恢复正常的贴靠显示
- `exit_trace_docking`：退出贴靠时清除标记（状态重置）
- `set_trace_docking_side`（进入贴靠）：重新进入贴靠时清除标记

## Risks / Trade-offs

- **窗口状态不一致风险**：如果 `window-state.json` 中的 `hiddenWhileDocked` 因崩溃未及时清除，重启后 Trace 打开可能不显示 → 缓解：`open_trace_window` 始终清除标记后再显示，一次正常的打开/关闭循环即可修复
- **与 `hidden_with_main` 的交互**：两者是正交的标记，需要确保不会冲突。`hidden_with_main` 用于主窗口最小化场景（主窗口恢复时自动恢复 Trace），`hidden_while_docked` 用于用户主动隐藏场景（不自动恢复）→ 缓解：两者在不同代码路径设置/清除，互不干扰
- **字段序列化向后兼容**：旧版本 `window-state.json` 没有此字段 → 缓解：使用 `#[serde(default)]`，旧数据默认为 `false`
