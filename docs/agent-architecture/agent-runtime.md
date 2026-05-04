# Agent Runtime — 运行时核心

> 返回 [总览](./agent-architecture-design.md) | 上一级：[架构设计总览](./agent-architecture-design.md)

---

## 概述

Agent Runtime 是架构的中心模块，负责管理 Agent 的整个生命周期：接收用户输入 → 启动 Agent Loop → 循环调用 LLM/执行工具 → 输出最终结果。它是连接 Prompt 系统、工具系统、权限系统的调度核心。

## 状态分层设计

借鉴 Claude Code 的三层状态架构，我们的 Agent 系统也按生命周期和职责分为三层：

```
┌──────────────────────────────────────────────────────────────┐
│  第 1 层: AppState (Rust 全局状态)                             │
│  settings, provider 配置, cancel_tokens, tool_registry        │
│  生命周期: 进程级 · 模块单例 · getter/setter 函数               │
├──────────────────────────────────────────────────────────────┤
│  第 2 层: Zustand Stores (前端 UI 状态)                        │
│  chatStore, settingsStore, agentStore                         │
│  生命周期: React 树级 · useSyncExternalStore 桥接              │
├──────────────────────────────────────────────────────────────┤
│  第 3 层: AgentSession (运行时执行上下文)                       │
│  消息历史, turn_count, 事件发射器, tool 查找, cancel 令牌       │
│  生命周期: 单次 Agent 执行 · 自包含"胖上下文"                   │
└──────────────────────────────────────────────────────────────┘
```

三层设计原则是**向下依赖，向上隔离**：
- AgentSession 可以读取 AppState 的配置（向下访问）
- AgentSession **不直接修改** AppState（向上隔离），通过事件发射器通知外层
- AppState 不知道 AgentSession 的存在（底层不依赖上层）

---

## 架构定位

```
┌──────────────────────────────────────────────────────────┐
│                   Agent Runtime                           │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │                 Agent Loop                          │  │
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
└──────────────────────────────────────────────────────────┘
```

---

## 核心数据结构

### AgentConfig

```rust
/// Agent 运行配置
struct AgentConfig {
    /// 最大循环轮次，防止无限循环消耗 API 额度
    max_turns: usize,           // 默认 30
    /// 上下文窗口 token 预算
    max_tokens: usize,
    /// 允许使用的工具名称列表（空 = 全部允许）
    allowed_tools: Vec<String>,
    /// 单次工具调用超时（秒）
    tool_timeout_secs: u64,     // 默认 120
    /// 工具输出最大字符数（截断阈值）
    tool_output_max_chars: usize, // 默认 8000
    /// 模型名称
    model: String,
}
```

### AgentSession — 胖上下文

AgentSession 是借鉴 Claude Code `ToolUseContext` 设计的**自包含运行时容器**。它携带一次 Agent 执行所需的全部上下文，使 AgentLoop 函数保持简洁、可测试：

```rust
/// 单次 Agent 运行的会话状态 — 自包含"胖上下文"
struct AgentSession {
    // ── 身份与生命周期 ──
    /// 会话唯一标识
    id: String,
    /// Agent 类型
    agent_type: AgentType,
    /// 运行配置（模型、超时、截断阈值等）
    config: AgentConfig,
    /// 会话创建时间
    created_at: Instant,

    // ── 对话状态 ──
    /// 系统提示词
    system_prompt: String,
    /// 对话消息列表（ContentBlock 格式）
    messages: Vec<ChatMessage>,
    /// 已执行的循环轮次
    turn_count: usize,
    /// Token 使用统计
    token_usage: TokenUsage,

    // ── 运行时依赖（注入） ──
    /// 工具注册表 — 查找和执行工具
    tool_registry: Arc<ToolRegistry>,
    /// 事件发射器 — 向前端推送 stream-delta / tool-call / agent-complete
    emitter: Arc<dyn AgentEventEmitter>,
    /// 取消令牌 — 每轮循环和工具执行前检查
    cancel_token: CancellationToken,

    // ── 扩展预留 ──
    /// 当前任务（Phase 4 启用）
    task: Option<TaskNode>,
}

struct TokenUsage {
    input_tokens: usize,
    output_tokens: usize,
    cache_read_tokens: usize,
    cache_write_tokens: usize,
}

enum AgentType {
    GeneralPurpose,   // 通用 Agent
    Explore,          // 代码探索
    Plan,             // 架构规划
    CodeReview,       // 代码审查
}
```

**设计要点：**

1. **AgentSession 自携带依赖，AgentRuntime 变轻** — 旧的 `AgentRuntime` 全局单例持有 `prompt_engine`、`context_manager` 等 Arc 引用，现在这些通过 AgentSession 注入。AgentRuntime 只负责：创建会话、spawn tokio task、管理 cancel_token 映射。

