# Agent Runtime — 运行时核心

> 返回 [总览](../agent-architecture-design.md)

---

## 概述

Agent Runtime 是架构的中心模块，负责管理 Agent 的整个生命周期：接收用户输入 → 启动 Agent Loop → 循环调用 LLM/执行工具 → 输出最终结果。

**当前状态:** Phase 1 已完成。Agent 核心循环、会话管理、事件发射器均已实现。支持 Code/Chat 双模式，含完整的 Trace 窗口子系统。

---

## 架构定位

```
┌──────────────────────────────────────────────────────────┐
│                   Agent Runtime                           │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │                 Agent Loop (自由函数)                │  │
│  │                                                     │  │
│  │   ┌────────┐    ┌────────┐    ┌────────┐          │  │
│  │   │ THINK  │───→│  ACT   │───→│OBSERVE │──┐       │  │
│  │   │(LLM调用)│   │(工具执行)│   │(结果处理)│  │       │  │
│  │   └────────┘    └────────┘    └────────┘  │       │  │
│  │        ↑                                   │       │  │
│  │        └───────────────────────────────────┘       │  │
│  │                                                     │  │
│  │   条件: 有tool_calls → 继续 / 无 → 结束             │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│   AgentSession 自携带全部运行时依赖:                        │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│   │ Agent    │ │ 事件     │ │  Tool    │ │ Cancel   │  │
│   │ Config   │ │ 发射器   │ │ Registry │ │ Token    │  │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│   ┌──────────┐                                           │
│   │ LlmClient│                                           │
│   └──────────┘                                           │
└──────────────────────────────────────────────────────────┘
```

---

## 核心数据结构

### AgentConfig

```rust
/// Agent 运行配置
#[derive(Debug, Clone)]
pub struct AgentConfig {
    /// 最大循环轮次，防止无限循环消耗 API 额度（默认 30）
    pub max_turns: usize,
    /// 单次工具调用超时秒数（默认 120）
    pub tool_timeout_secs: u64,
    /// 工具输出最大字符数，超出截断（默认 8000）
    pub tool_output_max_chars: usize,
}
```

### AgentSession — 胖上下文

AgentSession 是自包含的运行时容器，携带一次 Agent 执行所需的全部上下文，使 `agent_loop()` 函数保持简洁：

```rust
pub struct AgentSession {
    // ── 身份 ──
    pub id: String,                    // 格式: "agent-{unix_millis}"
    pub agent_type: String,            // "code" | "chat"
    pub config: AgentConfig,
    pub created_at: u128,              // Unix 毫秒时间戳

    // ── 对话状态 ──
    pub conversation_id: String,       // 前端对话 ID
    pub assistant_message_id: String,  // 前端 assistant 消息 ID
    pub work_dir: Option<String>,      // 工作目录
    pub messages: Vec<ChatMessage>,    // ContentBlock 格式消息列表
    pub turn_count: usize,
    pub token_usage: usize,            // 总 token 用量
    pub input_token_usage: u32,
    pub output_token_usage: u32,
    pub status: AgentStatus,           // Idle → Running → Complete/Cancelled/Error

    // ── 运行时依赖（注入） ──
    pub llm_client: LlmClient,                      // Provider-aware HTTP 客户端
    pub tool_registry: Arc<ToolRegistry>,           // 工具注册表
    pub emitter: Arc<dyn AgentEventEmitter>,        // 事件发射器
    pub cancel_token: CancellationToken,            // 取消令牌
}
```

**AgentType 使用字符串而非枚举**，当前支持 `"code"` 和 `"chat"` 两种：
- **code 模式**: System Prompt 包含工具使用优先级指令 + 工具定义，Agent 可调用工具
- **chat 模式**: 纯对话模式，System Prompt 不含工具指令，不传递工具定义给 LLM

### AgentRuntime — 轻量调度器

```rust
pub struct AgentRuntime {
    /// session_id → CancellationToken（用于 stop_agent）
    cancel_tokens: Mutex<HashMap<String, CancellationToken>>,
    /// session_id → JoinHandle（用于追踪 tokio task）
    handles: Mutex<HashMap<String, JoinHandle<()>>>,
}
```

