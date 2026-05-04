## Context

当前 Trace 窗口通过 `WebviewUrl::App("index.html".into())` 加载与主窗口相同的入口文件，依赖 `main.tsx` 中的 `isTraceWindow()` 函数通过 `getCurrentWebviewWindow().label` 进行路由区分。但该函数在模块顶层（React 渲染之前）同步调用，此时 Tauri IPC 桥可能尚未完全初始化，且 URL 中无 fallback 查询参数，导致检测失败。Trace 窗口错误渲染 `<App />`（完整主应用），引发 WebView2 共享 GPU 进程阻塞，主窗口随之冻结。

此外，窗口生命周期使用 `.close()` 销毁 + 重建模式，存在竞态：关闭后 `get_webview_window` 可能返回僵尸引用，导致 `show()` 失败。`.decorations(true)` 给 Trace 窗口添加了原生标题栏，与主窗口的无边框设计不一致。

当前设计将 Trace 窗口定位在主窗口右侧、高度与主窗口一致，这种贴附式布局限制了窗口的独立性和灵活性。用户期望类似浏览器 F12 DevTools 的独立窗口体验——可自由拖拽到任意显示器、独立调整大小、独立最小化/最大化，但主窗口关闭时所有窗口关闭。

## Goals / Non-Goals

**Goals:**
- Trace 窗口可靠地渲染 `<TraceApp />` 而非 `<App />`
- Trace 窗口无原生标题栏，使用自定义 React 标题栏（含拖拽区域、窗口标题、以及最小化/最大化/关闭按钮）
- Trace 窗口作为独立窗口，不贴附主窗口，可自由定位和调整大小
- 窗口开关按钮可靠工作，消除竞态
- 打开 Trace 窗口后，主窗口的拖拽、关闭、对话等功能不受影响
- 主窗口关闭时，Trace 窗口一并彻底销毁

**Non-Goals:**
- Trace 窗口内部功能增强（如 TurnCard 渲染优化、thinking 展示优化等）
- 多 Trace 窗口支持
- Trace 数据持久化

## Decisions

### Decision 1: URL 查询参数作为主路由依据

**选择**: 在 `WebviewUrl::App("index.html?window=trace".into())` 传递 `?window=trace` 参数，`isTraceWindow()` 优先检查 URL 参数。

**备选**: 仅依赖 `getCurrentWebviewWindow().label`。
**淘汰理由**: Tauri IPC 在模块顶层可能未就绪，且该 API 在 Tauri v2 不同小版本间行为可能不一致。URL 参数是 Web 标准机制，在 webview 加载时由 Rust 端注入，100% 可靠。

**检测优先级**:
```
1. URLSearchParams.get('window') === 'trace'  → 主要判定（Rust 注入）
2. getCurrentWebviewWindow().label === 'trace' → 辅助判定（HMR 开发场景）
```

### Decision 2: 独立窗口定位（F12 DevTools 风格）

**选择**: Trace 窗口使用固定默认尺寸（宽 420px，高 600px），不计算主窗口位置。窗口 `.resizable(true)`，允许用户自由拖拽到任意位置和显示器。移除 `open_trace_window` 中获取主窗口位置/尺寸的代码。

**备选**: 保留当前的贴附式定位（主窗口右侧，等高）。
**淘汰理由**: 贴附式布局在用户移动/调整主窗口后 Trace 窗口位置不再合理；在双显示器场景下限制了 Trace 窗口放到副屏的灵活性；F12 DevTools 风格更符合调试工具的直觉。

**窗口创建参数**:
```rust
WebviewWindowBuilder::new(&app, "trace", WebviewUrl::App("index.html?window=trace".into()))
    .title("Agent Trace")
    .inner_size(420.0, 600.0)
    .min_inner_size(320.0, 400.0)
    .resizable(true)
    .decorations(false)
    .center()          // 首次创建时在屏幕上居中
    .visible(true)
    .build()
```

### Decision 3: `.hide()` / `.show()` 替代 `.close()` / 重建

