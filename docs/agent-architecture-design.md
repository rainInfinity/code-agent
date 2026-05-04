# Code Agent 架构设计方案

> 目标：将当前单轮对话式 AI 改造为类似 Codex 的 AI Agent 辅助编程系统

---

## 文档索引

各系统模块独立成文，以下为完整索引：

| 模块 | 文档 | 职责 |
|------|------|------|
| Agent Runtime | [agent-runtime.md](agent-architecture/agent-runtime.md) | 核心循环 Think→Act→Observe，管理 Session 生命周期 |
| Prompt System | [prompt-system.md](agent-architecture/prompt-system.md) | 动态组装 System Prompt + 工具定义 + 上下文 |
| Context Manager | [context-manager.md](agent-architecture/context-manager.md) | Token 预算管理 + 历史消息裁剪 + 摘要压缩 |
| Prompt Cache | [prompt-cache.md](agent-architecture/prompt-cache.md) | Anthropic Prompt Caching，缓存 System Prompt 和工具定义 |
| Tool System | [tool-system.md](agent-architecture/tool-system.md) | 工具注册/执行/沙箱/超时，read_file/bash/grep 等 |
| Agent System | [agent-system.md](agent-architecture/agent-system.md) | 多 Agent 注册/路由/委托，Explore/Plan/General/Review |
| Task System | [task-system.md](agent-architecture/task-system.md) | 任务拆解为树形结构，状态流转与进度追踪 |
| Permission System | [permission-system.md](agent-architecture/permission-system.md) | 分级权限 Safe/Moderate/Dangerous，用户确认弹窗 |
| Memory System | [memory-system.md](agent-architecture/memory-system.md) | 跨会话持久化记忆，用户偏好/项目背景/工作反馈 |
| Plan Mode | [plan-mode.md](agent-architecture/plan-mode.md) | 实施前探索→设计→审批的工作流约束 |
| Worktree Isolation | [worktree-isolation.md](agent-architecture/worktree-isolation.md) | Git worktree 隔离文件操作，不影响用户主工作区 |
| Hooks System | [hooks-system.md](agent-architecture/hooks-system.md) | 生命周期事件挂钩脚本，用户自定义 Agent 行为 |
| Slash Commands | [slash-commands.md](agent-architecture/slash-commands.md) | `/help`、`/clear`、`/compact` 等内置控制命令 |

---

## 1. 当前架构分析

### 1.1 现有架构

```
┌──────────────────────────────────────────────────────┐
│                   Frontend (React 19)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ chatStore│  │settingsSt│  │  Chat Components │   │
│  │(Zustand) │  │(Zustand) │  │  (MessageList,   │   │
│  └──────────┘  └──────────┘  │   MessageInput..) │   │
│                               └──────────────────┘   │
│                    │ IPC (invoke/events)              │
└────────────────────┼─────────────────────────────────┘
                     │
┌────────────────────┼─────────────────────────────────┐
│                Backend (Rust/Tauri)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ commands │  │  models  │  │    providers/     │   │
│  │          │  │          │  │ Anthropic/DeepSeek│   │
│  │send_msg  │  │ChatMsg   │  │ /OpenAI           │   │
│  │save_set  │  │Settings  │  └──────────────────┘   │
│  └──────────┘  └──────────┘                         │
│  ┌──────────┐  ┌──────────┐                         │
│  │  tools   │  │   llm    │  ← Tool trait 已定义    │
│  │(未集成)  │  │  Client  │    但未接入对话循环     │
│  └──────────┘  └──────────┘                         │
└─────────────────────────────────────────────────────┘
```

### 1.2 现有能力 vs 目标能力

