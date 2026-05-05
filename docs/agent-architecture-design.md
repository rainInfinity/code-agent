# Code Agent 架构设计方案

> 目标：将当前单轮对话式 AI 改造为类似 Codex 的 AI Agent 辅助编程系统

---

## 文档索引

各系统模块独立成文，以下为完整索引：

| 模块               | 文档                                                              | 职责                                                    |
| ------------------ | ----------------------------------------------------------------- | ------------------------------------------------------- |
| Agent Runtime      | [agent-runtime.md](agent-architecture/agent-runtime.md)           | 核心循环 Think→Act→Observe，管理 Session 生命周期       |
| Prompt System      | [prompt-system.md](agent-architecture/prompt-system.md)           | 动态组装 System Prompt + 工具定义 + 上下文              |
| Context Manager    | [context-manager.md](agent-architecture/context-manager.md)       | Token 预算管理 + 历史消息裁剪 + 摘要压缩                |
| Prompt Cache       | [prompt-cache.md](agent-architecture/prompt-cache.md)             | Anthropic Prompt Caching，缓存 System Prompt 和工具定义 |
| Tool System        | [tool-system.md](agent-architecture/tool-system.md)               | 工具注册/执行/沙箱/超时，read_file/bash/grep 等         |
| Agent System       | [agent-system.md](agent-architecture/agent-system.md)             | 多 Agent 注册/路由/委托，Explore/Plan/General/Review    |
| Task System        | [task-system.md](agent-architecture/task-system.md)               | 任务拆解为树形结构，状态流转与进度追踪                  |
| Permission System  | [permission-system.md](agent-architecture/permission-system.md)   | 分级权限 Safe/Moderate/Dangerous，用户确认弹窗          |
| Memory System      | [memory-system.md](agent-architecture/memory-system.md)           | 跨会话持久化记忆，用户偏好/项目背景/工作反馈            |
| Plan Mode          | [plan-mode.md](agent-architecture/plan-mode.md)                   | 实施前探索→设计→审批的工作流约束                        |
| Worktree Isolation | [worktree-isolation.md](agent-architecture/worktree-isolation.md) | Git worktree 隔离文件操作，不影响用户主工作区           |
| Hooks System       | [hooks-system.md](agent-architecture/hooks-system.md)             | 生命周期事件挂钩脚本，用户自定义 Agent 行为             |
| Slash Commands     | [slash-commands.md](agent-architecture/slash-commands.md)         | `/help`、`/clear`、`/compact` 等内置控制命令            |

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
│  │  tools   │  │   llm    │  ← Tool trait + Registry │
│  │(框架就绪)│  │  Client  │    已接入 Agent Loop    │
│  └──────────┘  └──────────┘                         │
└─────────────────────────────────────────────────────┘
```

### 1.2 现有能力 vs 目标能力

| 能力        | 当前状态                              | 目标状态                                                                                              |
| ----------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 多 Provider | ✅ Anthropic/OpenAI/DeepSeek          | 保持，扩展为 Agent 模式                                                                               |
| 流式响应    | ✅ SSE streaming（含 thinking delta） | 保持                                                                                                  |
| 工具系统    | ⚠️ 框架就绪，具体工具未注册           | ✅ 完整工具注册/执行/结果回传 → [Tool System](agent-architecture/tool-system.md)                      |
| 对话循环    | ✅ 多轮 Think→Act→Observe 循环        | 保持，扩展权限检查 → [Agent Runtime](agent-architecture/agent-runtime.md)                             |
| 上下文管理  | ❌ 无                                 | ✅ Token 感知的窗口管理 → [Context Manager](agent-architecture/context-manager.md)                    |
| Prompt 缓存 | ⚠️ CACHE_BOUNDARY 标记已插入          | ✅ Anthropic prompt cache（需 cache_control 头） → [Prompt Cache](agent-architecture/prompt-cache.md) |
| Prompt 系统 | ✅ 模板化分层组装（静态+动态段）      | 保持，扩展更多 Agent 类型 → [Prompt System](agent-architecture/prompt-system.md)                      |
| Trace 窗口  | ✅ 独立 Trace 窗口 + 停靠系统         | 保持                                                                                                  |
| 任务系统    | ❌ 无                                 | ✅ 任务拆解与追踪 → [Task System](agent-architecture/task-system.md)                                  |
| 权限系统    | ❌ 无                                 | ✅ 分级权限与用户确认 → [Permission System](agent-architecture/permission-system.md)                  |
| 多 Agent    | ❌ 无                                 | ✅ 专职 Agent 调度 → [Agent System](agent-architecture/agent-system.md)                               |
| 记忆系统    | ❌ 无                                 | ✅ 跨会话持久化记忆 → [Memory System](agent-architecture/memory-system.md)                            |
| 规划模式    | ❌ 无                                 | ✅ 实施前探索→设计→审批 → [Plan Mode](agent-architecture/plan-mode.md)                                |
| 工作区隔离  | ❌ 无                                 | ✅ Git worktree 隔离 → [Worktree Isolation](agent-architecture/worktree-isolation.md)                 |
| 钩子系统    | ❌ 无                                 | ✅ 生命周期事件挂钩 → [Hooks System](agent-architecture/hooks-system.md)                              |
| 内置命令    | ❌ 仅 Tauri Commands                  | ✅ `/help`、`/clear` 等控制命令 → [Slash Commands](agent-architecture/slash-commands.md)              |

### 1.3 关键缺口

**已解决 (Phase 1 完成):**

1. ~~`commands::send_message` 只做一次 LLM 调用~~ → 已实现 `run_agent` + `AgentRuntime` 多轮循环
2. ~~`tools.rs` 的 `ToolRegistry` 未使用~~ → Agent Loop 中已集成 ToolRegistry 查找和执行
3. ~~前端用 `useChat` hook 手动编排流程~~ → 已迁移到 `useAgent` hook，支持自主 Agent

**部分解决:**

4. Token 计数 / 上下文窗口管理 — 前端有 token 统计但无预算管理和自动裁剪
5. `stop_streaming` — 有 `CancellationToken` 支持的 `stop_agent`，但 `stop_streaming` 命令仍是空实现

**仍待解决 (Phase 2+ 规划):**

6. 无具体工具实现 — Tool trait + ToolRegistry + ToolExecutor 框架就绪，但 `with_defaults()` 返回空注册表，无 read_file/bash/grep 等工具
7. 无跨会话记忆 — 每次对话从零开始，Agent 不记得用户偏好
8. 无规划审批 — Agent 直接执行复杂任务，可能偏离用户意图
9. 文件操作无隔离 — Agent 修改直接影响用户工作区
10. 无可扩展性机制 — 用户无法自定义 Agent 行为
11. 无内置控制命令 — 用户只能通过 Tauri 命令与 Agent 交互

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
6. **工具安全 fail-closed** — 工具元数据默认最保守假设（`is_concurrency_safe=false`, `is_read_only=false`），需显式声明安全能力
7. **并发安全分区** — 只读工具自动合并并发，写入工具强制串行，防止竞态条件

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

| 事件                 | 触发时机     | 可阻塞 |
| -------------------- | ------------ | ------ |
| `pre-tool-call`      | 工具执行前   | 是     |
| `post-tool-call`     | 工具执行后   | 否     |
| `session-start`      | 会话初始化   | 否     |
| `user-prompt-submit` | 用户提交消息 | 是     |
| `agent-turn`         | 每轮循环结束 | 否     |
| `agent-complete`     | Agent 完成   | 否     |

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

| 命令                           | 说明                               | 状态        | 涉及模块          |
| ------------------------------ | ---------------------------------- | ----------- | ----------------- |
| `send_message`                 | 单轮 LLM 流式聊天（非 Agent 模式） | ✅ 已实现   | LLM Client        |
| `run_agent`                    | 启动 Agent 多轮循环                | ✅ 已实现   | Agent Runtime     |
| `stop_agent`                   | 取消指定 Agent Session             | ✅ 已实现   | Agent Runtime     |
| `stop_streaming`               | 停止流式请求                       | ⚠️ 占位实现 | —                 |
| `save_settings`                | 保存设置                           | ✅ 已实现   | —                 |
| `load_settings`                | 加载设置                           | ✅ 已实现   | —                 |
| `list_models`                  | 列出可用模型                       | ✅ 已实现   | —                 |
| `open_trace_window`            | 打开 Trace 窗口                    | ✅ 已实现   | Window Mgmt       |
| `hide_trace_window`            | 隐藏 Trace 窗口                    | ✅ 已实现   | Window Mgmt       |
| `close_trace_window`           | 关闭 Trace 窗口                    | ✅ 已实现   | Window Mgmt       |
| `is_trace_window_open`         | 查询 Trace 窗口是否打开            | ✅ 已实现   | Window Mgmt       |
| `set_trace_always_on_top`      | 设置 Trace 置顶                    | ✅ 已实现   | Window Mgmt       |
| `get_trace_docking_state`      | 获取停靠状态                       | ✅ 已实现   | Window Mgmt       |
| `set_trace_docking_mode`       | 设置停靠模式                       | ✅ 已实现   | Window Mgmt       |
| `exit_trace_docking`           | 退出停靠                           | ✅ 已实现   | Window Mgmt       |
| `sync_trace_docking_width`     | 同步停靠宽度                       | ✅ 已实现   | Window Mgmt       |
| `sync_trace_docking_to_main`   | 同步停靠位置                       | ✅ 已实现   | Window Mgmt       |
| `hide_trace_for_main_minimize` | 主窗口最小化时隐藏 Trace           | ✅ 已实现   | Window Mgmt       |
| `respond_permission`           | 响应用户权限请求                   | ❌ 未实现   | Permission System |
| `create_task`                  | 手动创建任务                       | ❌ 未实现   | Task System       |

**Events (Backend → Frontend):**

| 事件                             | 说明                 | 状态      | 涉及模块          |
| -------------------------------- | -------------------- | --------- | ----------------- |
| `stream-delta`                   | LLM 文本流           | ✅ 已实现 | Agent Runtime     |
| `thinking-delta`                 | LLM 思考过程流       | ✅ 已实现 | Agent Runtime     |
| `stream-end`                     | 流结束               | ✅ 已实现 | Agent Runtime     |
| `stream-error`                   | 流出错               | ✅ 已实现 | Agent Runtime     |
| `tool-call`                      | 工具正在被调用       | ✅ 已实现 | Tool System       |
| `tool-result`                    | 工具执行结果         | ✅ 已实现 | Tool System       |
| `agent-turn`                     | Agent 开始新一轮循环 | ✅ 已实现 | Agent Runtime     |
| `agent-complete`                 | Agent 运行完成       | ✅ 已实现 | Agent Runtime     |
| `trace-prompt`                   | 每轮 Prompt 完整内容 | ✅ 已实现 | Agent Runtime     |
| `trace-thinking-start`           | 思考阶段开始         | ✅ 已实现 | Agent Runtime     |
| `trace-thinking-end`             | 思考阶段结束         | ✅ 已实现 | Agent Runtime     |
| `permission-request`             | 请求用户权限         | ❌ 未实现 | Permission System |
| `task-created/updated/completed` | 任务状态变更         | ❌ 未实现 | Task System       |

---

## 5. 模块结构

### 5.1 Rust 后端模块

> **图例**: ✅ 已实现 | ⚠️ 框架就绪，待完善 | ❌ 未实现

```
src-tauri/src/
├── main.rs                    # 入口
├── lib.rs                     # Tauri 启动配置 + 窗口管理 + Trace 停靠引擎
├── commands.rs                # Tauri Commands (19 个命令)
├── models.rs                  # 共享数据类型（消息、事件、工具、设置等）
├── llm.rs                     # LlmClient（流式聊天 + tool-use 流）
│
├── agent/                     # ✅ [Agent Runtime]
│   ├── mod.rs                 # 模块导出
│   ├── runtime.rs             # AgentRuntime + agent_loop()
│   ├── session.rs             # AgentSession + AgentEventEmitter trait + TauriAgentEventEmitter
│   └── config.rs              # AgentConfig（max_turns, tool_timeout, tool_output_max_chars）
│
├── prompt/                    # ✅ [Prompt System]
│   ├── mod.rs                 # 模块导出
│   ├── engine.rs              # PromptEngine::build() + collect_session_context()
│   ├── templates.rs           # PromptSection, PromptTemplate, TemplateRegistry
│   └── builtins.rs            # 内置模板注册（code/chat），CACHE_BOUNDARY 常量
│
├── tools/                     # ⚠️ [Tool System] — 框架就绪，具体工具未实现
│   ├── mod.rs                 # Tool trait + ToolMeta + ToolRegistry（三层条件注册）
│   ├── executor.rs            # ToolExecutor（并发安全分区 + 超时 + 结构化截断）
│   ├── sandbox.rs             # SandboxConfig（路径白名单/命令黑名单/正则模式）
│   ├── file/                  # 文件操作工具
│   │   ├── mod.rs
│   │   ├── read_file.rs       # 读文件（支持行范围 + 图片/PDF）
│   │   ├── write_file.rs      # 创建/覆盖文件
│   │   ├── edit_file.rs       # 精确字符串替换
│   │   └── delete_file.rs     # 删除文件
│   ├── search/                # 代码搜索工具
│   │   ├── mod.rs
│   │   ├── grep.rs            # 正则搜索代码内容
│   │   ├── glob.rs            # 按模式匹配文件名
│   │   └── list_dir.rs        # 列出目录结构
│   ├── shell/                 # Shell 执行工具
│   │   ├── mod.rs
│   │   ├── bash.rs            # Bash 执行
│   │   └── powershell.rs      # PowerShell 执行
│   └── web/                   # 网络工具
│       ├── mod.rs
│       ├── web_search.rs      # 搜索引擎请求
│       └── web_fetch.rs       # URL 获取 + HTML → Markdown
│
├── providers/                 # ✅ [Provider System]
│   ├── mod.rs                 # LlmProvider trait + provider_from_id()
│   ├── anthropic.rs           # Anthropic Messages API（含 tool_use 流）
│   ├── deepseek.rs            # DeepSeek（Anthropic 兼容模式）
│   └── openai.rs              # OpenAI Chat Completions API（无 tool_use）
│
├── prompts/                   # ✅ [Prompt 模板文件]（编译时 include_str! 嵌入）
│   ├── base_system.md         # 基础系统提示（行为准则、代码规范、安全约束）
│   ├── agent_code.md          # Code Agent 角色提示
│   ├── agent_chat.md          # Chat Agent 角色提示
│   ├── rules_tool_priority.md # 工具使用优先级指令
│   └── runtime_context.md     # 运行时上下文模板（{{os}}, {{shell}}, {{cwd}} 等占位符）
│
│  以下模块为规划中，尚未实现:
│
├── context/                   # ❌ Context Manager — 未实现
├── cache/                     # ❌ Prompt Cache — 未实现
├── memory/                    # ❌ Memory System — 未实现
├── worktree/                  # ❌ Worktree Isolation — 未实现
├── hooks/                     # ❌ Hooks System — 未实现
├── commands/                  # ❌ Slash Commands — 未实现
├── permission/                # ❌ Permission System — 未实现
├── task/                      # ❌ Task System — 未实现
├── plan/                      # ❌ Plan Mode — 未实现
└── agent/manager.rs           # ❌ AgentManager（多 Agent）— 未实现
```

### 5.2 前端模块

> **图例**: ✅ 已实现 | ❌ 未实现

```
src/
├── main.tsx                    # 入口：检测主窗口/Trace 窗口，渲染对应 App
├── trace-main.tsx              # Trace 窗口独立入口
├── App.tsx                     # 主应用组件（主题、布局）
├── TraceApp.tsx                # Trace 应用组件