支持**多 session 并发**：每个 `run_agent` 调用创建独立 session，可以同时取消指定 session。

### AgentEventEmitter trait

```rust
pub trait AgentEventEmitter: Send + Sync {
    fn emit_text_delta(&self, payload: StreamDeltaEvent);
    fn emit_thinking_delta(&self, payload: StreamThinkingEvent);
    fn emit_tool_call(&self, payload: ToolCallEvent);
    fn emit_tool_result(&self, payload: ToolResultEvent);
    fn emit_turn(&self, payload: AgentTurnEvent);
    fn emit_trace_prompt(&self, payload: TracePromptEvent);
    fn emit_trace_thinking_start(&self, payload: TraceThinkingEvent);
    fn emit_trace_thinking_end(&self, payload: TraceThinkingEvent);
    fn emit_complete(&self, payload: AgentCompleteEvent);
}
```

`TauriAgentEventEmitter` 实现此 trait，通过 `app.emit()` 将事件推送到前端。

---

## Agent Loop 实现

`agent_loop()` 是**自由函数**（非 AgentRuntime 方法），接收 `&mut AgentSession`：

```rust
pub async fn agent_loop(session: &mut AgentSession) -> Result<AgentStatus, String> {
    session.set_status(AgentStatus::Running);
    let executor = ToolExecutor::new(
        session.config.tool_timeout_secs,
        session.config.tool_output_max_chars,
    );
    let prompt_engine = PromptEngine::new();

    while session.turn_count < session.config.max_turns {
        // ── 取消检查 ──
        if session.cancel_token.is_cancelled() {
            return complete(session, AgentStatus::Cancelled, "Cancelled").await;
        }

        session.turn_count += 1;
        session.emitter.emit_turn(AgentTurnEvent { ... });

        // ── THINK: 构建 Prompt → 调用 LLM ──
        let tools = if session.agent_type == "chat" {
            Vec::new()  // chat 模式不传工具
        } else {
            session.tool_registry.definitions()
        };
        let session_context = collect_session_context(session.work_dir.as_deref());
        let prompt = prompt_engine.build(&session.agent_type, &session.messages, &tools, &session_context);

        // 发送 Trace 事件
        emitter.emit_trace_prompt(...);       // 完整 Prompt 内容
        emitter.emit_trace_thinking_start(...); // 思考阶段开始

        // 流式 LLM 调用（含 text_delta + thinking_delta + tool_call 回调）
        let stream_result = session.llm_client.stream_chat_with_tools(
            Some(prompt.system_prompt),
            prompt.messages,
            prompt.tools,
            cancel_token,
            |delta| emitter.emit_text_delta(...),
            |delta| emitter.emit_thinking_delta(...),
            |tool_call| { emitter.emit_tool_call(...); tool_calls.push(tool_call); },
            |error| eprintln!("Agent stream error: {}", error),
        ).await?;

        emitter.emit_trace_thinking_end(...);

        // 更新 token 统计
        session.input_token_usage += stream_result.usage.input_tokens;
        session.output_token_usage += stream_result.usage.output_tokens;

        // 记录 assistant 消息
        session.add_assistant_message(stream_result.full_content, tool_blocks);

        // 无工具调用 → 完成
        if tool_calls.is_empty() {
            return complete(session, AgentStatus::Complete, "Complete").await;
        }

        // ── ACT + OBSERVE: 逐个执行工具 ──
        for tool_call in tool_calls {
            let result = match session.tool_registry.get(&tool_call.name) {
                Some(tool) => executor.execute(tool, tool_call.input.clone()).await,
                None => ToolResult { success: false, error: Some("Tool not found"), ... },
            };
            session.emitter.emit_tool_result(...);
            session.add_tool_result(tool_call.id, &result);

            if session.cancel_token.is_cancelled() {
                return complete(session, AgentStatus::Cancelled, "Cancelled").await;
            }
        }
        // 继续循环，让 LLM 处理工具结果
    }

    // 达到 max_turns 上限
    complete(session, AgentStatus::MaxTurnsReached, "Maximum turn limit reached").await
}
```

---

## 停止机制

使用 tokio 的 `CancellationToken`，存储在 `AgentRuntime.cancel_tokens` HashMap 中：

