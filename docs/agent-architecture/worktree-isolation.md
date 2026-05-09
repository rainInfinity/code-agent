# Worktree Isolation — 工作树隔离

> 返回 [总览](../agent-architecture-design.md) | 上一模块：[Plan Mode](./plan-mode.md) | 下一模块：[Hooks System](./hooks-system.md)

---

## 概述

Worktree Isolation 利用 `git worktree` 为 Agent 创建独立的文件操作环境。Agent 的所有文件修改在隔离的工作副本中进行，不影响用户的当前工作区。这比简单的路径白名单沙箱提供了更强的安全保证。

## 设计理念

- **完全隔离** — Agent 的文件修改不影响用户的主工作区
- **可回滚** — 出问题时直接删除 worktree，零副作用
- **可审查** — 用户在合并前通过 `git diff` 审查所有变更
- **可并行** — 多个 Agent 实例可在各自的 worktree 中并行工作

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                    用户主工作区                            │
│              /home/user/projects/code-agent               │
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │              .claude/worktrees/                  │     │
│  │                                                  │     │
│  │  ┌──────────────────┐  ┌──────────────────┐    │     │
│  │  │ worktree_001/    │  │ worktree_002/    │    │     │
│  │  │ (Agent A 占用)   │  │ (Agent B 占用)   │    │     │
│  │  │                  │  │                  │    │     │
│  │  │ branch: wt-001   │  │ branch: wt-002   │    │     │
│  │  └──────────────────┘  └──────────────────┘    │     │
│  └────────────────────────────────────────────────┘     │
│                                                          │
│  Agent 写文件 → worktree → 用户审查 → merge/rebase       │
│                                          → 或直接丢弃    │
└─────────────────────────────────────────────────────────┘
```

## 生命周期

```
创建                    使用                     清理
─────                ─────────                ──────────
EnterWorktree  ──→  Agent 在隔离     ──→   ExitWorktree
                   环境中工作                   │
                                         ┌─────┴─────┐
                                         ▼           ▼
                                      Keep        Remove
                                   (保留分支    (删除 worktree
                                    和变更)     和分支)
```

## 核心数据结构

```rust
/// Worktree 管理器
struct WorktreeManager {
    /// 主仓库路径
    repo_path: PathBuf,
    /// worktree 存储根目录
    worktrees_dir: PathBuf,
    /// 当前活跃的 worktree 列表
    active_worktrees: HashMap<String, WorktreeHandle>,
}

struct WorktreeHandle {
    /// worktree 路径
    path: PathBuf,
    /// 对应的分支名
    branch: String,
    /// 创建时间
    created_at: Instant,
    /// 关联的 Session ID
    session_id: String,
    /// 基分支（worktree 从哪分出来的）
    base_branch: String,
}

enum WorktreeAction {
    /// 保留 worktree 和分支（用户后续手动合并）
    Keep,
    /// 删除 worktree 和分支（丢弃所有变更）
    Remove { discard_changes: bool },
}
```

## WorktreeManager 实现

```rust
impl WorktreeManager {
    /// 创建新的 worktree
    async fn create(&mut self, session_id: &str, base_branch: &str) -> Result<WorktreeHandle, String> {
        let branch = format!("wt-{}-{}", session_id, random_suffix(8));
        let dir_name = format!("worktree_{}", session_id);
        let path = self.worktrees_dir.join(&dir_name);

        // git worktree add <path> -b <branch>
        Command::new("git")
            .args(["worktree", "add", "-b", &branch])
            .arg(&path)
            .arg(base_branch)
            .output()
            .await
            .map_err(|e| format!("Failed to create worktree: {}", e))?;

        let handle = WorktreeHandle {
            path,
            branch,
            created_at: Instant::now(),
            session_id: session_id.to_string(),
            base_branch: base_branch.to_string(),
        };

        self.active_worktrees.insert(session_id.to_string(), handle.clone());
        Ok(handle)
    }

