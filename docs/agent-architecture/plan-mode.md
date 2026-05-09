# Plan Mode — 规划模式

> 返回 [总览](../agent-architecture-design.md) | 上一模块：[Memory System](./memory-system.md) | 下一模块：[Worktree Isolation](./worktree-isolation.md)

---

## 概述

Plan Mode 是一种**工作流约束**，在非平凡实现任务前强制 Agent 先探索、设计、获取用户批准，再执行。它防止 Agent 在需求不明确时浪费精力写代码，确保用户与 Agent 在方案上对齐。

> Plan Mode 不是 Plan Agent。Plan Agent 是专职做架构设计的 Agent 类型；Plan Mode 是 Agent Runtime 的工作模式切换。

## 设计理念

```
用户请求: "实现用户认证系统"
                │
                ▼
    ┌──────────────────────┐
    │  意图分析: 是否非平凡？ │
    └──────┬───────────────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
 简单任务      非平凡任务
 (修typo,     (新功能, 重构,
  加注释)      多文件变更)
    │             │
    ▼             ▼
 直接执行    Enter Plan Mode
                │
        ┌───────┴────────┐
        │  探索 → 设计    │
        │  → 写计划文件   │
        │  → 请求审批    │
        └───────┬────────┘
                │
        ┌───────┴────────┐
        │ 用户审查计划    │
        └───────┬────────┘
                │
        ┌───────┴────────┐
        │ 批准 / 修改     │
        │  / 拒绝         │
        └───────┬────────┘
                │
          批准  ▼
         执行计划
```

## 触发条件

Agent Runtime 在收到用户请求后，判断是否需要进入 Plan Mode：

```rust
impl AgentRuntime {
    fn should_enter_plan_mode(&self, user_message: &str) -> bool {
        // 条件 1: 用户显式要求规划
        if self.contains_keywords(user_message, &["plan", "design", "规划", "设计"]) {
            return true;
        }

        // 条件 2: 涉及多文件变更的关键词
        if self.contains_keywords(user_message, &[
            "实现", "创建", "重构", "添加", "修改",
            "implement", "create", "refactor", "add",
        ]) {
            return true;
        }

        // 条件 3: 消息长度暗示复杂度
        if user_message.len() > 200 {
            return true;
        }

        false
    }
}
```

**明确不触发的情况：**
- 单行/少行修复（修 typo、改变量名）
- 纯信息查询（"这段代码做什么"）
- 用户已给出精确指令

## Plan Mode 状态机

```
         ┌──────────┐
         │  Normal  │ ← 普通对话模式
         └────┬─────┘
              │ should_enter_plan_mode() = true
              ▼
         ┌──────────┐
         │ Planning │ ← Agent 探索、写计划
         └────┬─────┘
              │ 计划写毕，调用 ExitPlanMode
              ▼
         ┌──────────┐
         │ Awaiting │ ← 等待用户审批
         │ Approval │
         └────┬─────┘
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
  批准      修改意见    拒绝
    │         │         │
    ▼         ▼         ▼
┌────────┐ ┌────────┐ ┌──────────┐
│Implement│ │Planning│ │ Normal   │
│ (执行)  │ │(修改)  │ │ (放弃)   │
└────────┘ └────────┘ └──────────┘
```

## 核心数据结构

```rust
/// Agent 运行模式
enum AgentMode {
    /// 普通对话模式 — 直接回答问题
    Normal,
    /// 规划模式 — 探索 + 设计方案
    Plan,
    /// 执行模式 — 按计划实施
    Implement { plan_id: String },
}

/// 计划文件
struct Plan {
    /// 计划 ID
    id: String,
    /// 计划标题
    title: String,
    /// 问题分析
    analysis: String,
    /// 方案设计
    design: String,
    /// 实施步骤
    steps: Vec<PlanStep>,
    /// 涉及的关键文件
    affected_files: Vec<String>,
    /// 风险与取舍
    risks: Vec<String>,
    /// 计划状态
    status: PlanStatus,
}

struct PlanStep {
    order: usize,
    description: String,
    files_to_modify: Vec<String>,
    verification: String,
}

enum PlanStatus {
    Draft,
    AwaitingApproval,
    Approved,
    Rejected { reason: String },
    InProgress,
    Completed,
}
```