| 能力 | 当前状态 | 目标状态 |
|------|---------|---------|
| 多 Provider | ✅ Anthropic/OpenAI/DeepSeek | 保持，扩展为 Agent 模式 |
| 流式响应 | ✅ SSE streaming | 保持，扩展为 tool-use streaming |
| 工具系统 | ⚠️ Tool trait 已定义，未集成 | ✅ 完整工具注册/执行/结果回传 → [Tool System](agent-architecture/tool-system.md) |
| 对话循环 | ❌ 单轮请求-响应 | ✅ 多轮 Think→Act→Observe 循环 → [Agent Runtime](agent-architecture/agent-runtime.md) |
| 上下文管理 | ❌ 无 | ✅ Token 感知的窗口管理 → [Context Manager](agent-architecture/context-manager.md) |
| Prompt 缓存 | ❌ 无 | ✅ Anthropic prompt cache → [Prompt Cache](agent-architecture/prompt-cache.md) |
| Prompt 系统 | ❌ 硬编码 | ✅ 模板化分层组装 → [Prompt System](agent-architecture/prompt-system.md) |
| 任务系统 | ❌ 无 | ✅ 任务拆解与追踪 → [Task System](agent-architecture/task-system.md) |
| 权限系统 | ❌ 无 | ✅ 分级权限与用户确认 → [Permission System](agent-architecture/permission-system.md) |
| 多 Agent | ❌ 无 | ✅ 专职 Agent 调度 → [Agent System](agent-architecture/agent-system.md) |
| 记忆系统 | ❌ 无 | ✅ 跨会话持久化记忆 → [Memory System](agent-architecture/memory-system.md) |
| 规划模式 | ❌ 无 | ✅ 实施前探索→设计→审批 → [Plan Mode](agent-architecture/plan-mode.md) |
| 工作区隔离 | ❌ 无 | ✅ Git worktree 隔离 → [Worktree Isolation](agent-architecture/worktree-isolation.md) |
| 钩子系统 | ❌ 无 | ✅ 生命周期事件挂钩 → [Hooks System](agent-architecture/hooks-system.md) |
| 内置命令 | ❌ 仅 Tauri Commands | ✅ `/help`、`/clear` 等控制命令 → [Slash Commands](agent-architecture/slash-commands.md) |

### 1.3 关键缺口

1. `commands::send_message` 只做一次 LLM 调用，没有 Agent 循环
2. `tools.rs` 的 `ToolRegistry` 未在 `send_message` 中使用
3. 没有 token 计数 / 上下文窗口管理
4. `stop_streaming` 是空实现（无 CancellationToken）
5. 前端用 `useChat` hook 手动编排流程，无法支持自主 Agent
6. 无跨会话记忆 — 每次对话从零开始，Agent 不记得用户偏好
7. 无规划审批 — Agent 直接执行复杂任务，可能偏离用户意图
8. 文件操作无隔离 — Agent 修改直接影响用户工作区
9. 无可扩展性机制 — 用户无法自定义 Agent 行为
10. 无内置控制命令 — 用户只能通过 Tauri 命令与 Agent 交互

---

## 2. 目标架构总览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Frontend (React 19)                               │
│                                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐ │
│  │ Chat UI  │ │  Task    │ │Permission│ │  Plan    │ │  Slash Cmd    │ │
│  │          │ │ Tracker  │ │  Dialog  │ │ Approval │ │  Autocomplete │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └───────┬───────┘ │
│       └─────────────┴────────────┴────────────┴───────────────┘          │
│                                    │                                      │
│                    Tauri IPC (invoke 命令 + listen 事件)                   │
└──────────────────────────────────────────────────────────────────────────┘
                                     │
┌──────────────────────────────────────────────────────────────────────────┐
│                       Backend (Rust/Tauri)                                 │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                      Agent Runtime                                  │ │
│  │                                                                     │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │                   Agent Loop                                  │  │ │
│  │  │                                                               │  │ │
│  │  │         ┌────────┐    ┌────────┐    ┌────────┐               │  │ │
│  │  │         │ THINK  │───→│  ACT   │───→│OBSERVE │──┐            │  │ │
│  │  │         │(LLM调用)│   │(工具执行)│   │(结果处理)│  │            │  │ │
│  │  │         └────────┘    └────────┘    └────────┘  │            │  │ │
│  │  │              ↑                                   │            │  │ │
│  │  │              └───────────────────────────────────┘            │  │ │
│  │  │                                                               │  │ │
│  │  │  ┌─────────────────────────────────────────────────────┐     │  │ │
│  │  │  │  Mode Switch: Normal ←→ Plan ⇄ Awaiting Approval    │     │  │ │
│  │  │  │               → Implement (在隔离 worktree 中)      │     │  │ │
│  │  │  └─────────────────────────────────────────────────────┘     │  │ │
│  │  └──────────────────────────────────────────────────────────────┘  │ │
│  │                                                                     │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │ │
│  │  │  Agent   │ │  Task    │ │Permission│ │ Session  │ │ Worktree │ │ │
│  │  │ Manager  │ │ Manager  │ │ Manager  │ │ Manager  │ │ Manager  │ │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │ │
│  │  ┌──────────┐ ┌──────────┐                                        │ │
│  │  │  Memory  │ │  Hooks   │                                        │ │
│  │  │ Manager  │ │ Manager  │                                        │ │
│  │  └──────────┘ └──────────┘                                        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Prompt   │ │ Context  │ │  Tool    │ │  LLM     │ │  Command      │  │
│  │ Engine   │ │ Manager  │ │ Executor │ │  Client  │ │  Registry     │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│  ┌──────────┐                                                            │
│  │  Cache   │                                                            │
│  │ Manager  │                                                            │
│  └──────────┘                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