    /// 移除 worktree
    async fn remove(&mut self, session_id: &str, action: WorktreeAction) -> Result<(), String> {
        let handle = self.active_worktrees.remove(session_id)
            .ok_or("No active worktree for this session")?;

        match action {
            WorktreeAction::Remove { discard_changes } => {
                let mut args = vec!["worktree", "remove"];
                if discard_changes {
                    args.push("--force");
                }
                args.push(handle.path.to_str().unwrap());

                Command::new("git")
                    .args(&args)
                    .output()
                    .await
                    .map_err(|e| format!("Failed to remove worktree: {}", e))?;

                // 删除分支
                Command::new("git")
                    .args(["branch", "-D", &handle.branch])
                    .output()
                    .await
                    .ok();
            }
            WorktreeAction::Keep => {
                // 不删除，分支和 worktree 保留
                // 用户的后续操作：git merge wt-xxx 或 git branch -D wt-xxx
            }
        }

        Ok(())
    }

    /// 查看 worktree 中的变更
    async fn diff(&self, session_id: &str) -> Result<String, String> {
        let handle = self.active_worktrees.get(session_id)
            .ok_or("No active worktree for this session")?;

        let output = Command::new("git")
            .args(["-C", handle.path.to_str().unwrap(), "diff", &handle.base_branch])
            .output()
            .await
            .map_err(|e| format!("Failed to get diff: {}", e))?;

        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }

    /// 列出所有活跃 worktree
    fn list(&self) -> Vec<&WorktreeHandle> {
        self.active_worktrees.values().collect()
    }
}
```

## 与 Agent Runtime 的集成

```rust
// Agent Runtime 中
async fn run_agent(session: &mut AgentSession) {
    let mut worktree = None;

    // 如果任务涉及文件修改，创建 worktree
    if session.config.use_worktree && session.mode == AgentMode::Implement {
        let handle = worktree_manager
            .create(&session.id, "main")
            .await?;
        session.workspace_root = handle.path.clone();
        worktree = Some(handle);
    }

    // 执行 Agent Loop...

    // 结束时处理 worktree
    if let Some(handle) = worktree {
        if session.has_changes() {
            // 有变更 → 通知用户，等待决定
            emit_event(WorktreePending {
                session_id: session.id,
                branch: handle.branch,
                diff: worktree_manager.diff(&session.id).await?,
            });
        } else {
            // 无变更 → 自动清理
            worktree_manager.remove(&session.id, WorktreeAction::Remove {
                discard_changes: true
            }).await?;
        }
    }
}
```

## 前端 Worktree UI

```
┌────────────────────────────────────────────────┐
│  🔀 Agent 工作区变更                             │
│                                                │
│  Agent 在隔离工作区完成以下变更:                   │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │  src-tauri/src/commands/chat.rs  +45  -12    │  │
│  │  src-tauri/src/models/chat.rs    +120 -8     │  │
│  │  src/components/Auth.tsx         +200 (new)  │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  分支: wt-sess_abc123                           │
│                                                │
│  [查看 Diff]  [应用到主工作区]  [丢弃变更]       │
└────────────────────────────────────────────────┘
```

## 安全边界

| 场景 | 行为 |
|------|------|
| Agent 尝试写入 worktree 外路径 | Sandbox 拒绝（路径不匹配） |
| Agent 在 worktree 内恶意操作 | 不影响主工作区，可删除 |
| 多个 Agent 同时运行 | 各自独立 worktree，不冲突 |
| 用户手动编辑 worktree 文件 | 可能导致合并冲突，需要处理 |

## 局限性

1. **仅适用于 Git 仓库** — 非 Git 项目需要其他隔离机制（如文件系统快照）
2. **大仓库开销** — Worktree 共享 `.git`，但 checkout 大文件仍有 I/O 成本
3. **Windows 兼容** — `git worktree` 在 Windows 上可用但路径处理需注意

---

> 上一模块：[Plan Mode](./plan-mode.md) | 下一模块：[Hooks System](./hooks-system.md)
> 返回 [总览](../agent-architecture-design.md)
