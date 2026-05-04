# Hooks System — 钩子系统

> 返回 [总览](../agent-architecture-design.md) | 上一模块：[Worktree Isolation](./worktree-isolation.md) | 下一模块：[Slash Commands](./slash-commands.md)

---

## 概述

Hooks System 允许用户和项目在 Agent 生命周期关键节点挂载自定义脚本，实现行为扩展。这是扩展性的核心机制——不是所有逻辑都需要硬编码在 Rust 中。

## 设计理念

- **事件驱动** — 挂钩在特定事件前后触发
- **脚本无关** — 任何可执行文件（Shell、Python、Node）都可以作为 Hook
- **逐级配置** — 用户级（`~/.code-agent/hooks/`）和项目级（`.claude/hooks/`）两层
- **非阻塞优先** — Hook 默认不阻塞 Agent 流程（可选阻塞模式）

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                    Hooks System                          │
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │               Hook Registry                      │     │
│  │                                                  │     │
│  │  Session       Tool          Agent      System  │     │
│  │  Hooks         Hooks         Hooks      Hooks   │     │
│  │                                                  │     │
│  │  • start       • pre-call    • turn      • idle  │     │
│  │  • end         • post-call   • complete  • error │     │
│  │  • approve                                             │
│  └────────────────────────────────────────────────┘     │
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │             Hook Executor                        │     │
│  │                                                  │     │
│  │  stdin → 上下文 JSON                             │     │
│  │  stdout → 日志 (可影响行为)                       │     │
│  │  退出码 → 0=成功, 非0=失败                        │     │
│  └────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

## Hook 事件清单

### Session Hooks（会话生命周期）

| Hook | 触发时机 | 是否可阻塞 |
|------|---------|-----------|
| `session-start` | 新会话初始化后 | 否 |
| `user-prompt-submit` | 用户提交消息前 | 是（可拒绝） |
| `session-end` | 会话结束/清理前 | 否 |

### Tool Hooks（工具执行前后）

| Hook | 触发时机 | 是否可阻塞 |
|------|---------|-----------|
| `pre-tool-call` | 工具执行前 | 是（可拒绝） |
| `post-tool-call` | 工具执行后 | 否 |

### Agent Hooks（Agent 行为）

| Hook | 触发时机 | 是否可阻塞 |
|------|---------|-----------|
| `agent-turn` | Agent 每轮循环后 | 否 |
| `agent-complete` | Agent 完成任务时 | 否 |

### System Hooks（系统事件）

| Hook | 触发时机 | 是否可阻塞 |
|------|---------|-----------|
| `idle` | 用户长时间无操作 | 否 |
| `error` | Agent 遇到错误时 | 否 |

## 核心数据结构

```rust
/// Hook 配置
struct HookConfig {
    /// Hook 名称
    name: String,
    /// Hook 类型（对应事件）
    event: HookEvent,
    /// 执行命令
    command: String,
    /// 工作目录
    workdir: Option<PathBuf>,
    /// 超时（毫秒）
    timeout_ms: u64,
    /// 是否阻塞 Agent 流程（等待 Hook 执行完）
    blocking: bool,
    /// 是否启用
    enabled: bool,
}

/// Hook 事件类型
enum HookEvent {
    SessionStart,
    UserPromptSubmit,
    SessionEnd,
    PreToolCall,
    PostToolCall,
    AgentTurn,
    AgentComplete,
    Idle,
    Error,
}

/// 传递给 Hook 脚本的上下文
#[derive(Serialize)]
struct HookContext {
    /// 事件类型
    event: String,
    /// 会话 ID
    session_id: String,
    /// 项目路径
    project_path: String,
    /// 事件相关数据
    data: Value,
    /// 时间戳
    timestamp: u64,
}

/// Hook 执行结果
struct HookResult {
    /// 是否成功
    success: bool,
    /// 标准输出
    stdout: String,
    /// 标准错误
    stderr: String,
    /// 退出码
    exit_code: i32,
    /// 执行耗时
    duration_ms: u64,
}
```

## HookManager 实现

