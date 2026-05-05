## 1. Rust 后端 — 窗口状态持久化扩展

- [x] 1.1 `src-tauri/src/lib.rs`: `WindowState` 存储格式从单个对象改为 `HashMap<String, WindowState>`（key 为窗口 label）
- [x] 1.2 `src-tauri/src/lib.rs`: `load_window_state` 兼容旧版 JSON 格式（单个对象自动迁移为 HashMap）
- [x] 1.3 `src-tauri/src/lib.rs`: `capture_window_state` / `save_window_state` / `restore_window_state` 改为接受 label 参数
- [x] 1.4 `src-tauri/src/lib.rs`: `schedule_window_state_save` 支持传入 label 参数
- [x] 1.5 `src-tauri/src/lib.rs`: 新增 `setup_trace_window_state(trace_window)` 函数，注册 `Moved`/`Resized` 防抖保存和 `CloseRequested` 立即保存
- [x] 1.6 `src-tauri/src/lib.rs`: 主窗口 `setup_window_state` 适配新 HashMap 格式

## 2. Rust 后端 — Trace 窗口生命周期更新

- [x] 2.1 `src-tauri/src/commands.rs`: `open_trace_window` 命令签名新增 `conversation_id: Option<String>` 参数
- [x] 2.2 `src-tauri/src/commands.rs`: 构建 URL 时拼入 `conversationId` 参数（若提供）→ `index.html?window=trace&conversationId=xxx`
- [x] 2.3 `src-tauri/src/commands.rs`: 窗口创建后调用 `setup_trace_window_state`（从 lib.rs 暴露）
- [x] 2.4 `src-tauri/src/commands.rs`: 窗口创建时读取 `window-state.json` 恢复状态（若存在），替代 `.center()` + 默认尺寸
- [x] 2.5 `src-tauri/src/commands.rs`: `hide_trace_window` 在 `.hide()` 前调用 `save_window_state` 保存当前状态
- [x] 2.6 `src-tauri/src/lib.rs`: 注册 `open_trace_window` 的新参数签名

## 3. Rust 后端 — 窗口置顶命令

- [x] 3.1 `src-tauri/src/commands.rs`: 新增 `set_trace_always_on_top(app: AppHandle, always_on_top: bool)` 命令
- [x] 3.2 命令实现：查找 trace 窗口，调用 `window.set_always_on_top(always_on_top)`
- [x] 3.3 `src-tauri/src/lib.rs`: 注册 `set_trace_always_on_top` 到 invoke handler

## 4. 前端类型和 Store

- [x] 4.1 `src/types/index.ts`: `ChatState` 接口新增 `isTracePinned: boolean` 字段和 `setTracePinned(isPinned: boolean)` action
- [x] 4.2 `src/stores/chatStore.ts`: 实现 `isTracePinned` 状态和 `setTracePinned` action
- [x] 4.3 `src/stores/chatStore.ts`: `partialize` 新增 `isTracePinned` 字段序列化
- [x] 4.4 `src/stores/chatStore.ts`: `merge` 恢复 `isTracePinned`（默认 `false`）
- [x] 4.5 `src/stores/traceStore.ts`: `isPinned` 改为从 chatStore 读取，`setPinned` 改为写入 chatStore
- [x] 4.6 `src/types/index.ts`: `TraceState` 新增 `alwaysOnTop: boolean` 和 `setAlwaysOnTop(value: boolean)` action

## 5. 前端 IPC 层

- [x] 5.1 `src/hooks/useIpc.ts`: 新增 `setTraceAlwaysOnTop(alwaysOnTop: boolean)` 命令封装
- [x] 5.2 `src/hooks/useIpc.ts`: `openTraceWindow` 命令签名更新，传入 `conversationId` 参数
- [x] 5.3 `src/hooks/useIpc.ts`: 新增 `emitTraceWindowReady()` 事件发射函数
- [x] 5.4 `src/hooks/useIpc.ts`: 新增 `onTraceWindowReady(callback)` 事件监听函数

