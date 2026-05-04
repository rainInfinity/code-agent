# implement-agent-core-loop 任务清单

## 1. 数据模型扩展（Rust + TypeScript）

- [x] 1.1 在 `models.rs` 中定义 `ContentBlock` enum（Text / ToolUse / ToolResult），派生 Serialize/Deserialize/Debug/Clone
- [x] 1.2 在 `ChatMessage` 中新增 `content_blocks: Option<Vec<ContentBlock>>` 字段，保留 `content: String` 向后兼容
- [x] 1.3 在 `models.rs` 中定义 `AgentSession` 结构体（胖上下文：id / agent_type / config / messages / turn_count / token_usage / tool_registry / emitter / cancel_token / created_at）
- [x] 1.4 在 `models.rs` 中定义 `AgentStatus` enum（Idle / Running / Complete / Cancelled / MaxTurnsReached / Error）
- [x] 1.5 在 `models.rs` 中定义新的 Tauri 事件 payload：`ToolCallEvent`、`ToolResultEvent`、`AgentTurnEvent`、`AgentCompleteEvent`
- [x] 1.6 在 `src/types/index.ts` 中同步新增 TypeScript 类型：`ContentBlock`、`ContentBlockType`、`AgentStatus`、`ToolCallEvent`、`ToolResultEvent`、`AgentCompleteEvent`、`AgentTurnEvent`

## 2. LlmClient 扩展 tool_use 流式解析

- [x] 2.1 扩展 `src-tauri/src/models.rs` 中的 `ContentDelta` 结构体，增加 `input_json_delta: String` 和 `tool_use: Option<ToolUseInfo>` 字段
- [x] 2.2 修改 `AnthropicProvider::parse_stream_data`，使其返回结构化事件而非仅文本 delta，定义 `ParseResult` enum 包含 TextDelta / ToolUseStart / ToolUseDelta / ToolUseComplete
- [x] 2.3 在 `LlmClient` 中新增 `stream_chat_with_tools` 方法，接受 `on_text_delta` / `on_tool_call` / `on_error` 回调
- [x] 2.4 在 `stream_chat_with_tools` 中实现 `ContentBlockStart`（tool_use 类型）→ 记录 tool_name + tool_id；`ContentBlockDelta`（input_json_delta）→ 拼接 JSON；`ContentBlockStop` → 解析完整 JSON，触发 `on_tool_call`

## 3. Agent 核心模块（src-tauri/src/agent/）

- [x] 3.1 创建 `src-tauri/src/agent/mod.rs`，声明子模块并导出公共类型
- [x] 3.2 创建 `src-tauri/src/agent/config.rs`，定义 `AgentConfig` 结构体（max_turns: usize = 30, tool_timeout_secs: u64 = 120, tool_output_max_chars: usize = 8000）
- [x] 3.3 创建 `src-tauri/src/agent/session.rs`，实现 `AgentSession` 的胖上下文构造（含 ToolRegistry / Emitter / Config 注入）、消息添加（add_user_message / add_assistant_message / add_tool_result）、状态转换方法
- [x] 3.4 创建 `src-tauri/src/agent/runtime.rs`，实现 `AgentRuntime` 轻量调度器（管理 cancel_token + JoinHandle）和核心 `agent_loop` 函数（签名为 `async fn agent_loop(session: &mut AgentSession)`）
- [x] 3.5 在 `agent_loop` 中实现 LLM 响应分发：纯文本 → emit text + 结束；tool_use → tool_registry 查找 + 执行 + 工具结果格式化 + 继续循环
- [x] 3.6 在 `agent_loop` 中实现 CancellationToken 检查点（循环开始 / 工具执行后），max_turns 上限校验
- [x] 3.7 在 `lib.rs` 或 `main.rs` 中注册 `agent` 模块（`mod agent;`）

## 4. ToolExecutor 与工具集成

- [x] 4.1 创建 `src-tauri/src/tools/executor.rs`，实现 `ToolExecutor`（用 `tokio::time::timeout` 包裹执行，输出截断，错误包装为 ToolResult）
- [x] 4.2 在 `tools/mod.rs` 中导出 `executor` 模块
- [x] 4.3 将 `ToolRegistry` 作为胖上下文依赖注入 `AgentSession`，AgentLoop 通过 `session.tool_registry` 访问工具
- [x] 4.4 在 AgentLoop 的 Act 阶段实现工具执行→ToolResult→格式化为 Anthropic `tool_result` ContentBlock 的完整链路

## 5. Tauri Commands 改造

- [x] 5.1 在 `AppState` 中新增 `agent_runtime: Arc<AgentRuntime>` 和 `tool_registry: Arc<ToolRegistry>`（AgentRuntime 为轻量调度器，只管理 cancel_token + JoinHandle）
- [x] 5.2 创建 `run_agent` Tauri command：创建 AgentSession + CancellationToken → spawn tokio task 运行 AgentLoop → 将 token 存入 AppState
- [x] 5.3 实现 `stop_agent` Tauri command：从 AppState 取出对应 session 的 CancellationToken 并 cancel
- [x] 5.4 在 `commands.rs` 中保留原有 `send_message` 作为非 Agent 的简化路径（内部可以调用 `run_agent` 并设 max_turns=1 做降级）

## 6. 前端 Agent 状态管理

- [x] 6.1 创建 `src/stores/agentStore.ts`，管理 `agentStatus`、`currentSessionId`、`turnCount`、`pendingToolCalls` 状态
- [x] 6.2 扩展 `chatStore.ts` 中的 `Message` 接口，新增可选字段 `contentBlocks?: ContentBlock[]`、`toolCalls?: ToolCall[]`、`toolResults?: ToolResult[]`
- [x] 6.3 修改 `MessageList.tsx`，支持渲染工具调用指示器（tool_use 块显示 "正在执行 XXX..."）和工具结果块（折叠/展开）
- [x] 6.4 创建 `src/hooks/useAgent.ts`，监听全部 Agent 事件（stream-delta / tool-call / tool-result / agent-turn / agent-complete），更新 chatStore 和 agentStore
- [x] 6.5 在 `useAgent` 中实现 `send` 方法（调用 `run_agent` invoke）和 `stop` 方法（调用 `stop_agent` invoke）
- [x] 6.6 将 `useChat` 重构为调用 `useAgent` 的 thin wrapper，确保现有功能不 regression
- [x] 6.7 在 `useIpc.ts` 中注册新事件监听器（onToolCall、onToolResult、onAgentTurn、onAgentComplete）

## 7. 端到端验证

- [x] 7.1 在 `tools/mod.rs` 中确保 `EchoTool` 已注册到默认 `ToolRegistry`
- [x] 7.2 在 `agent_loop` 初始化时将 `ToolRegistry` 的 `definitions()` 传入 LLM 请求的 `tools` 字段
- [ ] 7.3 手动测试：发送 "Echo hello world"，验证 Agent 自动调用 echo 工具并返回结果
- [ ] 7.4 手动测试：发送纯文本 "Hello"，验证 Agent 直接返回文本不调用工具
- [ ] 7.5 手动测试：Agent 运行中点击 Stop 按钮，验证停止成功且状态恢复
- [ ] 7.6 验证 Chat UI 中工具调用指示器和工具结果的渲染效果