- Agent Loop 每轮迭代开始前检查 `cancel_token.is_cancelled()`
- 每个工具执行后检查（避免串行工具队列中后面的工具继续执行）
- LLM 流式请求传入 `cancel_token.clone()`，在 SSE 读取循环内检查

```rust
// 用户通过 stop_agent 命令停止
pub fn cancel(&self, session_id: &str) -> bool {
    if let Some(token) = self.cancel_tokens.lock().unwrap().get(session_id) {
        token.cancel();
        true
    } else {
        false
    }
}
```

> **注意**: `stop_streaming` 命令当前为空实现。单轮 `send_message` 的流式取消尚未接入 CancellationToken。

---

## 事件系统

Agent Runtime 通过 Tauri Events 向前端推送状态：

| 事件名 | 载荷 | 触发时机 |
|--------|------|---------|
| `stream-delta` | `StreamDeltaEvent` | LLM 流式输出每个文本 token |
| `thinking-delta` | `StreamThinkingEvent` | LLM 流式输出每个思考 token |
| `stream-end` | `StreamEndEvent` | 单轮流式响应完成（`send_message` 使用） |
| `stream-error` | `StreamErrorEvent` | 流式请求出错 |
| `tool-call` | `ToolCallEvent` | LLM 返回 tool_use，工具开始执行 |
| `tool-result` | `ToolResultEvent` | 工具执行完成 |
| `agent-turn` | `AgentTurnEvent` | 每轮循环开始 |
| `agent-complete` | `AgentCompleteEvent` | Agent 运行结束（含状态、token 统计） |
| `trace-prompt` | `TracePromptEvent` | 每轮 LLM 调用的完整 Prompt（system + messages + tools） |
| `trace-thinking-start` | `TraceThinkingEvent` | 思考阶段开始（Trace 窗口用） |
| `trace-thinking-end` | `TraceThinkingEvent` | 思考阶段结束（Trace 窗口用） |

---

## Tauri Command 接口

```rust
/// 启动 Agent 多轮循环
#[tauri::command]
async fn run_agent(app: AppHandle, state: State<'_, AppState>, payload: RunAgentPayload)
    -> Result<String, String>;

/// 停止指定 session 的 Agent
#[tauri::command]
async fn stop_agent(state: State<'_, AppState>, session_id: String)
    -> Result<(), String>;

/// 单轮 LLM 流式聊天（非 Agent 模式）
#[tauri::command]
async fn send_message(app: AppHandle, state: State<'_, AppState>, payload: SendMessagePayload)
    -> Result<(), String>;

/// 停止流式请求（当前为空实现占位）
#[tauri::command]
async fn stop_streaming(conversation_id: String) -> Result<(), String>;
```

---

## 与其它模块的交互

```
AgentRuntime (轻量调度器)
    │
    ├── 创建 AgentSession (胖上下文) ──────────────────────┐
    │                                                      │
    └── spawn tokio::task ─→ agent_loop(&mut session)      │
                                    │                      │
        session.tool_registry ─────┤ 查找 + 执行工具        │
        session.emitter ───────────┤ 推送事件到前端          │
        session.cancel_token ──────┤ 检查取消               │
        session.llm_client ────────┤ 流式 LLM 调用          │
        session.config ────────────┤ 超时/截断/上限          │
        PromptEngine::build() ─────┤ 构建 System Prompt     │
```

---

## 当前限制与待实现

1. **无权限检查** — Agent Loop 绕过工具级 `check_permissions()`，直接执行所有工具（Phase 3 规划）
2. **Agent Loop 未切换并发执行** — `ToolExecutor.execute_batch()` 已实现并发分区，但 Agent Loop 仍逐个串行执行工具（Phase 7 切换）
3. **无上下文裁剪** — 长对话没有 token 预算管理和自动压缩（Phase 3 规划）
4. **单 Agent 运行** — 不支持子 Agent 委托（Phase 4 规划）
5. **无会话序列化** — 崩溃后无法恢复会话（Phase 7 规划）
6. **`agent_type` 用字符串非枚举** — 缺少编译期类型检查，新增 Agent 类型需同步多处

---

> 下一模块：[Prompt System](./prompt-system.md)