## Agent Loop 中的 Plan Mode

```rust
async fn agent_loop(session: &mut AgentSession, cancel: CancellationToken) {
    // 首次进入：判断是否需要 Plan Mode
    if should_enter_plan_mode(&session.user_message) {
        session.mode = AgentMode::Plan;

        // 使用 Plan Agent 进行探索和设计
        let plan = self.plan_agent.create_plan(&session.user_message).await?;

        // 写计划文件
        let plan_path = session.workspace.join(".claude/plans/plan.md");
        std::fs::write(&plan_path, plan.to_markdown())?;

        // 请求用户审批（挂起循环）
        let approval = self.request_plan_approval(&plan).await?;

        match approval {
            Approval::Accepted => {
                session.mode = AgentMode::Implement { plan_id: plan.id };
                // 继续进入执行循环
            }
            Approval::Modify(feedback) => {
                // 修改计划，重新请求审批
                continue;
            }
            Approval::Rejected => {
                emit_complete("Plan rejected by user");
                return;
            }
        }
    }

    // 普通 Agent 循环（Think→Act→Observe）
    loop { /* ... */ }
}
```

## 计划文件格式

计划写入 `.claude/plans/` 目录：

```
.claude/plans/
├── plan.md              ← 当前活跃计划
└── history/             ← 历史计划归档
    ├── 2026-05-01-auth-system.md
    └── 2026-04-28-refactor-db.md
```

```markdown
# Plan: 实现用户认证系统

## 问题分析
当前系统缺少用户认证...

## 方案设计
采用 JWT + HttpOnly Cookie 方案...

## 实施步骤
1. 创建 User 模型和数据库迁移
2. 实现注册/登录 API
3. 添加认证中间件
4. 前端登录表单

## 风险
- JWT 刷新机制需考虑安全
- 数据库迁移需向后兼容
```

## 前端 Plan 审批 UI

```
┌────────────────────────────────────────────────────┐
│  📋 实施计划审批                                    │
│                                                    │
│  # 实现用户认证系统                                 │
│                                                    │
│  ## 问题分析                                        │
│  当前系统缺少用户认证，所有 API 都是公开的...        │
│                                                    │
│  ## 方案设计                                        │
│  采用 JWT + HttpOnly Cookie 方案...                 │
│                                                    │
│  ## 实施步骤                                        │
│  1. 创建 User 模型和数据库迁移                       │
│  2. 实现注册/登录 API                               │
│  3. 添加认证中间件                                   │
│  4. 前端登录表单                                     │
│                                                    │
│  ## 涉及文件                                        │
│  src-tauri/src/models/chat.rs                      │
│  src-tauri/src/commands/chat.rs                    │
│  src/components/LoginForm.tsx                       │
│                                                    │
│  ─────────────────────────────────────────────     │
│  [提供修改意见...]                                  │
│                                    [拒绝] [批准]    │
└────────────────────────────────────────────────────┘
```

## Tauri 命令扩展

```rust
// 新增命令
#[tauri::command]
async fn approve_plan(plan_id: String, feedback: Option<String>) -> Result<(), String> {
    // 批准或拒绝计划，Agent Loop 继续
}

#[tauri::command]
async fn reject_plan(plan_id: String, reason: String) -> Result<(), String> {
    // 拒绝计划
}
```

## 与 Agent System 的协作

Plan Mode 在规划阶段自动切换到 Plan Agent：

```
AgentRuntime
    │
    ├── mode == Plan → 使用 Plan Agent
    │     └── 可用工具: read_file, grep, glob, web_search
    │     └── 权限: AutoApprove (只读)
    │
    ├── mode == Implement → 使用 GeneralPurpose Agent
    │     └── 可用工具: 全部
    │     └── 权限: AskAll
    │
    └── mode == Normal → 使用路由选择的 Agent
```

---

> 上一模块：[Memory System](./memory-system.md) | 下一模块：[Worktree Isolation](./worktree-isolation.md)
> 返回 [总览](../agent-architecture-design.md)
