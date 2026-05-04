## Context

当前 `lib.rs` 中的 `WindowState` 持久化机制仅覆盖主窗口（`main` label），使用 `thread::spawn` 实现 500ms 防抖写入 `window-state.json`。Trace 窗口（`trace` label）创建时不读取任何持久化状态，每次使用默认尺寸 420×600 + `.center()`。

`open_trace_window` 通过 `.hide()`/`.show()` 模式管理 Trace 窗口生命周期：首次创建 webview，后续仅 show+focus。同一会话内 hide/show 保留窗口位置（webview 未销毁），但应用重启后 webview 必须重建，位置信息丢失。

Trace 窗口和主窗口是独立 webview，通过 Tauri 事件系统（`emit`/`listen`）通信。`useTraceIpc` hook 在 Trace 窗口挂载时安装事件监听器，`emitTraceConversationChanged` 从主窗口发送当前对话 ID 到 Trace 窗口以加载 turns 数据。窗口首次创建时，监听器异步安装与事件发射之间存在竞态窗口。

`trace-pin-window` spec 中的 Pin 按钮（📌）实现的是"跨对话保持打开"，但 i18n 文案使用"置顶"——在中文桌面软件语境中通常指 Always on Top。用户期望有一个真正的窗口置顶功能。

## Goals / Non-Goals

**Goals:**
- Trace 窗口关闭/重启后恢复上次的大小和位置（含最大化状态）
- 提供真正的窗口置顶（Always on Top）按钮，与现有的"跨对话保持打开"按钮分离
- 修复重启应用后 Trace 数据加载的竞态条件
- `isPinned` 状态持久化（当前在 traceStore 内存中，窗口关闭后丢失）
- i18n 文案准确反映按钮功能

**Non-Goals:**
- 主窗口的位置/尺寸记忆逻辑重构（已正常工作，仅扩展）
- Trace 窗口多实例支持
- 窗口置顶状态的持久化（重启后默认不置顶）

## Decisions

### Decision 1: WindowState 扩展为 HashMap 按 label 存储

**选择**: 将 `window-state.json` 格式从单个 `WindowState` 改为 `HashMap<String, WindowState>`，key 为窗口 label（`"main"` / `"trace"`）。

**备选**: 使用两个独立文件（`window-state.json` + `trace-window-state.json`）。  
**淘汰理由**: 统一管理更简单，load/save/debounce 基础设施完全复用，减少文件 IO。

**数据格式变更**:
```json
{
  "main": { "x": 100, "y": 100, "width": 1200, "height": 800, "maximized": false },
  "trace": { "x": 500, "y": 300, "width": 420, "height": 600, "maximized": false }
}
```

**向后兼容**: `load_window_state` 尝试解析旧格式（单个对象），若成功则自动迁移为 HashMap 格式。旧格式中仅有主窗口数据，不影响功能。

### Decision 2: Trace 窗口状态保存/恢复时机

**选择**: 完全复用主窗口的模式：
- **保存**: `Moved`/`Resized` 事件 → 500ms 防抖 → 写入 JSON
- **立即保存**: `CloseRequested` 事件（Trace 窗口自己的关闭按钮触发 `hide`，但主窗口关闭时 Trace 窗口被 `.close()` 销毁，触发 `CloseRequested`）
- **恢复**: `open_trace_window` 首次创建时读取并恢复

**注意**: Trace 窗口使用 `.hide()` 而非 `.close()`，`hide` 不触发 `CloseRequested`。所以在 `hide` 前主动保存状态。

**备选**: 在 `hide_trace_window` 命令中保存状态。  
**补充设计**: 同时在 `hide_trace_window` 和 trace 窗口的 `CloseRequested`（主窗口关闭级联）两处保存，确保所有退出路径都覆盖。

### Decision 3: 窗口置顶（Always on Top）按钮

**选择**: 在 Trace 窗口标题栏新增独立的"窗口置顶"按钮（📌 图钉或 ↑ 图标），与"跨对话保持打开"按钮分开。点击时调用新的 `set_trace_always_on_top` Rust 命令。

**按钮布局**:
```
┌──────────────────────────────────────────────────────────────────┐
│  Agent Trace          [📌保持] [📌置顶] [🗑] [─] [□] [✕]      │
│  (拖拽区域)            (Pin)  (Topmost)(清除)(Min)(Max)(Close)  │
└──────────────────────────────────────────────────────────────────┘
```

**Tauri API**: `window.set_always_on_top(bool)` — Tauri v2 原生支持，跨平台（Windows/macOS/Linux）。

