# Task System — 任务系统

> 返回 [总览](./agent-architecture-design.md) | 上一模块：[Agent System](./agent-system.md) | 下一模块：[Permission System](./permission-system.md)

---

## 概述

Task System 负责将用户的大任务拆解为可追踪的子任务，管理任务的层级结构、状态流转和进度追踪。它让用户直观地了解 Agent 正在做什么、做完了什么、还有什么待完成。

## 设计理念

- **任务即树** — 一个复杂任务自然拆解为多层子树
- **状态即进度** — 通过任务完成比例反映整体进度
- **事件即更新** — Agent 通过事件流更新任务状态，前端实时渲染
- **可选启用** — 简单任务不强制创建任务树，复杂任务自动触发

## 架构

```
┌───────────────────────────────────────────────────────────┐
│                     Task Manager                           │
│                                                            │
│  任务生命周期:                                              │
│                                                            │
│  ┌──────┐    ┌──────────┐    ┌──────────┐    ┌─────────┐ │
│  │PENDING│───→│IN_PROGRESS│───→│COMPLETED │    │ FAILED  │ │
│  └──────┘    └──────────┘    └──────────┘    └─────────┘ │
│                      │                            ↑        │
│                      └────────────────────────────┘        │
│                            (可中途标记失败)                 │
│                                                            │
│  任务层级:                                                  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 📁 实现用户登录功能                      [2/3]        │  │
│  │  ├── ✅ 数据库用户模型                   [完成]       │  │
│  │  ├── 🔄 API 登录端点                     [进行中]     │  │
│  │  │    ├── ⏳ 密码验证逻辑                 [待开始]     │  │
│  │  │    └── ⏳ 单元测试                     [待开始]     │  │
│  │  └── ⏳ 前端登录表单                      [待开始]     │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

## 核心数据结构

### TaskNode

```rust
/// 任务节点 — 任务树的基本单元
struct TaskNode {
    /// 唯一标识
    id: String,
    /// 任务标题（简短）
    title: String,
    /// 任务描述（详细）
    description: String,
    /// 当前状态
    status: TaskStatus,
    /// 父任务 ID
    parent_id: Option<String>,
    /// 子任务 ID 列表
    children: Vec<String>,
    /// 任务元数据
    metadata: TaskMetadata,
    /// 排序权重（同级排序用）
    order: usize,
}

struct TaskMetadata {
    /// 创建时间
    created_at: Instant,
    /// 完成时间
    completed_at: Option<Instant>,
    /// 指派的 Agent 类型
    assigned_agent: Option<AgentType>,
    /// 关联的工具调用记录
    tool_calls: Vec<ToolCallRecord>,
    /// Token 消耗
    token_usage: TokenUsage,
    /// Agent 备注
    notes: Vec<String>,
    /// 任务优先级
    priority: TaskPriority,
}

enum TaskStatus {
    /// 待开始
    Pending,
    /// 进行中
    InProgress,
    /// 已完成
    Completed,
    /// 失败（含原因）
    Failed { reason: String },
    /// 已取消
    Cancelled,
}

enum TaskPriority {
    Low,
    Normal,
    High,
    Critical,
}

struct ToolCallRecord {
    tool_name: String,
    timestamp: Instant,
    success: bool,
    summary: String,  // "Wrote file src/auth.ts"
}
```

### TaskTree

```rust
/// 任务树 — 一次 Agent 运行的任务集合
struct TaskTree {
    /// 根任务
    root_id: String,
    /// 所有任务节点 (id → node)
    nodes: HashMap<String, TaskNode>,
    /// 统计信息
    stats: TaskStats,
}

struct TaskStats {
    total: usize,
    completed: usize,
    failed: usize,
    in_progress: usize,
    pending: usize,
}

impl TaskTree {
    /// 计算完成百分比
    fn progress_pct(&self) -> f64 {
        if self.stats.total == 0 { 0.0 }
        else {
            (self.stats.completed + self.stats.failed) as f64
                / self.stats.total as f64
                * 100.0
        }
    }
}
```

## TaskManager

```rust
/// 任务管理器 — 管理所有任务树
struct TaskManager {
    /// 活跃的任务树（按 session ID）
    active_trees: HashMap<String, TaskTree>,
    /// 历史任务树（保留最近 N 个）
    history: VecDeque<TaskTree>,
}

impl TaskManager {
    /// 创建新的任务树
    fn create_tree(&mut self, session_id: &str, root_title: &str) -> &TaskTree {
        let tree = TaskTree::new(root_title);
        self.active_trees.insert(session_id.to_string(), tree);
        self.active_trees.get(session_id).unwrap()
    }

    /// 添加子任务
    fn add_subtask(
        &mut self,
        session_id: &str,
        parent_id: &str,
        title: &str,
        description: &str,
    ) -> Result<String, String> {
        let tree = self.active_trees.get_mut(session_id)
            .ok_or("No active task tree")?;
        Ok(tree.add_child(parent_id, title, description))
    }

