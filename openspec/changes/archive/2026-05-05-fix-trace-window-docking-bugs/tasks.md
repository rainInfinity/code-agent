## 1. 修复拖拽退出贴靠判定（Bug 1）

- [x] 1.1 在 `lib.rs` 中添加 `LAST_TRACE_DOCKING_APPLY_MS` 静态原子时间戳和 `DOCKING_DRAG_EXIT_THRESHOLD_MS` 常量，在 `apply_trace_docking` 设置 Trace 窗口位置后更新该时间戳
- [x] 1.2 修改 `setup_trace_window_state` 中 Trace 窗口的 `WindowEvent::Moved` 处理：贴靠模式下检测到用户拖拽（距上次程序化设置超过 150ms 且窗口确实移动）时自动调用 `exit_trace_docking`
- [x] 1.3 修改 `TracePanel.tsx` 的 `startDragging`：移除贴靠模式下的 `exitTraceDocking` 调用，统一只调用 `window.startDragging()`，并移除未使用的 `exitTraceDocking` 导入

## 2. 修复贴靠尺寸拖拽突变（Bug 2）

- [x] 2.1 修改 `apply_trace_docking`：设置 Trace 窗口位置后，调用 `set_min_size` 和 `set_max_size` 锁定高度为主窗口高度、宽度限制在 [580, 800]
- [x] 2.2 修改 `exit_trace_docking`：恢复原始 min/max 尺寸约束（min: 580x400, max: None）
- [x] 2.3 简化 `sync_trace_docking_width`：移除 `apply_trace_docking` 调用，仅持久化 `attached_width` 并发出变更事件

## 3. 修复主窗口最大化时 Trace 遮挡标题栏（Bug 3）

- [x] 3.1 在 `lib.rs` 中添加 `MAIN_TITLE_BAR_HEIGHT` 常量（42），修改 `calculate_trace_docking_bounds`：当 `main_maximized == true` 时，y 坐标下移 `MAIN_TITLE_BAR_HEIGHT`，高度减去 `MAIN_TITLE_BAR_HEIGHT`

## 4. 验证

- [ ] 4.1 验证贴靠模式下单击 Trace 标题栏不会退出贴靠
- [ ] 4.2 验证贴靠模式下拖拽 Trace 标题栏会退出贴靠并正常拖拽独立窗口
- [ ] 4.3 验证贴靠模式下拖拽窗口边缘无法超出 [580, 800] 宽度范围，无突变
- [ ] 4.4 验证贴靠模式下拖拽窗口边缘无法改变高度
- [ ] 4.5 验证主窗口最大化时 Trace 不遮挡主窗口标题栏按钮
- [ ] 4.6 验证主窗口从最大化恢复时 Trace 恢复正常贴靠
- [ ] 4.7 验证退出贴靠后 Trace 窗口恢复正常尺寸约束