**状态管理**: `alwaysOnTop` 状态仅存在于 traceStore 内存中，不持久化。Trace 窗口关闭后默认恢复为非置顶。

**备选**: 将置顶按钮与 Pin 按钮合并为单一按钮（既跨对话又置顶）。  
**淘汰理由**: 用户明确要求分离两个功能——"跨对话保持打开"和"窗口置顶"是正交的 UI 行为。

### Decision 4: 修复重启后数据加载竞态

**选择**: 组合方案——URL 参数 + 事件重发 + 监听器就绪后主动查询。

1. **URL 参数传递初始 conversationId**（主方案）:
   - 修改 `open_trace_window` 命令签名，接受 `conversation_id: Option<String>`
   - 窗口 URL 变为 `index.html?window=trace&conversationId=xxx`
   - `useTraceIpc` 在监听器安装完成后检查 URL 参数，若 `conversationId` 仍为 null 则从 URL 参数初始化

2. **`toggleTrace` 显式 emit**（防御）:
   - 在 `toggleTrace` 中 `openTraceWindow()` 之后也调用 `emitTraceConversationChanged`

3. **`useTraceIpc` 就绪后主动同步**（兜底）:
   - 监听器 `install()` 完成后，若 `conversationId` 仍为 null，emit `trace-window-ready` 事件
   - 主窗口 `StatusBar` 收到后重新 emit `trace-conversation-changed`

**备选 A**: 仅用定时器延迟 emit（`setTimeout` 500ms）。  
**淘汰理由**: 不可靠——500ms 不保证 React 已完成挂载和监听器安装。

**备选 B**: 使用 Tauri 的 `once` 事件模式。  
**淘汰理由**: Tauri v2 事件系统不支持"队列等待"，missed 就是 missed。

### Decision 5: isPinned 状态持久化

**选择**: 将 `isPinned` 从 traceStore 内存移至 chatStore（随 `code-agent-chat-history` key 持久化到 localStorage）。

**chatStore 新增字段**:
```typescript
interface ChatState {
  // ...
  isTracePinned: boolean;  // NEW
  setTracePinned: (isPinned: boolean) => void;  // NEW
}
```

**persist 适配**: `partialize` 新增 `isTracePinned` 字段，`merge` 恢复时设置默认 `false`。

**备选**: 使用 Rust 端窗口状态存储。  
**淘汰理由**: `isPinned` 是纯前端 UI 状态，与窗口大小/位置无关，放在 chatStore 更自然且已有 persist 基础设施。

### Decision 6: alwaysOnTop 按钮图标

**选择**: 使用 `FaThumbtack`（与 Pin 按钮相同图标但不同样式）或使用 `FaArrowUp` / `FaLayerGroup` 区分。推荐使用 `FaThumbtack` + 不同颜色/旋转区分两个按钮。

实际采用两个独立图标：
- "保持打开"：`FaThumbtack`（图钉，表示"钉住此窗口不关闭"）
- "窗口置顶"：`FaWindowRestore` + 叠层效果，或使用 `FaRegSquare` + 箭头组合

最终选择待实现时根据图标库可用性确定。

## Risks / Trade-offs

- **window-state.json 格式变更**: 旧版本用户升级后首次启动，旧格式自动迁移为 HashMap 格式。若迁移失败（文件损坏），回退到默认尺寸 → **Mitigation**: `load_window_state` 中 JSON 解析失败时返回 `None`，走默认路径。
- **URL 参数 conversationId 安全性**: conversationId 仅用于前端读取，不影响后端逻辑。URL 参数对用户可见但不敏感 → **Mitigation**: 无需额外处理。
- **Trace 窗口 hide 时主动保存状态**: `hide_trace_window` 被多处调用（StatusBar toggle、TracePanel 关闭按钮、对话切换自动 hide），需确保所有路径都保存 → **Mitigation**: 在 Rust 的 `hide_trace_window` 命令中统一保存，前端调用点无需额外处理。
- **alwaysOnTop 状态不持久化**: 用户重启应用后需重新激活置顶 → **Mitigation**: 符合用户预期（置顶是临时工作状态，非持久配置）。
- **两个相似按钮的用户认知**: "保持打开"和"窗口置顶"可能有概念混淆 → **Mitigation**: 通过 tooltip 明确描述（"切换对话时保持 Trace 窗口打开" vs "将 Trace 窗口置于其他窗口之上"）。

## Open Questions

无。关键技术决策已确定，可直接进入实现阶段。