├── types/
│   └── index.ts                # 全部 TypeScript 类型定义

├── config/
│   └── providers.ts            # Provider 定义（Anthropic, DeepSeek）

├── stores/                     # Zustand 状态管理
│   ├── settingsStore.ts        # 设置状态（provider、主题、侧边栏、工作目录、agent 模式）— persist
│   ├── chatStore.ts            # 聊天状态（对话、消息、流状态、Trace pin）— persist
│   ├── agentStore.ts           # Agent 运行时状态（运行/空闲、回合数、待处理工具调用）
│   └── traceStore.ts           # Trace 窗口状态（停靠、置顶、对话绑定）

├── hooks/                      # React hooks + IPC 封装
│   ├── useIpc.ts               # 27 个 invoke() 封装 + 28 个 listen() 事件监听
│   ├── useChat.ts              # useAgent() 的重新导出
│   ├── useAgent.ts             # 核心 agent hook：发送/停止/事件监听/流缓冲
│   └── useTraceIpc.ts          # Trace 窗口 IPC 生命周期管理

├── components/
│   ├── Chat/
│   │   ├── ChatPanel.tsx       # 主聊天 UI 编排
│   │   ├── MessageInput.tsx    # 输入框 + 模式选择器 + 发送/停止按钮
│   │   ├── MessageList.tsx     # 虚拟化消息列表 + 自动滚动 + 复制
│   │   ├── MarkdownRenderer.tsx # 带代码高亮的 Markdown 渲染
│   │   └── WelcomeScreen.tsx   # 新聊天欢迎界面
│   │
│   ├── Layout/
│   │   ├── AppLayout.tsx       # 布局容器
│   │   ├── Sidebar.tsx         # 模式切换、工作目录选择、会话列表、设置
│   │   ├── StatusBar.tsx       # 连接状态、流状态、Trace 切换按钮
│   │   └── TitleBar.tsx        # 自定义无框标题栏 + 窗口控制
│   │
│   ├── common/
│   │   ├── Flex.tsx            # 布局原语
│   │   ├── SettingsModal.tsx   # 带选项卡导航的设置弹窗
│   │   └── ApiConfigBanner.tsx # API key 未配置提示横幅
│   │
│   └── Trace/                  # ✅ Trace 窗口子系统
│       ├── TracePanel.tsx      # Trace 主面板（停靠/窗口控制、回合列表、滚动）
│       ├── TraceStatusBar.tsx  # Trace 状态指示器
│       ├── TraceCopyButton.tsx # 带反馈的复制按钮
│       ├── TraceErrorBoundary.tsx # 错误边界
│       ├── TurnCard.tsx        # 可展开的回合卡片（状态、用时、token 用量）
│       ├── PromptView.tsx      # Prompt 检查器
│       ├── ThinkingView.tsx    # 思考过程检查器
│       ├── ResponseView.tsx    # 响应检查器
│       └── useCopyFeedback.ts  # 复制反馈 hook
│
│  以下模块为规划中，尚未实现:

