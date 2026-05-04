# implement-agent-core-loop 设计文档

## Context

当前 `commands::send_message` 做单轮 LLM 调用：构建请求 → 流式返回文本 → 结束。`tools.rs` 的 `ToolRegistry` 和 `Tool` trait 已定义但从未接入对话。`stop_streaming` 是空函数。`LlmClient::stream_chat` 只提取 `text_delta`，遇到 `tool_use` 内容块会静默忽略。

目标是将此改造为多轮 Agent 循环，为后续所有 Agent 能力（多 Agent、任务系统、规划模式）奠定基础。参考文档为 [agent-architecture-design.md](../../../docs/agent-architecture-design.md) 中的 Phase 1。

关键约束：
- 只做 Anthropic provider 的 tool_use 流式支持（DeepSeek/OpenAI 的 function calling 在 Phase 1 降级为纯文本）
- 不引入权限系统（Phase 3）、多 Agent（Phase 4）、规划模式（Phase 5）——本阶段只聚焦核心循环
- 工具执行在当前阶段为串行（并行执行列入 Phase 7）

## Goals / Non-Goals

**Goals:**
- 在 Rust 后端实现 Think→Act→Observe 多轮 Agent 循环
- 扩展 LlmClient 解析 Anthropic tool_use 流式事件（ContentBlockStart/Delta/Stop）
- ChatMessage 从 `content: String` 升级为 `content: Vec<ContentBlock>`
- 通过 CancellationToken 实现真正的 `stop_streaming`
- 前端新增 useAgent hook + agentStore，与现有 useChat 共存
- 用 EchoTool 验证端到端工具调用流程

**Non-Goals:**
- 不实现权限确认弹窗（permission-request 事件定义但暂不拦截，所有工具自动允许）
- 不实现多 Agent 路由/委托、Task 系统、Plan Mode、Memory
- 不实现工具并行执行
- 不实现 DeepSeek/OpenAI 的 function calling
- 不修改 settings/providers/list_models 等已有功能

## Decisions

### 1. AgentLoop 位置：Rust 后端 tokio task

**选择:** AgentLoop 作为 tokio spawn 的异步任务运行在 Rust 后端，前端仅做 UI 渲染和事件监听。

**备选:** 前端编排（useAgent hook 内 while 循环调 invoke）。被否决原因：前端不适合长时异步循环（浏览器标签休眠、HMR 重启），且每次工具执行都需跨 IPC 序列化消息列表，延迟不可控。

**实现要点:**
- `run_agent` command 创建 `AgentSession`，spawn tokio task 运行 `AgentLoop`
- `stop_agent` command 设置 CancellationToken，tokio task 检测到取消后退出
- `AgentRuntime` 定位为**轻量调度器**（只管理 cancel_token 映射 + JoinHandle），不持有 prompt_engine/context_manager 等依赖。所有执行期依赖由 AgentSession 携带（见 Decision 7）

### 2. 取消机制：tokio CancellationToken + AppState 存储

**选择:** 使用 `tokio_util::sync::CancellationToken`，每个活跃 session 一个 token，存储在 `AppState` 的 `HashMap<SessionId, CancellationToken>` 中。

**备选:** `AbortHandle`（tokio JoinHandle abort）。被否决原因：abort 在任意 await 点强制终止，无法做清理（如保存部分结果、发送 agent-complete 事件）。

**实现要点:**
```rust
// AppState 新增字段
pub struct AppState {
    // ... existing fields ...
    pub cancel_tokens: Mutex<HashMap<String, CancellationToken>>,
}
```

AgentLoop 在每次循环迭代开始和每次工具执行后检查 `token.is_cancelled()`。LLM 流式请求传入 `token.clone()`，在 SSE 循环中检查取消。

### 3. 消息模型：ContentBlock 兼容 Anthropic 格式

**选择:** `ChatMessage.content` 从 `String` 改为 `Vec<ContentBlock>`，ContentBlock 为 tagged enum：`Text { text }` / `ToolUse { id, name, input }` / `ToolResult { tool_use_id, content }`。序列化时保留平级 tag 字段（`type: "text" | "tool_use" | "tool_result"`）。

**备选:** 保持 `content: String`，新增 `tool_calls: Vec<ToolCall>` 字段。被否决原因：消息内容中 text 和 tool_use 的**交错顺序**对 LLM 理解上下文很关键，拆到两个字段会丢失顺序。