### 核心设计原则

1. **Agent Loop 在 Rust 端** — 前端只负责 UI 渲染和权限确认，不参与循环逻辑
2. **事件驱动** — Rust 通过 Tauri events 向前端推送状态（tool_call, permission_request, progress, error）
3. **异步 + 可取消** — 所有 Agent 运行在 tokio task 上，通过 CancellationToken 实现停止
4. **工具沙箱** — 所有工具执行在可控范围内，危险操作需用户确认
5. **模块解耦** — 每个系统独立模块，通过 trait 定义接口

---

## 3. 核心系统概览

各系统的详细设计请参阅独立文档，以下为系统间的关系总览：

```
AgentRuntime (agent-runtime.md)
    │
    ├── PlanMode 判断 → 非平凡任务先探索→设计→审批
    │      └── 审批通过 → Implement (切换 Worktree)
    │
    ├── 调用 PromptEngine (prompt-system.md)
    │      └── 内部调用 ContextManager (context-manager.md)
    │             └── 输出裁剪后的消息列表
    │      └── 注入 MemoryManager.index_summary() (memory-system.md)
    │      └── 标记 PromptCache 断点 (prompt-cache.md)
    │
    ├── 调用 LlmClient → LLM Provider
    │
    ├── 解析响应 → 如有 tool_use:
    │      ├── HooksManager.trigger(PreToolCall) (hooks-system.md)
    │      ├── PermissionManager.check() (permission-system.md)
    │      ├── ToolExecutor.execute() (tool-system.md)
    │      │      └── Sandbox 检查 → Worktree 路径隔离 (worktree-isolation.md)
    │      ├── HooksManager.trigger(PostToolCall) (hooks-system.md)
    │      └── TaskManager.record() (task-system.md)
    │
    ├── 由 AgentManager 管理 Agent 类型和路由 (agent-system.md)
    │
    └── 用户输入 /command → CommandRegistry 拦截 (slash-commands.md)
           ├── 本地命令 → 直接处理
           └── Agent 命令 → 委派给 Agent Loop
```

### Agent Loop 核心伪代码

```rust
async fn agent_loop(session: &mut AgentSession, cancel: CancellationToken) {
    loop {
        if cancel.is_cancelled() || session.turn_count >= config.max_turns { break; }

        // THINK: 构建 Prompt → 调用 LLM
        let request = prompt_engine.build(session)?;
        let response = llm_client.stream_chat_with_tools(request, cancel.clone()).await?;

        match response {
            LlmResponse::Text(text) => {
                emit_complete(text);  // 纯文本 → 结束
                break;
            }
            LlmResponse::ToolUse(tool_calls) => {
                for tc in tool_calls {
                    // 权限检查
                    if !permission_manager.check(&tc).await? { continue; }
                    // ACT + OBSERVE: 执行工具 → 结果入上下文
                    let result = tool_executor.execute(&tc).await;
                    session.add_tool_result(tc.id, result);
                }
                // 继续循环，让 LLM 处理工具结果
            }
        }
    }
}
```

> 完整实现细节见: [Agent Runtime](agent-architecture/agent-runtime.md)

### 3.1 工作模式切换（Plan Mode）

Plan Mode 在 Agent Loop 之上施加工作流约束，防止 Agent 在不明确的复杂任务上浪费精力：

```
用户请求 → [意图分析] → 简单任务? → 直接执行
                      → 非平凡任务? → Plan Mode
                            ├── 1. 探索代码库
                            ├── 2. 设计方案
                            ├── 3. 写计划文件 → 请求审批
                            └── 4. 用户批准 → Implement Mode
                                    └── 在隔离 Worktree 中执行
```

