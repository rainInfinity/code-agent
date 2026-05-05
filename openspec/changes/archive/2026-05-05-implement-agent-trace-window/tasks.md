## 1. Rust 后端：多窗口基础设施

- [x] 1.1 `tauri.conf.json` 中确保 window 权限已启用（`window:default`）
- [x] 1.2 `commands.rs` 新增 `open_trace_window` 命令：计算主窗口右侧位置，创建 trace 窗口
- [x] 1.3 `commands.rs` 新增 `close_trace_window` 命令：关闭 trace 窗口
- [x] 1.4 `lib.rs` 中注册新命令到 `invoke_handler`
- [x] 1.5 `lib.rs` 中为主窗口注册 `Moved` / `Resized` 事件：同步更新 trace 窗口位置

## 2. Rust 后端：Trace 事件补充

- [x] 2.1 `AgentEventEmitter` trait 新增 `emit_trace_thinking_start` / `emit_trace_thinking_end` 方法
- [x] 2.2 `TauriAgentEventEmitter` 实现新方法
- [x] 2.3 `agent_loop` 中在 thinking 阶段前后 emit `trace-thinking-start` / `trace-thinking-end` 事件
- [x] 2.4 `models.rs` 新增 `TraceThinkingEvent` 结构体

## 3. 前端：类型与 Store

- [x] 3.1 `types/index.ts` 新增 trace 相关类型：`TurnTrace`, `ConversationTrace`, `TraceThinkingEvent`
- [x] 3.2 `types/index.ts` 中 `Conversation` 新增 `traceEnabled?: boolean`
- [x] 3.3 `stores/traceStore.ts` 创建：管理 `turns: TurnTrace[]`，提供 `startTurn`/`addPrompt`/`appendThinking`/`appendResponse`/`endTurn`/`reset` 方法
- [x] 3.4 `stores/chatStore.ts` 中 `Conversation` 持久化时包含 `traceEnabled`

## 4. 前端：IPC 事件监听

- [x] 4.1 `hooks/useTraceIpc.ts` 创建：封装 trace 相关事件监听
  - `onAgentTurn` → `traceStore.startTurn()`
  - `onTracePrompt` → `traceStore.addPrompt()`（提案 1 的事件）
  - `onThinkingDelta` → `traceStore.appendThinking()`
  - `onStreamDelta` → `traceStore.appendResponse()`
  - `onAgentComplete` → `traceStore.endTurn()`
- [x] 4.2 `types/index.ts` 新增 `TracePromptEvent` 类型（与提案 1 同步）

## 5. 前端：Trace 窗口组件

- [x] 5.1 `main.tsx` 修改：根据 `window.location.search` 中的 `window=trace` 路由到 `TraceApp`
- [x] 5.2 `TraceApp.tsx` 创建：ThemeProvider 包裹 TracePanel
- [x] 5.3 `components/Trace/TracePanel.tsx`：主布局，StatusBar + TurnList
- [x] 5.4 `components/Trace/TraceStatusBar.tsx`：Agent 状态指示灯、Turn N/M、阶段指示
- [x] 5.5 `components/Trace/TurnCard.tsx`：单轮可展开卡片，折叠/展开状态
- [x] 5.6 `components/Trace/PromptView.tsx`：展示 system prompt + messages 列表，message 显示 role 标签和内容摘要，可展开完整内容
- [x] 5.7 `components/Trace/ThinkingView.tsx`：thinking 内容 `<pre>` 展示
- [x] 5.8 `components/Trace/ResponseView.tsx`：response 文本内容

## 6. 前端：主窗口集成

- [x] 6.1 `components/Layout/StatusBar.tsx` 添加"Trace"按钮（图标 + 文字），点击触发 `open_trace_window`
- [x] 6.2 按钮显示当前 trace 开启状态（高亮/普通）
- [x] 6.3 在 `useAgent.ts` 或 `useChat.ts` 中，根据 `conversation.traceEnabled` 决定是否启动 trace 事件监听
- [x] 6.4 对话切换时，如果新对话 `traceEnabled`，自动打开 trace 窗口
- [x] 6.5 主窗口关闭时，自动关闭 trace 窗口

## 7. i18n

- [x] 7.1 `zh-CN.ts` 新增 trace 相关文案：面板标题、状态提示、Turn/Prompt/Thinking/Response 标签

## 8. 验证

- [ ] 8.1 验证深色/浅色主题下 trace 窗口正确跟随主窗口主题
- [ ] 8.2 验证主窗口移动/调整大小时 trace 窗口跟随
- [ ] 8.3 验证 trace 窗口可独立关闭和重新打开
- [ ] 8.4 验证对话切换时 trace 数据正确重置
- [ ] 8.5 验证 `traceEnabled` 状态持久化（关闭应用重开后恢复）
- [ ] 8.6 验证关闭 trace 后不再收集数据，重开为空
- [ ] 8.7 验证展开/折叠卡片交互正常
- [ ] 8.8 验证 Prompt 内容正确展示 system prompt + messages 结构