2. **AgentSession 不直接修改 AppState** — Session 通过 `emitter` 向前端推送事件，由外层（Tauri command 或 AppState onChange）决定是否持久化。这避免了 Agent 执行过程中的隐式副作用。

3. **默认隔离，显式穿透** — 未来子 Agent 场景（Phase 4）中，子 Agent 的 AgentSession 会克隆父级但 `emitter` 替换为 no-op，只有任务注册（`setAppStateForTasks`）穿透到根 Store。

### AgentRuntime — 轻量调度器

```rust
/// Agent 运行时 — 调度器，不再持有所有依赖
struct AgentRuntime {
    /// 当前活跃的取消令牌（用于 stop_agent 命令）
    active_cancel_token: Mutex<Option<CancellationToken>>,
    /// 当前活跃会话的 JoinHandle（用于等待完成）
    active_task: Mutex<Option<tokio::task::JoinHandle<()>>>,
}
```

---

## Agent Loop 伪代码

```rust
impl AgentRuntime {
    /// 启动 Agent — 创建胖上下文 Session，spawn 独立 tokio task
    pub async fn run(
        &self,
        user_message: String,
        config: AgentConfig,
        tool_registry: Arc<ToolRegistry>,
        emitter: Arc<dyn AgentEventEmitter>,
    ) -> Result<(), String> {
        let cancel = CancellationToken::new();
        self.active_cancel_token.lock().unwrap().replace(cancel.clone());

        let mut session = AgentSession {
            id: generate_session_id(),
            agent_type: config.agent_type(),
            config,
            system_prompt: build_system_prompt(),
            messages: vec![user_message],
            turn_count: 0,
            token_usage: TokenUsage::default(),
            tool_registry,
            emitter: emitter.clone(),
            cancel_token: cancel.clone(),
            task: None,
            created_at: Instant::now(),
        };

        // AgentLoop 运行在独立 tokio task 上，不阻塞 Tauri command 返回
        let task = tokio::spawn(async move {
            let result = agent_loop(&mut session).await;
            let _ = session.emitter.emit("agent-complete", &result);
        });

        self.active_task.lock().unwrap().replace(task);
        Ok(())
    }

    /// 停止当前 Agent
    pub fn stop(&self) {
        if let Some(cancel) = self.active_cancel_token.lock().unwrap().take() {
            cancel.cancel();
        }
    }
}

/// AgentLoop 核心 — 接收胖上下文 Session，不再需要零散参数
async fn agent_loop(session: &mut AgentSession) -> Result<AgentResult, AgentError> {
    loop {
        // ── 停止条件 ──
        if session.cancel_token.is_cancelled() {
            return Ok(AgentResult::cancelled(session));
        }
        if session.turn_count >= session.config.max_turns {
            return Ok(AgentResult::exhausted(session, "max_turns reached"));
        }

        session.turn_count += 1;

        // ── THINK ──
        let request = build_request(session); // 用 session.messages 构建 Anthropic 请求
        session.emitter.emit("agent-turn", &TurnEvent { turn: session.turn_count })?;

        let response = stream_chat_with_tools(
            &request,
            session.cancel_token.clone(),
            |delta| session.emitter.emit("stream-delta", &delta),
            |tool_call| session.emitter.emit("tool-call", &tool_call),
        ).await?;

        session.token_usage += response.usage;

        // ── 响应分发 ──
        match response {
            LlmResponse::Text(text) => {
                session.add_assistant_message(text);
                return Ok(AgentResult::completed(session));
            }
            LlmResponse::ToolUse(tool_calls) => {
                session.add_assistant_tool_calls(tool_calls.clone());

                // ── ACT + OBSERVE ──
                for tc in &tool_calls {
                    if session.cancel_token.is_cancelled() {
                        return Ok(AgentResult::cancelled(session));
                    }

                    // 在 session 携带的 tool_registry 中查找并执行
                    let result = execute_with_timeout(
                        &session.tool_registry,
                        &tc.name,
                        &tc.input,
                        session.config.tool_timeout_secs,
                    ).await;

                    session.emitter.emit("tool-result", &result)?;
                    session.add_tool_result(tc.id.clone(), result);
                }
                // 继续循环，让 LLM 处理工具结果
            }
            LlmResponse::Stop => {
                return Ok(AgentResult::stopped(session));
            }
        }
    }
}
```

### 函数签名简化对比

