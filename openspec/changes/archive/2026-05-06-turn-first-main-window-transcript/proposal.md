## Why

主窗口当前把一次 Agent 运行中的多轮 turn 压平到单条 assistant message 中，再同时用这条 UI message 承担渲染顺序、thinking 状态和下一轮 prompt 历史三种职责，导致语义边界混乱。这个模型已经暴露出一组相关缺陷：thinking 内容按累计文本重复插入、多个 thinking 面板共享同一状态与计时、以及工具调用后下一轮对话丢失 `tool_use -> tool_result` 邻接关系并触发 Anthropic/DeepSeek 400 错误，因此需要尽快把主窗口切换到 turn-first 的消息语义。

## What Changes

- 引入以 turn 为中心的主窗口会话时间线模型，使主窗口与 Trace 窗口共享同一套 canonical turn/transcript 语义，而不再把跨 turn 事件压平到单条 assistant message 里。
- 将主窗口中的 thinking、tool_use、tool_result、response 渲染边界改为按 turn 派生，确保每段 thinking 拥有独立的内容、状态、开始/结束时间与完成态。
- 将发送给 provider 的历史消息改为从 canonical turn transcript 推导出的 provider-compatible transcript，确保 assistant `tool_use` 后紧邻 user `tool_result`。
- 重新定义 `contentBlocks` 在主窗口中的职责：它只表达主窗口的可视内容片段，不再被隐式视为可直接复用的 provider 消息历史。
- 增加旧会话迁移策略，把现有持久化的 message-first 数据规范化为 turn-first 可消费结构，并保持历史会话可读。

## Capabilities

### New Capabilities
- `turn-first-chat-transcript`: 定义主窗口可消费的 canonical turn-first transcript，并规定主窗口渲染与 provider 历史都从该时间线派生。

### Modified Capabilities
- `agent-frontend`: 前端共享 store 的 canonical turn 状态将进一步扩展为主窗口渲染与 prompt 历史的统一来源。
- `chat-message-rendering`: 主窗口 SHALL 按 turn 边界展示 thinking、tools 和 response，且不同 thinking 块 SHALL 拥有独立状态而非共享整条 message 状态。
- `content-block-messages`: `contentBlocks` 的语义 SHALL 从“近似消息历史”调整为“主窗口可视内容片段”，不得再假定其可直接满足 provider transcript 约束。
- `prompt-engine`: 构建 provider 请求时 SHALL 保留 `tool_use -> tool_result` 的合法邻接关系，不得因 UI 投影过滤而丢失必需块。
- `thinking-panel-streaming`: Thinking panel SHALL 基于所属 turn 的独立生命周期显示状态、计时与完成态，而不是共享外层 message 的流式状态。

## Impact

- **前端 store / hook**：`src/stores/chatStore.ts`、`src/hooks/useAgent.ts`、`src/hooks/useTraceIpc.ts`、相关消息归档与迁移逻辑。
- **主窗口渲染**：`src/components/Chat/MessageList.tsx`、thinking/tool 渲染组件、消息折叠与滚动联动逻辑。
- **prompt / provider 历史组装**：`src/hooks/useAgent.ts` 的发送路径、`src-tauri/src/prompt/engine.rs`、provider 请求构造与相关测试。
- **持久化与兼容**：localStorage 中已有 conversation/message 数据的迁移与回退兼容。
- **测试面**：需要补充主窗口多 turn thinking、工具调用连续对话、prompt transcript 邻接关系、历史迁移等覆盖。