    /// 更新任务状态
    fn update_status(
        &mut self,
        session_id: &str,
        task_id: &str,
        status: TaskStatus,
    ) -> Result<(), String> {
        let tree = self.active_trees.get_mut(session_id)
            .ok_or("No active task tree")?;
        tree.set_status(task_id, status);
        Ok(())
    }

    /// 添加工具调用记录到当前任务
    fn record_tool_call(
        &mut self,
        session_id: &str,
        task_id: &str,
        record: ToolCallRecord,
    ) {
        if let Some(tree) = self.active_trees.get_mut(session_id) {
            tree.record_tool_call(task_id, record);
        }
    }
}
```

## 任务事件流

Agent Runtime 通过 Tauri Events 将任务状态推送到前端：

```rust
/// 任务相关事件
enum TaskEvent {
    /// 任务树创建
    TreeCreated { session_id: String, tree: TaskTree },
    /// 子任务添加
    SubTaskAdded { session_id: String, parent_id: String, node: TaskNode },
    /// 任务开始
    TaskStarted { session_id: String, task_id: String },
    /// 任务进度更新
    TaskProgress { session_id: String, task_id: String, message: String, progress_pct: f64 },
    /// 任务完成
    TaskCompleted { session_id: String, task_id: String },
    /// 任务失败
    TaskFailed { session_id: String, task_id: String, reason: String },
    /// 任务树完成
    TreeCompleted { session_id: String, stats: TaskStats },
}
```

前端监听事件并更新 TaskPanel UI：

```
事件流示例:
  tree-created  → UI 显示 "实现用户登录" 任务面板
  task-started  → "数据库用户模型" 标记为进行中
  tool-call     → 面板显示 "正在执行 write_file src/models/user.ts"
  task-completed → "数据库用户模型" 标记为完成 ✅
  task-started  → "API 登录端点" 标记为进行中
  ...
  tree-completed → 所有任务完成，面板收起
```

## 前端 TaskPanel UI

```
┌──────────────────────────────────────┐
│  📋 任务进度              [收起 ▲]   │
│                                      │
│  ████████████░░░░░░  67% (2/3)      │
│                                      │
│  ✅ 数据库用户模型                    │
│     └─ write_file src/models/user.ts │
│                                      │
│  🔄 API 登录端点                      │
│     ├─ ✅ 密码验证逻辑                 │
│     └─ ⏳ 单元测试                     │
│                                      │
│  ⏳ 前端登录表单                       │
└──────────────────────────────────────┘
```

### 前端状态管理

```typescript
// src/stores/taskStore.ts
interface TaskState {
  trees: Record<string, TaskTree>;
  activeTreeId: string | null;

  // Actions
  handleTaskEvent: (event: TaskEvent) => void;
  getActiveTree: () => TaskTree | undefined;
  getProgress: () => number;
}

export const useTaskStore = create<TaskState>()((set, get) => ({
  trees: {},
  activeTreeId: null,

  handleTaskEvent: (event) => {
    switch (event.type) {
      case 'tree-created':
        set((s) => ({
          trees: { ...s.trees, [event.sessionId]: event.tree },
          activeTreeId: event.sessionId,
        }));
        break;
      case 'task-started':
        // 更新对应节点的状态
        break;
      case 'task-completed':
        // 标记完成 + 自动开始下一个待处理任务
        break;
      // ...
    }
  },

  getProgress: () => {
    const tree = get().activeTreeId ? get().trees[get().activeTreeId!] : undefined;
    return tree?.progressPct ?? 0;
  },
}));
```

## 任务生成的触发时机

| 触发条件 | 行为 |
|---------|------|
| 用户消息包含 "实现"、"创建"、"重构" 等复杂意图词 | Agent 自动调用 Plan Agent 拆解任务 |
| Agent 判断任务需要 ≥3 个步骤 | 自动创建任务树 |
| 用户显式 `/task create` | 手动创建任务 |
| 简单单步任务（如 "解释这段代码"） | 不创建任务树，节省开销 |

## 任务持久化

```rust
/// 任务树序列化（支持历史查看）
#[derive(Serialize, Deserialize)]
struct TaskTreeSnapshot {
    session_id: String,
    root_task: TaskNode,
    created_at: u64,
    completed_at: Option<u64>,
    stats: TaskStats,
}

impl TaskManager {
    /// 归档已完成的任务树
    fn archive(&mut self, session_id: &str) {
        if let Some(tree) = self.active_trees.remove(session_id) {
            self.history.push_back(tree);
            if self.history.len() > 50 {
                self.history.pop_front(); // 最多保留 50 个
            }
        }
    }
}
```

---

> 上一模块：[Agent System](./agent-system.md) | 下一模块：[Permission System](./permission-system.md)
> 返回 [总览](./agent-architecture-design.md)