```
旧设计:
  agent_loop(
    session: &mut AgentSession,     // 只含消息+状态
    config: &AgentConfig,           // 独立参数
    tool_registry: &ToolRegistry,   // 独立参数
    emitter: &dyn Emitter,          // 独立参数
    cancel: CancellationToken,      // 独立参数
  )

新设计:
  agent_loop(
    session: &mut AgentSession,     // 胖上下文，包含全部运行时依赖
  )
```

AgentLoop 的职责清晰：处理 Think→Act→Observe 循环逻辑。所有"从哪拿工具、向哪发事件、怎么取消"等问题由 AgentSession 内部解决。

---

## 隔离原则：默认 no-op，显式穿透

借鉴 Claude Code 的 `createSubagentContext` 模式，AgentSession 对全局状态的访问遵循隔离原则：

| 操作 | 主 Agent | 子 Agent (Phase 4) |
|------|---------|---------------------|
| `emitter.emit()` 推送 UI 事件 | ✅ 真实 emitter | ❌ no-op（防止 UI 混乱） |
| `tool_registry.get()` 查找工具 | ✅ 完整注册表 | ✅ 子集或共享引用 |
| `cancel_token.cancel()` 停止执行 | ✅ 真实 token | ✅ 链接到父 token（父取消→子取消） |
| 修改 AppState 全局设置 | ❌ 不允许 | ❌ 不允许 |
| 任务注册 (Phase 4) | ✅ 通过 emitter | ✅ **始终穿透**到根 Store |

最后一行是 Claude Code 以血泪教训换来的设计：即使子 Agent 的 UI 操作被隔离，"将 bash 子进程注册到全局任务列表"必须穿透，否则 `PPID=1 zombie` 进程泄漏。

在 Phase 1 中，我们只实现主 Agent 路径，但 `AgentSession` 的字段设计预留了子 Agent 的隔离切换能力。

---

## 停止机制

```rust
/// 用户主动停止 Agent
pub fn stop_agent(state: &AppState) {
    if let Some(runtime) = state.agent_runtime.lock().unwrap().as_ref() {
        runtime.stop(); // 设置 cancel_token → tokio task 下次检查点退出
    }
}
```

使用 tokio 的 `CancellationToken`：
- Agent Loop 每轮迭代开始前检查 `cancel_token.is_cancelled()`
- 每个工具执行前检查（避免串行工具队列中后面的工具继续执行）
- LLM 流式请求传入 `cancel_token.clone()`，在 SSE 读取循环内检查

---

## 事件系统

Agent Runtime 通过 Tauri Events 向前端推送状态：

| 事件名 | 载荷 | 触发时机 |
|--------|------|---------|
| `stream-delta` | `{ delta: String, ... }` | LLM 流式输出每个 token |
| `stream-end` | `{ messageId, fullContent }` | 流式响应完成 |
| `tool-call` | `{ name: String, input: Value }` | 工具开始执行 |
| `tool-result` | `ToolResult` | 工具执行完成 |
| `agent-turn` | `{ turn: usize }` | 每轮循环开始 |
| `agent-complete` | `AgentResult` | Agent 运行结束 |
| `agent-error` | `{ error: String }` | Agent 运行出错 |

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
        session.messages ──────────┤ 构建 LLM 请求           │
        session.config ────────────┤ 超时/截断/上限          │
```

对比旧设计中 AgentRuntime 持有 6 个 Arc 依赖 → 新设计中 AgentRuntime 只管理 cancel_token 和 JoinHandle，所有执行期依赖由 AgentSession 携带。

---

## Tauri Command 接口

```rust
/// 启动 Agent
#[tauri::command]
async fn run_agent(
    app: AppHandle,
    state: State<'_, AppState>,
    payload: RunAgentPayload,
) -> Result<(), String>;

/// 停止当前运行的 Agent
#[tauri::command]
async fn stop_agent(
    state: State<'_, AppState>,
) -> Result<(), String>;

/// 响应用户权限请求（Phase 3 启用，当前预留接口）
#[tauri::command]
async fn respond_permission(
    state: State<'_, AppState>,
    response: PermissionResponse,
) -> Result<(), String>;
```

---

## 扩展预留：AppState onChange 钩子

Phase 1 不做，但设计上预留。当前 Rust 端状态变更散落在各 command 中（settings 写入、流式事件发射、cancel_token 注册），未来变更点增多后会出现"8 条修改路径只有 2 条正确同步"的问题。解决方式：

```rust
// Phase 3+ 引入 — 当前仅在注释中预留
impl AppState {
    fn mutate<R>(&self, f: impl FnOnce(&mut InnerState) -> R) -> R {
        let result = f(&mut self.inner.lock().unwrap());
        // 集中处理: 持久化 settings、清除缓存、通知外部系统
        self.notify_on_change();
        result
    }
}
```

---

> 下一模块：[Prompt System](./prompt-system.md)
