## Why

Trace 窗口当前缺少窗口状态持久化（大小/位置记忆重启丢失），且标题栏的"置顶"按钮实际实现的是"跨对话保持打开"而非真正的窗口置顶（Always on Top）。此外，重启应用后 Trace 窗口重新创建时存在竞态条件：主窗口 emit 的 `trace-conversation-changed` 事件可能在 Trace 窗口监听器安装完成前到达，导致持久化的 trace 数据无法正常加载展示。

## What Changes

- **Trace 窗口大小/位置记忆**：扩展 `lib.rs` 中现有的 `WindowState` 持久化机制，同时存储主窗口和 Trace 窗口的状态到 `window-state.json`。Trace 窗口创建时恢复上次的大小和位置，运行时防抖保存变更
- **真正的窗口置顶按钮**：在 Trace 窗口标题栏新增独立的"窗口置顶"按钮，调用 Tauri `set_always_on_top(true/false)` API。与现有的"跨对话保持打开"（📌 Pin）按钮功能分离
- **i18n 文案修正**：将现有 Pin 按钮的文案从"置顶"改为"保持打开"，新按钮使用"窗口置顶"
- **修复重启后数据加载竞态**：`toggleTrace` 增加显式的 `emitTraceConversationChanged` 调用，`useTraceIpc` 在监听器安装完成后主动查询当前 conversationId，确保 Trace 窗口总能正确加载数据
- **isPinned 状态持久化**：将 `isPinned` 持久化到 chatStore（localStorage），避免 Trace 窗口关闭后 pin 状态丢失

## Capabilities

### New Capabilities

- `trace-window-state`: Trace 窗口大小和位置的持久化记忆，随 `window-state.json` 存储和恢复
- `trace-window-always-on-top`: Trace 窗口真正的窗口置顶功能，调用系统级 `set_always_on_top` API

### Modified Capabilities

- `trace-window-lifecycle`: 窗口创建时恢复持久化的大小/位置，运行时防抖保存；修复初始化事件竞态
- `trace-pin-window`: Pin 按钮文案从"置顶"改为"保持打开"，标题栏新增独立的"窗口置顶"按钮；`isPinned` 状态持久化

## Impact

- **Rust 后端**: `src-tauri/src/lib.rs` — `WindowState` 扩展为 HashMap 按 label 存储，适配 save/restore 逻辑
- **Rust 后端**: `src-tauri/src/commands.rs` — `open_trace_window` 恢复 trace 状态，新增 `set_trace_always_on_top` 命令
- **前端组件**: `src/components/Trace/TracePanel.tsx` — 标题栏新增置顶按钮，调整按钮布局
- **前端 Store**: `src/stores/traceStore.ts` — `isPinned` 改为从 chatStore 持久化
- **前端 Store**: `src/stores/chatStore.ts` — 新增 `isTracePinned` 字段和 setter
- **前端 IPC**: `src/hooks/useIpc.ts` — 新增 `setTraceAlwaysOnTop` 命令，新增 `onTraceWindowShown` 事件监听
- **前端 Hook**: `src/hooks/useTraceIpc.ts` — 监听器安装完成后触发数据同步
- **前端组件**: `src/components/Layout/StatusBar.tsx` — `toggleTrace` 增加显式 emit
- **i18n**: `src/i18n/zh-CN.ts` — 修正 pin/pinTooltip 文案，新增 alwaysOnTop/alwaysOnTopTooltip
- **类型**: `src/types/index.ts` — TraceState 新增 `alwaysOnTop` 字段