> 完整设计见: [Plan Mode](agent-architecture/plan-mode.md)

### 3.2 工作区隔离（Worktree Isolation）

Implement Mode 下，Agent 的文件操作在 `git worktree` 隔离环境中进行：

```
Agent 写文件 → worktree (branch: wt-sess_xxx)
                      │
              用户审查 git diff
                      │
              ┌───────┴───────┐
              ▼               ▼
         合并到主分支      丢弃 worktree
```

> 完整设计见: [Worktree Isolation](agent-architecture/worktree-isolation.md)

### 3.3 记忆系统（Memory System）

跨会话持久化记忆，让 Agent 在新对话中"记得"用户偏好和项目背景：

```
~/.code-agent/memory/
├── MEMORY.md           ← 索引（始终加载，<200 行）
├── user_role.md        ← 用户角色/偏好/背景
├── feedback_xxx.md     ← 工作方式纠正/确认
├── project_xxx.md      ← 项目上下文/决策理由
└── reference_xxx.md    ← 外部系统指针
```

在 System Prompt 中注入记忆索引摘要，Agent 按需读取具体记忆。

> 完整设计见: [Memory System](agent-architecture/memory-system.md)

### 3.4 钩子系统（Hooks System）

用户可通过脚本在 Agent 生命周期事件上挂载自定义行为：

| 事件 | 触发时机 | 可阻塞 |
|------|---------|--------|
| `pre-tool-call` | 工具执行前 | 是 |
| `post-tool-call` | 工具执行后 | 否 |
| `session-start` | 会话初始化 | 否 |
| `user-prompt-submit` | 用户提交消息 | 是 |
| `agent-turn` | 每轮循环结束 | 否 |
| `agent-complete` | Agent 完成 | 否 |

> 完整设计见: [Hooks System](agent-architecture/hooks-system.md)

### 3.5 内置命令系统（Slash Commands）

用户通过 `/command` 语法直接控制 Agent，不经过 LLM：

```
用户输入 → 前缀匹配 / → CommandRegistry 路由
                        ├── 本地命令: /help, /clear, /compact, /diff, /undo
                        ├── 后端命令: /config, /model
                        └── Agent 命令: /task, /plan, /review
```

> 完整设计见: [Slash Commands](agent-architecture/slash-commands.md)

---

## 4. 数据流全景

### 4.1 完整交互时序

```
User          Frontend           Rust Backend           LLM API
 │               │                    │                    │
 │ "创建一个     │                    │                    │
 │  React 组件"  │                    │                    │
 │──────────────→│                    │                    │
 │               │ run_agent()        │                    │
 │               │───────────────────→│                    │
 │               │                    │ 构建 Prompt        │
 │               │                    │──── Call LLM ─────→│
 │               │    stream-delta    │←─── Stream ────────│
 │               │←───────────────────│                    │
 │               │                    │  响应: tool_use    │
 │               │                    │  write_file(...)   │
 │               │ permission-request │                    │
 │               │←───────────────────│                    │
 │  [用户点允许] │                    │                    │
 │──────────────→│                    │                    │
 │               │ respond_permission │                    │
 │               │───────────────────→│                    │
 │               │                    │ 执行 write_file    │
 │               │ tool-result        │                    │
 │               │←───────────────────│                    │
 │               │                    │ 结果加入上下文      │
 │               │                    │──── Call LLM ─────→│
 │               │                    │←─── Stream ────────│
 │               │    stream-delta    │                    │
 │               │←───────────────────│  响应: text        │
 │               │ agent-complete     │                    │
 │               │←───────────────────│                    │
```

### 4.2 Tauri 命令和事件清单

**Commands (Frontend → Backend):**

| 命令 | 说明 | 涉及模块 |
|------|------|---------|
| `run_agent` | 启动 Agent | Agent Runtime |
| `stop_agent` | 取消当前 Agent | Agent Runtime |
| `respond_permission` | 响应用户权限请求 | Permission System |
| `create_task` | 手动创建任务 | Task System |
| `save_settings` | 已有 — 保存设置 | — |
| `load_settings` | 已有 — 加载设置 | — |
| `list_models` | 已有 — 列出模型 | — |

**Events (Backend → Frontend):**