**迁移策略:**
- ChatMessage 新增 `content_blocks: Option<Vec<ContentBlock>>`，保留 `content: String` 作为 text 向后兼容
- `build_chat_request` 中优先使用 `content_blocks`，若为 None 则回退到 `content` 构造 `[Text { text: content }]`
- 前端 Message 类型同步新增 `contentBlocks?: ContentBlock[]`

### 4. 流式解析：复用现有 StreamEvent 枚举扩展 tool_use 字段

**选择:** 扩展 `ContentDelta` 增加 `input_json_delta` 字段，修改 `AnthropicProvider::parse_stream_data` 让 LlmClient 层识别 tool_use 块并发射新事件 `tool-call`。

**备选:** 在 `LlmClient::stream_chat` 中完整解析 ContentBlock 序列，返回 `Vec<ContentBlock>`。被否决原因：这会让流式回调接口从 `FnMut(String)` 变为复杂的 enum dispatch，影响非 Agent 路径。

**实现要点:**
- `LlmClient::stream_chat` 签名不变（保持 `on_delta` / `on_error` 回调）
- 新增 `LlmClient::stream_chat_with_tools` 方法，返回结构化事件流（`StreamEvent::TextDelta` / `StreamEvent::ToolUseStart` / `StreamEvent::ToolUseDelta` / `StreamEvent::ToolUseComplete`）
- AgentLoop 使用 `stream_chat_with_tools`，普通 `send_message` 可继续用 `stream_chat`

### 5. 前端架构：useAgent 与 useChat 并行，共享 chatStore

**选择:** 新增 `useAgent` hook + `agentStore`，保留 `useChat` 不动。`chatStore` 的 Message 接口扩展 `contentBlocks` 可选字段。`useAgent` 处理新增事件类型（`tool-call`、`agent-complete`、`agent-turn`），`useChat` 作为简化包装在内部调用 `useAgent`。

**备选:** 直接修改 useChat 为 useAgent。被否决原因：Phase 1 期间需要两者共存以降低风险，且 `useChat` 可作为不需要 Agent 循环的简单对话场景的轻量替代。

**实现要点:**
- `agentStore`：管理 `agentStatus: 'idle' | 'running'`、`currentSessionId`、`turnCount`
- `useAgent`：监听 `stream-delta`、`tool-call`、`tool-result`、`agent-complete` 事件
- `useChat` 重构为 thin wrapper，委托给 `useAgent` 的核心逻辑

### 6. Tool 系统集成：ToolRegistry 作为 AgentSession 的内置依赖

**选择:** `AgentSession` 创建时接收 `Arc<ToolRegistry>` 作为胖上下文的组成部分。AgentLoop 在 Act 阶段通过 `session.tool_registry` 查找并执行工具，无需外部传参。工具执行结果格式化为 Anthropic `tool_result` ContentBlock 回传 LLM。

**实现要点:**
- AgentSession 构造时注入 `Arc<ToolRegistry>`（详见 Decision 7）
- AgentLoop 签名无需 tool_registry 参数：`async fn agent_loop(session: &mut AgentSession)`
- Act 阶段：`session.tool_registry.get(name).execute(args)` → 收集 ToolResult
- 工具结果消息使用 `role: "user"`（Anthropic 格式要求 tool_result 放在 user 消息中）

### 7. AgentSession 胖上下文设计（借鉴 Claude Code ToolUseContext）

**选择:** `AgentSession` 设计为自包含的"胖上下文"结构，携带一次 Agent 执行所需的全部运行时依赖（`AgentConfig`、`Arc<ToolRegistry>`、`Arc<dyn AgentEventEmitter>`、`CancellationToken`）。AgentLoop 函数签名简化为 `async fn agent_loop(session: &mut AgentSession) -> Result<AgentResult, AgentError>`。

**备选:** AgentSession 只含消息和状态，tool_registry / emitter / config / cancel_token 作为 AgentLoop 的独立参数传入。被否决原因：随着 Phase 3-5 引入权限系统、任务注册、memory 管理器，参数列表将从 2 个膨胀到 6+ 个，每次新增能力都要改 AgentLoop 签名；且测试时需要 mock 5 个以上的独立参数。

