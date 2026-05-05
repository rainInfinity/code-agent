## Why

Trace 窗口是 Agent 调试的核心工具，但当前实现存在 4 个严重 bug：窗口白屏无法渲染、打开后主窗口冻结、对话卡死、以及开关按钮不可靠。根因集中在窗口创建参数缺失和组件路由检测失效，导致 Trace 窗口错误地渲染了主应用组件，进而引发 WebView2 共享 GPU 进程阻塞，拖垮所有窗口。

此外，当前 Trace 窗口贴附在主窗口右侧的设计不够灵活，应改为类似浏览器 F12 DevTools 的独立窗口风格——可自由拖拽、独立调整大小、独立最小化/最大化，但主窗口关闭时跟随关闭。

## What Changes

- **Rust 后端 (commands.rs)**：Trace 窗口 URL 增加 `?window=trace` 查询参数；`.decorations(false)` 移除原生标题栏；窗口不再计算主窗口位置，使用独立默认尺寸和位置；`close_trace_window` 改用 `.hide()` 替代 `.close()`，消除销毁/重建竞态
- **前端 (main.tsx)**：重构 `isTraceWindow()` 检测逻辑，以 URL 参数为优先判定依据，`getCurrentWebviewWindow()` 作为辅助（用于 HMR 开发场景），消除模块顶层 IPC 调用失败的不可靠性
- **前端 (TracePanel.tsx)**：新增自定义标题栏组件，包含可拖拽区域、窗口标题、以及最小化/最大化/关闭三件套按钮
- **前端 (StatusBar.tsx)**：toggle 逻辑改用 `hide_trace_window` 命令，保持按钮状态与窗口可见性同步
- **主窗口关闭处理**：主窗口 `CloseRequested` 时调用 `.close()` 彻底销毁 Trace 窗口

## Capabilities

### New Capabilities

- `trace-window-lifecycle`: Trace 窗口的创建、显示、隐藏、关闭生命周期管理，包含 URL 参数路由和自定义标题栏（含最小化/最大化/关闭按钮）

### Modified Capabilities

- `agent-frontend`: Trace 窗口的 `isTraceWindow()` 路由检测逻辑变更，不影响主窗口功能

## Impact

- **Rust 后端**: `src-tauri/src/commands.rs` — `open_trace_window`, `close_trace_window`; `src-tauri/src/lib.rs` — `close_trace_window` 调用
- **前端核心**: `src/main.tsx` — `isTraceWindow()` 检测逻辑重写
- **前端组件**: `src/components/Trace/TracePanel.tsx` — 新增自定义标题栏（含窗口控制按钮）; `src/components/Layout/StatusBar.tsx` — toggle 逻辑调整
- **权限配置**: `src-tauri/capabilities/default.json` — trace 窗口已包含在 windows 列表中，可能需要追加 `allow-minimize`、`allow-toggle-maximize` 权限
- **i18n**: `src/i18n/zh-CN.ts` — 新增 trace 窗口控制按钮的提示文本