| 事件 | 说明 | 涉及模块 |
|------|------|---------|
| `stream-delta` | 已有 — LLM 文本流 | Agent Runtime |
| `stream-end` | 已有 — 流结束 | Agent Runtime |
| `tool-call` | 工具正在被调用 | Tool System |
| `tool-result` | 工具执行结果 | Tool System |
| `permission-request` | 请求用户权限 | Permission System |
| `agent-turn` | Agent 完成一轮循环 | Agent Runtime |
| `agent-complete` | Agent 运行完成 | Agent Runtime |
| `task-created/updated/completed` | 任务状态变更 | Task System |

---

## 5. 模块结构

### 5.1 Rust 后端模块

```
src-tauri/src/
├── main.rs                    # 入口
├── lib.rs                     # Tauri 启动配置
├── commands.rs                # Tauri Commands (精简，委托给各模块)
├── models.rs                  # 已有 — 扩展数据模型
│
├── agent/                     # [Agent Runtime + Agent System]
│   ├── mod.rs
│   ├── runtime.rs             # AgentRuntime + AgentLoop
│   ├── session.rs             # AgentSession
│   ├── config.rs              # AgentConfig
│   ├── manager.rs             # AgentManager (多 Agent 管理)
│   └── types.rs               # AgentType, AgentMode, 事件定义
│
├── plan/                      # [Plan Mode] — 新增
│   ├── mod.rs
│   ├── mode.rs                # PlanMode 状态机
│   ├── plan_file.rs           # 计划文件读写
│   └── approval.rs            # 审批流程
│
├── prompt/                    # [Prompt System]
│   ├── mod.rs
│   ├── engine.rs              # PromptEngine
│   ├── templates.rs           # PromptTemplate
│   └── builtins.rs            # 内置 Prompt 常量
│
├── context/                   # [Context Manager]
│   ├── mod.rs
│   ├── manager.rs             # ContextManager
│   ├── token_counter.rs       # Token 计数器
│   └── policy.rs              # 裁剪策略
│
├── cache/                     # [Prompt Cache]
│   ├── mod.rs
│   └── manager.rs             # PromptCacheManager
│
├── tools/                     # [Tool System] — 扩展现有
│   ├── mod.rs                 # Tool trait + ToolRegistry
│   ├── executor.rs            # ToolExecutor
│   ├── sandbox.rs             # Sandbox 配置
│   ├── file.rs                # read_file, write_file, edit_file
│   ├── search.rs              # grep, glob, list_directory
│   ├── shell.rs               # bash, powershell
│   ├── web.rs                 # web_search, web_fetch
│   └── git.rs                 # git_diff, git_log
│
├── memory/                    # [Memory System] — 新增
│   ├── mod.rs
│   ├── manager.rs             # MemoryManager
│   ├── entry.rs               # MemoryEntry, MemoryType
│   └── index.rs               # MEMORY.md 索引解析
│
├── worktree/                  # [Worktree Isolation] — 新增
│   ├── mod.rs
│   └── manager.rs             # WorktreeManager
│
├── hooks/                     # [Hooks System] — 新增
│   ├── mod.rs
│   ├── manager.rs             # HookManager
│   ├── config.rs              # HookConfig, HookEvent
│   └── executor.rs            # Hook 脚本执行器
│
├── commands/                   # [Slash Commands] — 新增
│   ├── mod.rs
│   ├── registry.rs            # CommandRegistry
│   ├── parser.rs              # CommandParser
│   └── handlers.rs            # 各命令处理函数
│
├── permission/                # [Permission System]
│   ├── mod.rs
│   ├── manager.rs             # PermissionManager
│   └── policy.rs              # PermissionPolicy, PermissionLevel
│
├── task/                      # [Task System]
│   ├── mod.rs
│   ├── manager.rs             # TaskManager
│   ├── tree.rs                # TaskNode, TaskTree
│   └── tracker.rs             # 进度跟踪
│
├── llm.rs                     # 已有 — LlmClient (扩展 tool_use)
└── providers/                 # 已有 — Provider trait + 实现
    ├── mod.rs
    ├── anthropic.rs           # 扩展 tool_use 支持
    ├── openai.rs
    └── deepseek.rs
```

### 5.2 前端模块