**实现要点:**
```rust
struct AgentSession {
    // 身份与生命周期
    id: String,
    agent_type: AgentType,
    config: AgentConfig,
    created_at: Instant,
    // 对话状态
    system_prompt: String,
    messages: Vec<ChatMessage>,
    turn_count: usize,
    token_usage: TokenUsage,
    // 运行时依赖（注入）
    tool_registry: Arc<ToolRegistry>,
    emitter: Arc<dyn AgentEventEmitter>,
    cancel_token: CancellationToken,
    // 扩展预留
    task: Option<TaskNode>,  // Phase 4
}
```

**设计约束 — 默认隔离，显式穿透:**
- AgentLoop 通过 `session.emitter.emit()` 推送事件到前端（允许）
- AgentLoop **不直接修改** AppState 全局字段（禁止）
- 未来子 Agent (Phase 4) 中 `emitter` 替换为 no-op，只保留任务注册通道穿透到根 Store

这一设计直接借鉴了 Claude Code 的 `ToolUseContext` 和 `createSubagentContext` 模式：所有可变状态默认隔离、只有明确 opt-in 的通道才允许穿透到共享状态，防止子 Agent 污染主 UI 状态。

### 8. AppState onChange 钩子预留

**选择:** Phase 1 不实现全局 onChange，但在 `AppState` 方法签名上预留扩展点。当前所有状态变更是通过各个 Tauri command 直接操作 `Mutex` 内部字段完成的，分散在 3-4 个函数中。未来变更点增多（权限变更通知、任务状态同步、memory 写入）时，引入集中式 `mutate` 方法统一处理副作用。

**实现要点 (Phase 1 不做，仅注释预留):**
```rust
impl AppState {
    /// Phase 3+: 所有状态变更通过此方法，集中触发副作用
    #[allow(dead_code)]
    fn mutate<R>(&self, f: impl FnOnce(&mut InnerState) -> R) -> R {
        let result = f(&mut self.inner.lock().unwrap());
        // 预留: self.notify_on_change() — 持久化设置、清除缓存、通知前端
        result
    }
}
```

Claude Code 的教训：权限模式变更有 8 条修改路径但只有 2 条正确通知了外部系统。集中式 onChange 可以零遗漏地同步副作用。Phase 1 的副作用还少（主要是事件推送），预留在设计层面即可。

## Risks / Trade-offs

### Risk: DeepSeek/OpenAI 不支持 tool_use → AgentLoop 降级为单轮

**缓解:** AgentLoop 的 `max_turns` 默认为 1 时退化为单轮。非 Anthropic provider 自动设 `max_turns = 1`，只做纯文本回答。后续 Phase 可扩展 OpenAI function calling。

### Risk: 工具执行无超时 → 阻塞 AgentLoop

**缓解:** `ToolExecutor` 用 `tokio::time::timeout` 包裹工具执行，默认 120s 超时。超时后返回 error tool_result，让 LLM 决定重试或放弃。

### Risk: 长工具输出撑爆上下文

**缓解:** 工具输出在 `ToolExecutor` 层截断，默认 8000 字符。截断时追加 `...(truncated)` 标记。完整输出写入临时文件，LLM 需要时可再读取。

### Risk: Agent 循环无限调用 API

**缓解:** `max_turns` 硬上限（默认 30），达到后强制终止并通知用户。同时监控连续相同 tool_use 调用（循环检测），超过 3 次相同调用自动中断。

### Risk: ContentBlock 类型变更导致前端渲染错误

**缓解:** 保留 `content: String` 字段向后兼容，新增字段为 `content_blocks: Option<Vec<ContentBlock>>`。前端渲染逻辑先检查 `content_blocks`，fallback 到 `content`。旧消息无 `content_blocks` 正常展示。

## Open Questions

1. **工具输出的截断阈值**：当前设 8000 字符是否合理？是否需要按工具类型分别配置（文件读取可长，shell 输出需短）？
2. **EchoTool 后的端到端验证完成标准**：仅验证"echo hello"能跑通，还是需要更多的冒烟测试场景？
3. **AgentLoop 错误恢复**：LLM 返回的 tool_use JSON 解析失败时，是直接终止还是将错误作为 tool_result 回传让 LLM 自我纠正？
