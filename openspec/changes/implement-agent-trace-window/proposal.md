## Why

当前 Agent 的多轮循环（Think → Act → Observe）对用户是完全不可见的——前端只看到一个不断增长的 assistant 消息。对于学习 code agent 架构的目的来说，用户需要看到 Agent 工作的"幕后"细节：

- 每轮 LLM 调用的完整 Prompt 是什么？（system prompt + messages 数组）
- Thinking 过程输出了什么？
- Agent 在每轮做了什么决策？

本次实现一个独立的 Trace 窗口，紧贴主窗口右侧，实时展示 Agent 工作过程的细节。**依赖提案 1（implement-prompt-engine）提供的 `trace-prompt` 事件。**

## What Changes

### Rust 后端
- 新增 `open_trace_window` / `close_trace_window` Tauri 命令
- Trace 窗口跟随主窗口移动（通过监听主窗口位置事件）
- 新增 `trace-thinking-start` / `trace-thinking-end` 事件（标记 thinking 阶段边界）

### 前端
- 新增 `TraceApp.tsx` 作为 trace 窗口的根组件
- 新增 `src/components/Trace/` 组件目录
- 新增 `traceStore.ts` 累积 trace 数据
- 主窗口新增"打开 Trace"按钮（状态栏或标题栏）
- Trace 窗口的开启状态跟随 conversation 持久化

## Capabilities

### New Capabilities

- `agent-trace-window`: 独立的多窗口 Agent Trace 面板，实时展示 Prompt 组织、Thinking 过程、Agent 轮次状态

### Modified Capabilities

- 无现有 capability 变更

## Impact

### Rust 后端
- `src-tauri/src/commands.rs` — 新增 `open_trace_window`, `close_trace_window`
- `src-tauri/src/agent/session.rs` — `AgentEventEmitter` trait 新增 `emit_trace_thinking_start/end`
- `src-tauri/src/agent/runtime.rs` — `agent_loop` 中 thinking 阶段前后 emit 新事件
- `src-tauri/src/lib.rs` — 注册新命令，主窗口移动时更新 trace 窗口位置
- `src-tauri/tauri.conf.json` — 新增 trace 窗口配置（label, url, 初始可见性）

### 前端
- `src/main.tsx` — 根据 `window.__TAURI_INTERNALS__` 的 label 路由到 `App` 或 `TraceApp`
- `src/TraceApp.tsx` — 新文件，trace 窗口根组件
- `src/components/Trace/` — 新目录（TracePanel, TurnCard, PromptView, ThinkingView, TraceStatusBar）
- `src/stores/traceStore.ts` — 新文件，trace 数据 store
- `src/hooks/useTraceIpc.ts` — 新文件，trace 专用 IPC 事件监听
- `src/types/index.ts` — 新增 trace 相关类型
- `src/components/Layout/StatusBar.tsx` — 添加"打开 Trace"按钮
- `src/stores/chatStore.ts` — `Conversation` 类型新增 `traceEnabled` 字段

## Dependencies

- **implement-prompt-engine** — 依赖 `trace-prompt` 事件提供 Prompt 数据