├── agent/                      # ❌ Agent 选择与配置
├── plan/                       # ❌ 计划审批 UI
├── permission/                 # ❌ 权限确认 UI
├── task/                       # ❌ 任务追踪 UI
├── worktree/                   # ❌ 工作区变更 UI
├── commands/                   # ❌ 命令自动补全
└── stores/
    ├── taskStore.ts            # ❌ 任务状态
    └── planStore.ts            # ❌ Plan Mode 状态

├── styles/
│   ├── theme.ts                # 设计系统 token（深色/浅色主题）
│   ├── GlobalStyle.ts          # CSS 重置 + 全局样式
│   └── styled.d.ts             # styled-components 主题类型增强

├── i18n/
│   ├── index.ts                # 导出中文翻译
│   └── zh-CN.ts                # 中文（简体）翻译字符串
```

---

## 6. 实施路线图

分 7 个阶段实施，每个阶段可独立验证。已完成项以 ~~删除线~~ 标记。

### Phase 1: Agent 核心循环 (P0) — ✅ 已完成

**目标:** 把单轮对话变成多轮 Tool-Use 循环

- [x] 实现 `AgentRuntime` + `AgentLoop`
- [x] 扩展 `LlmClient` 支持 Anthropic tool_use 流式响应
- [x] 扩展 `ChatMessage` 支持 `ContentBlock` (text + tool_use + tool_result)
- [x] `AgentSession` 自包含胖上下文（含 CancellationToken）
- [x] 前端从 `useChat` 迁移到 `useAgent`
- [x] 实现 `AgentEventEmitter` trait + `TauriAgentEventEmitter`
- [x] Trace 窗口系统（独立窗口 + 停靠引擎 + 回合检查器）
- [x] Code/Chat 双模式 Agent 类型
- [x] Thinking delta 流式支持

**验证:** 用户发送消息 → Agent 自动进入 Think→Act→Observe 循环（当前因无注册工具，无 tool_use 时会直接返回文本响应）

### Phase 2: 工具系统完善 (P0) — ⚠️ 框架完成，具体工具待实现

**目标:** 实现核心开发工具 + 安全默认 + 并发分区

- [x] `Tool` trait — `name()`、`description()`、`parameters_schema()`、`execute()`
- [x] `ToolRegistry` — 注册/查找/生成 LLM 工具定义
- [x] `ToolExecutor` — 带超时（tokio::time::timeout）和输出字符截断
- [ ] **`ToolMeta` + `Default` 安全默认** — fail-closed 原则：`is_concurrency_safe` 和 `is_read_only` 默认 `false`
- [ ] **`partition_tool_calls()` 并发安全分区** — 只读工具合并并行，写入工具串行
- [ ] **三层条件注册** — `cfg(feature)` 编译期 DCE → env var 加载期 → `is_enabled()` 运行时
- [ ] **工具级权限检查** — `validate_input()` + `check_permissions()` 委托给具体工具实现
- [ ] **结构化输出截断** — 头尾保留 + 中间截断信息（替代简单字符丢弃）
- [ ] `read_file` / `write_file` / `edit_file` — 文件操作（含 `search_hint`、`aliases`）
- [ ] `grep` / `glob` / `list_directory` — 代码搜索
- [ ] `bash` / `powershell` — Shell 执行（含命令语义分析 + AST 安全检查）
- [ ] `Sandbox` — 路径白名单/命令黑名单

**验证:** Agent 可以读文件、搜索代码、执行简单命令；只读工具并发执行、写入工具串行执行

### Phase 3: 权限 + 上下文 + 内置命令 (P1) — ❌ 未开始

**目标:** 安全可控的 Agent 行为 + 用户控制面

- [ ] `PermissionManager` + 前端权限弹窗
- [ ] `ContextManager` + Token 计数
- [ ] 上下文裁剪策略
- [ ] `PromptEngine` — 可配置的 System Prompt
- [ ] `CommandRegistry` + `/help`、`/clear`、`/compact`、`/diff` 等内置命令
- [ ] 前端命令自动补全

**验证:** 危险操作需要用户确认；`/clear` 清除会话；长对话自动裁剪历史

### Phase 4: 多 Agent + 任务系统 (P1) — ❌ 未开始

**目标:** 专职 Agent 和任务追踪

- [ ] `AgentManager` + Agent 注册/路由
- [ ] `TaskManager` + 任务树
- [ ] 前端 TaskPanel 展示任务进度
- [ ] Agent 间委托机制

**验证:** 复杂请求自动拆解为子任务并追踪进度

### Phase 5: 记忆 + 规划 + 隔离 (P1) — ❌ 未开始

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

### Phase 6: 钩子系统 + Prompt Cache (P2) — ❌ 未开始

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

### Phase 7: 性能优化 + 稳定 (P2) — ❌ 未开始

**目标:** 生产可用性

- [ ] 并行工具执行（无依赖时）
- [ ] 内存与 CPU 优化
- [ ] 错误恢复与重试
- [ ] 会话恢复（崩溃后断点续跑）
- [ ] 完整测试覆盖

**验证:** 稳定性测试 + 性能 benchmark 达标

---

## 7. 关键技术决策

| 决策            | 选择                        | 理由                                               |
| --------------- | --------------------------- | -------------------------------------------------- |
| Agent Loop 位置 | Rust 后端                   | 前端不适合做长时异步循环；Rust 的 async 生态更成熟 |
| 前端通信方式    | Tauri Events                | 天然支持流式推送，无需轮询                         |
| 工具执行隔离    | 路径白名单 + git worktree   | 路径沙箱 + 文件修改在独立 worktree 中，审查后合并  |
| 工具安全默认    | fail-closed (`Default`)     | 工具作者忘声明安全能力时，系统采用最保守假设       |
| 工具并发执行    | `partition_tool_calls()`    | 连续只读工具合并并发 batch，写入工具独立串行 batch |
| 工具条件注册    | 编译期 → env var → runtime  | 三层过滤漏斗：编译期 DCE → 加载期版本 → 运行时动态 |
| Token 计数      | tiktoken-rs + 回退估算      | 精确度 vs 依赖复杂度平衡                           |
| 消息格式        | Anthropic ContentBlock 格式 | 原生支持 text/image/tool_use/tool_result           |
| 状态管理        | Rust 内存 + 前端 Zustand    | 后端持权威状态，前端镜像展示                       |

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