**选择**: StatusBar 的 toggle 关闭时调用 `.hide()` 隐藏窗口，toggle 打开时对已存在的窗口调用 `.show()` + `.set_focus()`。仅在窗口从未创建时才走 `.build()` 路径。主窗口关闭时调用 `.close()` 彻底销毁。

**备选**: 继续使用 `.close()` 销毁 + 按需重建。
**淘汰理由**: 销毁/重建有竞态风险（快速点击时 `get_webview_window` 返回僵尸引用），且重建需要重新加载 webview（包括 JS bundle 解析、React 挂载），性能差。

**状态管理**: 后端命令分三种操作：
- `open_trace_window`: 首次创建，后续 show
- `hide_trace_window`: hide（StatusBar toggle 关闭 + Trace 窗口关闭按钮）
- `close_trace_window`: close（仅在主窗口 `CloseRequested` 时调用）

### Decision 4: `.decorations(false)` + 自定义标题栏（含窗口控制按钮）

**选择**: Trace 窗口创建时 `.decorations(false)`，在 `TracePanel` 顶部添加自定义标题栏，包含：
- 可拖拽区域（`onMouseDown` 调用 `getCurrentWindow().startDragging()`）
- "Agent Trace" 标题文本
- 最小化按钮（调用 `getCurrentWindow().minimize()`）
- 最大化/还原按钮（调用 `getCurrentWindow().toggleMaximize()`）
- 关闭按钮（调用 `hideTraceWindow()` IPC 命令，隐藏而非销毁）

**备选**: 保留 `.decorations(true)` 原生标题栏。
**淘汰理由**: 与主窗口的无边框自定义标题栏设计保持一致；用户明确要求自定义窗口标题；原生标题栏样式在不同 OS 上不一致。

**标题栏布局参考**:
```
┌──────────────────────────────────────────────────┐
│  Agent Trace              [─] [□] [✕]           │
│  (拖拽区域)               (最小化)(最大化)(关闭)   │
├──────────────────────────────────────────────────┤
│  TraceStatusBar                                   │
├──────────────────────────────────────────────────┤
│  TurnList (可滚动内容)                             │
│                                                   │
└──────────────────────────────────────────────────┘
```

### Decision 5: 新增 `hide_trace_window` 命令

**选择**: 新增 `hide_trace_window` 命令，调用 `trace.hide()`。前端 `StatusBar` 的 toggle 按钮和 Trace 窗口的关闭按钮均调用 `hide_trace_window`。

**API 变更**:
| 旧命令 | 新命令 | 行为变更 |
|--------|--------|---------|
| `close_trace_window` | `hide_trace_window` | `.close()` → `.hide()`（用于 toggle 和关闭按钮） |
| — | `close_trace_window` | 保留 `.close()`，仅用于主窗口 `CloseRequested` 时彻底清理 |

## Risks / Trade-offs

- **隐藏窗口占用内存**: `.hide()` 后 webview 保持运行（包括 JS 上下文、React 组件树），会持续占用内存（约 50-100MB）。→ 可接受：桌面应用场景下单窗口内存开销在合理范围内，且避免了重建的性能代价。
- **事件监听冲突**: `.hide()` 后 Trace 窗口仍在监听全局事件（`stream-delta` 等），每次 Agent 运行时 traceStore 持续更新。→ 可接受：这些更新仅在内存中进行，无 DOM 渲染开销（隐藏的 webview 不触发 layout/paint），性能影响可忽略。
- **`getCurrentWebviewWindow()` HMR 兼容性**: Vite HMR 热更新时 URL 参数可能丢失。→ 保留 `getCurrentWebviewWindow().label` 作为辅助判定，HMR 场景下 IPC 通常已就绪。
- **双显示器场景**: 用户可能在主窗口关闭后忘记 Trace 窗口仍在另一显示器上显示。→ 主窗口 `CloseRequested` 强制 `.close()` Trace 窗口，消除此风险。

## Open Questions

无。所有关键技术决策已在上文确定，可直接进入实现阶段。