## 6. TracePanel 标题栏 — 按钮布局更新

- [x] 6.1 `src/components/Trace/TracePanel.tsx`: 标题栏在 Pin 按钮后新增"窗口置顶"按钮（独立图标）
- [x] 6.2 窗口置顶按钮点击回调：切换 `alwaysOnTop` 状态，调用 `setTraceAlwaysOnTop`
- [x] 6.3 窗口置顶按钮激活态高亮样式（复用现有 `$active` prop 模式）
- [x] 6.4 `isPinned` 状态改为从 chatStore 读取
- [x] 6.5 标题栏按钮顺序调整：Pin → 窗口置顶 → 清除 → 最小化 → 最大化 → 关闭

## 7. 修复竞态条件 — useTraceIpc 初始化

- [x] 7.1 `src/hooks/useTraceIpc.ts`: `install()` 完成后检查 `conversationId` 是否仍为 null
- [x] 7.2 若 conversationId 为 null，从 URL 参数 `conversationId` 读取并调用 `reset(conversationId)`
- [x] 7.3 若 URL 参数也不存在，emit `trace-window-ready` 事件请求主窗口重新同步

## 8. StatusBar 同步修复

- [x] 8.1 `src/components/Layout/StatusBar.tsx`: `toggleTrace` 中 `openTraceWindow()` 传入 `activeConversationId`
- [x] 8.2 `src/components/Layout/StatusBar.tsx`: `toggleTrace` 中打开窗口后显式调用 `emitTraceConversationChanged`
- [x] 8.3 `src/components/Layout/StatusBar.tsx`: 新增 `onTraceWindowReady` 监听器，收到事件后重新 emit conversationId
- [x] 8.4 `src/components/Layout/StatusBar.tsx`: `syncTraceWindow` 中 `openTraceWindow()` 传入 `activeConversationId`

## 9. i18n

- [x] 9.1 `src/i18n/zh-CN.ts`: `trace.pin` 文案从 `'置顶'` 改为 `'保持打开'`
- [x] 9.2 `src/i18n/zh-CN.ts`: `trace.pinTooltip` 文案从 `'置顶 Trace 窗口'` 改为 `'切换对话时保持 Trace 窗口打开'`
- [x] 9.3 `src/i18n/zh-CN.ts`: 新增 `trace.alwaysOnTop` 文案 `'窗口置顶'`
- [x] 9.4 `src/i18n/zh-CN.ts`: 新增 `trace.alwaysOnTopTooltip` 文案 `'将 Trace 窗口置于其他窗口之上'`

## 10. 验证

- [ ] 10.1 调整 Trace 窗口大小和位置 → 关闭 → 重新打开 → 验证位置和尺寸恢复
- [ ] 10.2 最大化 Trace 窗口 → 关闭 → 重新打开 → 验证最大化状态恢复
- [ ] 10.3 重启应用 → 打开 Trace → 验证大小/位置恢复
- [ ] 10.4 点击窗口置顶按钮 → 验证 Trace 窗口置顶于其他窗口之上
- [ ] 10.5 再次点击窗口置顶按钮 → 验证取消置顶
- [ ] 10.6 重启应用 → 打开 Trace → 验证置顶状态不持久化（默认非置顶）
- [ ] 10.7 同时在活跃对话有历史 Trace 数据 → 重启应用 → 打开 Trace → 验证数据正确加载
- [ ] 10.8 激活"保持打开" → 切换对话 → 验证 Trace 保持打开并加载新对话数据
- [ ] 10.9 验证"保持打开"和"窗口置顶"两个按钮独立运作
- [ ] 10.10 旧版 `window-state.json` 格式（单个对象）→ 启动应用 → 验证自动迁移
- [ ] 10.11 外接显示器断开后重启 → 验证窗口回退到可见屏幕