```
src/
├── agent/                     # Agent 选择与配置 (新增)
│   ├── AgentProvider.tsx
│   ├── useAgent.ts
│   └── AgentConfigPanel.tsx
│
├── plan/                      # 计划审批 UI (新增)
│   ├── PlanApprovalDialog.tsx
│   └── usePlanApproval.ts
│
├── permission/                # 权限确认 UI (新增)
│   ├── PermissionDialog.tsx
│   └── usePermission.ts
│
├── task/                      # 任务追踪 UI (新增)
│   ├── TaskPanel.tsx
│   ├── TaskTree.tsx
│   └── useTaskTracker.ts
│
├── worktree/                  # 工作区变更 UI (新增)
│   ├── WorktreePanel.tsx
│   └── useWorktree.ts
│
├── commands/                   # 命令自动补全 (新增)
│   ├── CommandAutocomplete.tsx
│   └── useCommandParser.ts
│
├── stores/
│   ├── chatStore.ts           # 已有 — 扩展 Agent 状态
│   ├── settingsStore.ts       # 已有
│   ├── agentStore.ts          # Agent 运行时状态 (新增)
│   ├── taskStore.ts           # 任务状态 (新增)
│   └── planStore.ts           # Plan Mode 状态 (新增)
│
├── hooks/
│   ├── useChat.ts             # 已有 — 改为 useAgent
│   └── useIpc.ts              # 已有 — 扩展新命令和事件
│
├── types/
│   └── index.ts               # 已有 — 扩展 Agent 类型
│
└── components/                # 已有 — UI 组件
```

---

## 6. 实施路线图

分 7 个阶段实施，每个阶段可独立验证。

### Phase 1: Agent 核心循环 (P0)

**目标:** 把单轮对话变成多轮 Tool-Use 循环

- [ ] 实现 `AgentRuntime` + `AgentLoop`
- [ ] 扩展 `LlmClient` 支持 Anthropic tool_use 流式响应
- [ ] 扩展 `ChatMessage` 支持 `ContentBlock` (text + tool_use + tool_result)
- [ ] 将现有 `EchoTool` 接入 Agent Loop 验证端到端
- [ ] 实现真正的 `stop_streaming` (CancellationToken)
- [ ] 前端从 `useChat` 迁移到 `useAgent`

**验证:** 用户说"echo hello"，Agent 自动调用 echo 工具并返回结果

### Phase 2: 工具系统完善 (P0)

**目标:** 实现核心开发工具

- [ ] `read_file` / `write_file` / `edit_file` — 文件操作
- [ ] `grep` / `glob` / `list_directory` — 代码搜索
- [ ] `bash` / `powershell` — Shell 执行
- [ ] `ToolExecutor` — 带超时和输出截断的执行器
- [ ] `Sandbox` — 基本路径限制

**验证:** Agent 可以读文件、搜索代码、执行简单命令

### Phase 3: 权限 + 上下文 + 内置命令 (P1)

**目标:** 安全可控的 Agent 行为 + 用户控制面

- [ ] `PermissionManager` + 前端权限弹窗
- [ ] `ContextManager` + Token 计数
- [ ] 上下文裁剪策略
- [ ] `PromptEngine` — 可配置的 System Prompt
- [ ] `CommandRegistry` + `/help`、`/clear`、`/compact`、`/diff` 等内置命令
- [ ] 前端命令自动补全

**验证:** 危险操作需要用户确认；`/clear` 清除会话；长对话自动裁剪历史

### Phase 4: 多 Agent + 任务系统 (P1)

**目标:** 专职 Agent 和任务追踪

- [ ] `AgentManager` + Agent 注册/路由
- [ ] `TaskManager` + 任务树
- [ ] 前端 TaskPanel 展示任务进度
- [ ] Agent 间委托机制

**验证:** 复杂请求自动拆解为子任务并追踪进度

### Phase 5: 记忆 + 规划 + 隔离 (P1)

**目标:** 持久化记忆、工作流约束、文件安全隔离

- [ ] `MemoryManager` — user/feedback/project/reference 四类记忆
- [ ] `MEMORY.md` 索引 + 记忆文件写入/更新/删除
- [ ] 记忆摘要注入 System Prompt
- [ ] Plan Mode 状态机 — Normal ⇄ Plan ⇄ Implement
- [ ] 计划文件读写（`.claude/plans/plan.md`）
- [ ] 前端 Plan 审批 UI
- [ ] `WorktreeManager` — 创建/清理 git worktree
- [ ] Agent 文件操作重定向到 worktree 路径
- [ ] 前端 Worktree Diff 审查 UI

