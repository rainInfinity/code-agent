## 1. 数据模型变更

- [x] 1.1 `TraceDockingState` 结构体新增 `hidden_while_docked` 字段（`lib.rs`），使用 `#[serde(default)]` 确保向后兼容
- [x] 1.2 `TraceDockingState::Default` 实现中初始化 `hidden_while_docked: false`

## 2. 核心逻辑修改

- [x] 2.1 `hide_trace_window`（`commands.rs`）：贴靠模式下设置 `hidden_while_docked = true` 并持久化，不清除 `docking.side`
- [x] 2.2 `apply_trace_docking`（`lib.rs`）：检测 `hidden_while_docked` 标记，跳过 `trace.show()`、`trace.set_always_on_top(true)` 和 `trace.set_focus()`，但仍执行位置/大小更新
- [x] 2.3 `open_trace_window`（`commands.rs`）：在显示窗口前清除 `hidden_while_docked` 标记

## 3. 状态清理

- [x] 3.1 `exit_trace_docking`（`lib.rs`）：退出贴靠时清除 `hidden_while_docked` 标记
- [x] 3.2 `set_trace_docking_side`（`lib.rs`）：进入贴靠模式时清除 `hidden_while_docked` 标记

## 4. 验证

- [x] 4.1 `cargo check` 编译通过，无警告
- [x] 4.2 验证 `window-state.json` 中旧数据（无 `hiddenWhileDocked` 字段）可正常反序列化

## 5. 前端停靠状态同步（新增）

- [x] 5.1 `useChatStore` 新增 `isTraceDocked` 字段（`chatStore.ts`）
- [x] 5.2 主窗口 `StatusBar` 监听 `trace-docking-changed` 事件，同步 `isTraceDocked` 到 `chatStore`（`StatusBar.tsx`）
- [x] 5.3 修改 `syncTraceWindow` 会话切换逻辑：`isDocked` 为 `true` 时不隐藏 Trace 窗口（`StatusBar.tsx`）