```rust
struct HookManager {
    /// 钩子注册表
    hooks: HashMap<HookEvent, Vec<HookConfig>>,
    /// 钩子脚本目录（用户级）
    user_hooks_dir: PathBuf,
    /// 钩子脚本目录（项目级）
    project_hooks_dir: PathBuf,
}

impl HookManager {
    /// 从配置文件加载钩子
    fn load(&mut self) -> Result<(), String> {
        self.hooks.clear();

        // 加载项目级配置
        let project_config = self.project_hooks_dir.join("hooks.json");
        if project_config.exists() {
            let configs: Vec<HookConfig> = serde_json::from_str(
                &std::fs::read_to_string(&project_config)?
            )?;
            for config in configs {
                self.register(config);
            }
        }

        // 加载用户级配置
        let user_config = self.user_hooks_dir.join("hooks.json");
        if user_config.exists() {
            let configs: Vec<HookConfig> = serde_json::from_str(
                &std::fs::read_to_string(&user_config)?
            )?;
            for config in configs {
                self.register(config);
            }
        }

        Ok(())
    }

    /// 注册钩子
    fn register(&mut self, config: HookConfig) {
        self.hooks
            .entry(config.event.clone())
            .or_default()
            .push(config);
    }

    /// 触发事件（执行所有匹配的钩子）
    async fn trigger(
        &self,
        event: HookEvent,
        context: HookContext,
    ) -> Vec<HookResult> {
        let hooks = self.hooks.get(&event);
        if hooks.is_none() {
            return Vec::new();
        }

        let mut results = Vec::new();
        for hook in hooks.unwrap() {
            if !hook.enabled {
                continue;
            }

            let result = self.execute_hook(hook, &context).await;
            results.push(result);
        }
        results
    }

    /// 执行单个钩子脚本
    async fn execute_hook(
        &self,
        hook: &HookConfig,
        context: &HookContext,
    ) -> HookResult {
        let start = Instant::now();

        let context_json = serde_json::to_string(context).unwrap_or_default();

        let result = tokio::time::timeout(
            Duration::from_millis(hook.timeout_ms),
            async {
                let output = Command::new(&hook.command)
                    .current_dir(hook.workdir.as_deref().unwrap_or(&self.project_hooks_dir))
                    .stdin(std::process::Stdio::piped())
                    .stdout(std::process::Stdio::piped())
                    .stderr(std::process::Stdio::piped())
                    .output()
                    .await;

                match output {
                    Ok(o) => HookResult {
                        success: o.status.success(),
                        stdout: String::from_utf8_lossy(&o.stdout).to_string(),
                        stderr: String::from_utf8_lossy(&o.stderr).to_string(),
                        exit_code: o.status.code().unwrap_or(-1),
                        duration_ms: start.elapsed().as_millis() as u64,
                    },
                    Err(e) => HookResult {
                        success: false,
                        stdout: String::new(),
                        stderr: e.to_string(),
                        exit_code: -1,
                        duration_ms: start.elapsed().as_millis() as u64,
                    },
                }
            },
        ).await;

        result.unwrap_or(HookResult {
            success: false,
            stdout: String::new(),
            stderr: format!("Hook '{}' timed out after {}ms", hook.name, hook.timeout_ms),
            exit_code: -1,
            duration_ms: hook.timeout_ms,
        })
    }
}
```

## Hook 配置示例

```json
// .claude/hooks/hooks.json
{
  "hooks": [
    {
      "name": "log-tool-calls",
      "event": "post-tool-call",
      "command": "node .claude/hooks/log-tool-call.js",
      "timeout_ms": 5000,
      "blocking": false,
      "enabled": true
    },
    {
      "name": "precommit-check",
      "event": "pre-tool-call",
      "command": ".claude/hooks/check-dangerous.sh",
      "timeout_ms": 10000,
      "blocking": true,
      "enabled": true
    },
    {
      "name": "notify-complete",
      "event": "agent-complete",
      "command": "python .claude/hooks/notify.py",
      "timeout_ms": 3000,
      "blocking": false,
      "enabled": true
    }
  ]
}
```

## 在 Agent Loop 中的调用点

```rust
// Agent Loop 中
async fn agent_loop(session: &mut AgentSession, hooks: &HookManager) {
    // Session Start Hook
    hooks.trigger(HookEvent::SessionStart, session.to_context()).await;

    loop {
        // User Prompt Submit Hook (阻塞式)
        let results = hooks.trigger(HookEvent::UserPromptSubmit, context).await;
        if results.iter().any(|r| !r.success) {
            // Hook 拒绝了请求
            break;
        }

        // ... LLM 调用 ...

        for tc in &tool_calls {
            // Pre-Tool-Call Hook
            hooks.trigger(HookEvent::PreToolCall, tool_context(&tc)).await;

            let result = tool_executor.execute(&tc).await;

            // Post-Tool-Call Hook
            hooks.trigger(HookEvent::PostToolCall, result_context(&tc, &result)).await;
        }

        // Agent Turn Hook
        hooks.trigger(HookEvent::AgentTurn, turn_context(session)).await;
    }

    // Agent Complete Hook
    hooks.trigger(HookEvent::AgentComplete, session.to_context()).await;
}
```

## 安全考虑

- Hook 脚本运行在用户权限下，不是沙箱
- Hook 脚本的输出会被记录但不影响 Agent 行为（除非 `blocking: true` 且返回非 0）
- 超时机制防止 Hook 阻塞 Agent
- 用户可以全局禁用所有 Hook（安全模式）

---

> 上一模块：[Worktree Isolation](./worktree-isolation.md) | 下一模块：[Slash Commands](./slash-commands.md)
> 返回 [总览](../agent-architecture-design.md)