**验证:** 
- 新会话中 Agent 记得用户偏好
- 复杂任务先出计划 → 审批 → 执行
- 文件修改在隔离 worktree 中，审查后合并

### Phase 6: 钩子系统 + Prompt Cache (P2)

**目标:** 可扩展性 + 成本优化

- [ ] `HookManager` — 加载配置、触发事件
- [ ] session/tool/agent 生命周期 Hook 执行
- [ ] 前端 Hook 配置 UI
- [ ] `PromptCacheManager` — Anthropic prompt caching
- [ ] 缓存命中率监控
- [ ] 上下文摘要压缩

**验证:** 
- 用户可配置 `pre-tool-call` Hook 拦截危险命令
- 连续对话中 System Prompt 命中缓存，延迟和成本降低

### Phase 7: 性能优化 + 稳定 (P2)

**目标:** 生产可用性

- [ ] 并行工具执行（无依赖时）
- [ ] 内存与 CPU 优化
- [ ] 错误恢复与重试
- [ ] 会话恢复（崩溃后断点续跑）
- [ ] 完整测试覆盖

**验证:** 稳定性测试 + 性能 benchmark 达标

---

## 7. 关键技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| Agent Loop 位置 | Rust 后端 | 前端不适合做长时异步循环；Rust 的 async 生态更成熟 |
| 前端通信方式 | Tauri Events | 天然支持流式推送，无需轮询 |
| 工具执行隔离 | 路径白名单 + git worktree | 路径沙箱 + 文件修改在独立 worktree 中，审查后合并 |
| Token 计数 | tiktoken-rs + 回退估算 | 精确度 vs 依赖复杂度平衡 |
| 消息格式 | Anthropic ContentBlock 格式 | 原生支持 text/image/tool_use/tool_result |
| 状态管理 | Rust 内存 + 前端 Zustand | 后端持权威状态，前端镜像展示 |

---

## 8. 进阶能力展望

以下能力在架构中预留了扩展空间，但不在当前实施路线图中，仅作规划设计参考。

### 8.1 MCP Integration（MCP 集成）

Model Context Protocol 是 Anthropic 的开放协议，允许第三方提供工具服务器：

```
Agent ←→ MCP Client ←→ MCP Server (第三方提供)
                            ├── 数据库工具 → PostgreSQL / SQLite ...
                            ├── 云服务管理 → AWS / GCP / K8s ...
                            └── 企业内部 API → Jira / Linear / Confluence ...
```

**预留点:** Tool System 的 `ToolRegistry` 设计为 trait-based，可新增 `McpToolAdapter` 实现动态工具发现和注册，无需修改核心架构。

### 8.2 IDE/Editor 双向同步

作为独立桌面应用，当前架构缺少与 IDE 的原生深度集成。进阶方向包括：

- **光标位置感知** — Agent 知道用户在哪一行编辑，操作精准定位
- **内联 Diff 预览** — 变更直接在编辑器中以 diff 形式展示
- **LSP 深度集成** — 利用 IDE 的类型推断和诊断增强 Agent 能力
- **文件保存协同** — Agent 修改与用户编辑的冲突检测和合并

**预留点:** Tauri 的 IPC 模型支持通过 LSP 协议或 VS Code 扩展 API 建立双向通信通道。

### 8.3 会话恢复（Session Recovery）

长时间 Agent 运行中崩溃或关闭后的恢复：

- 会话状态（消息历史、工具调用栈、Agent 模式）序列化到磁盘
- 重启后从断点继续 Agent Loop
- 多会话并行恢复（每个 session 独立快照）

**预留点:** `AgentSession` 已有序列化接口设计，Phase 7 性能优化阶段可初步实现。

---

## 9. 风险与注意事项

1. **DeepSeek 的 tool_use 能力** — 当前 DeepSeek 的 function calling 不如 Anthropic 成熟，需要做降级处理（可能只支持 text 响应）
2. **Anthropic API 版本** — 需使用 `2023-06-01` 版本的 Messages API (含 tool_use)
3. **Shell 命令安全性** — Windows 和 macOS/Linux 的 Shell 命令不同，需要用 `#[cfg]` 做平台适配
4. **上下文溢出的边界情况** — 超长工具输出可能导致 token 预算爆炸，需要严格截断
5. **Agent 循环死循环** — 必须设置 `max_turns` 上限，防止无限循环消耗 API 额度
