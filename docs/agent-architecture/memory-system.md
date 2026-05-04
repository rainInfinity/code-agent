# Memory System — 记忆系统

> 返回 [总览](../agent-architecture-design.md) | 下一模块：[Plan Mode](./plan-mode.md)

---

## 概述

Memory System 提供跨会话持久化的知识库，让 Agent 在多次对话中"记住"用户偏好、项目背景和工作反馈。它不同于 Context Manager（token 窗口内的短期记忆），而是长期、跨会话的知识管理。

## 设计理念

- **语义分类** — 不同类型的信息分文件存储，而非一个大 JSON
- **索引与内容分离** — `MEMORY.md` 是轻量索引（<200 行），每条记忆是独立 `.md` 文件
- **按需加载** — 会话开始时加载 `MEMORY.md` 索引，按相关性按需读取具体记忆
- **衰减感知** — 记忆带有时间戳，Agent 可以判断信息是否可能过时

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                   Memory System                          │
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │            Memory Store (~/.code-agent/memory/)  │     │
│  │                                                  │     │
│  │  MEMORY.md           ← 索引文件（始终加载）      │     │
│  │  ├── user_role.md    ← 用户角色/偏好/背景        │     │
│  │  ├── feedback_x.md   ← 工作方式纠正/确认         │     │
│  │  ├── project_x.md    ← 项目上下文/进行中的工作   │     │
│  │  └── reference_x.md  ← 外部系统指针              │     │
│  └────────────────────────────────────────────────┘     │
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │            Memory Manager                        │     │
│  │                                                  │     │
│  │  save()   query()   update()   forget()         │     │
│  └────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

## 记忆类型

```rust
/// 记忆类型
enum MemoryType {
    /// 用户信息：角色、偏好、技术背景、知识水平
    User,
    /// 反馈信息：用户对工作方式的纠正/确认
    Feedback,
    /// 项目信息：进行中的工作、目标、截止日期、决策理由
    Project,
    /// 引用信息：外部系统资源指针
    Reference,
}
```

| 类型 | 用途 | 示例 |
|------|------|------|
| `user` | 用户角色、技术偏好、背景知识 | "用户是资深 Go 开发者，React 新手" |
| `feedback` | 用户对工作方式的纠正和确认 | "不要 mock 数据库做集成测试，上次出过事" |
| `project` | 项目上下文、进行中的工作 | "认证中间件重写是合规要求，不是技术债清理" |
| `reference` | 外部系统指针 | "流水线 Bug 跟踪在 Linear INGEST 项目中" |

## 核心数据结构

### MemoryEntry

```rust
/// 单条记忆条目
struct MemoryEntry {
    /// 文件名（不含路径），如 "user_role.md"
    name: String,
    /// 简短描述，用于判断相关性
    description: String,
    /// 记忆类型
    memory_type: MemoryType,
    /// 创建时间
    created_at: u64,
    /// 最后更新时间
    updated_at: u64,
    /// 记忆正文（Markdown）
    content: String,
}
```

### 记忆文件格式

每条记忆是带 frontmatter 的 Markdown 文件：

```markdown
---
name: user_role
description: 用户的角色和技术背景
type: user
created_at: 1714723200
updated_at: 1714723200
---

用户是资深 Go 开发者（10 年经验），React 经验较浅（刚开始接触本项目前端）。
偏好简洁的代码风格，不喜欢过度抽象。
```

### MEMORY.md 索引

```markdown
# Memory Index

- [user_role](user_role.md) — 用户角色：资深 Go 开发，React 新手
- [feedback_testing](feedback_testing.md) — 集成测试必须用真实数据库，不要 mock
- [project_auth_rewrite](project_auth_rewrite.md) — 认证中间件重写是合规要求
- [reference_linear](reference_linear.md) — 流水线 Bug 跟踪 → Linear INGEST 项目
```

## MemoryManager

```rust
struct MemoryManager {
    /// 记忆存储根目录
    store_path: PathBuf,
    /// 已加载的索引（文件名 → 描述）
    index: Vec<IndexEntry>,
    /// 已加载的记忆缓存
    cache: HashMap<String, MemoryEntry>,
}

struct IndexEntry {
    file_name: String,
    description: String,
    memory_type: MemoryType,
}

impl MemoryManager {
    /// 初始化：读取 MEMORY.md 建立索引
    fn init(store_path: PathBuf) -> Result<Self, String> {
        let index_path = store_path.join("MEMORY.md");
        let index = if index_path.exists() {
            Self::parse_index(&index_path)?
        } else {
            Vec::new()
        };
        Ok(Self { store_path, index, cache: HashMap::new() })
    }

    /// 保存新记忆
    fn save(&mut self, entry: MemoryEntry) -> Result<(), String> {
        // 1. 写入记忆文件
        let file_path = self.store_path.join(&entry.name);
        let content = Self::format_entry(&entry);
        std::fs::write(&file_path, content)?;

        // 2. 更新索引
        self.index.push(IndexEntry {
            file_name: entry.name.clone(),
            description: entry.description.clone(),
            memory_type: entry.memory_type.clone(),
        });
        self.update_index_file()?;

        // 3. 缓存
        self.cache.insert(entry.name.clone(), entry);
        Ok(())
    }

    /// 更新已有记忆
    fn update(&mut self, name: &str, new_content: &str) -> Result<(), String> {
        if let Some(entry) = self.cache.get_mut(name) {
            entry.content = new_content.to_string();
            entry.updated_at = current_timestamp();
            let file_path = self.store_path.join(name);
            std::fs::write(&file_path, Self::format_entry(entry))?;
        }
        Ok(())
    }

    /// 删除记忆
    fn forget(&mut self, name: &str) -> Result<(), String> {
        let file_path = self.store_path.join(name);
        if file_path.exists() {
            std::fs::remove_file(&file_path)?;
        }
        self.index.retain(|e| e.file_name != name);
        self.cache.remove(name);
        self.update_index_file()?;
        Ok(())
    }

    /// 按类型查询记忆名称列表
    fn list_by_type(&self, memory_type: MemoryType) -> Vec<&IndexEntry> {
        self.index.iter()
            .filter(|e| e.memory_type == memory_type)
            .collect()
    }

    /// 获取索引摘要（用于注入 System Prompt）
    fn index_summary(&self) -> String {
        self.index.iter()
            .map(|e| format!("- [{}]({}) — {}", e.file_name, e.file_name, e.description))
            .collect::<Vec<_>>()
            .join("\n")
    }

    fn format_entry(entry: &MemoryEntry) -> String {
        format!(r#"---
name: {}
description: {}
type: {:?}
created_at: {}
updated_at: {}
---

{}"#,
            entry.name,
            entry.description,
            entry.memory_type,
            entry.created_at,
            entry.updated_at,
            entry.content,
        )
    }
}
```

## 何时保存记忆

| 触发条件 | 记忆类型 | 示例 |
|---------|---------|------|
| 用户说自己的角色/偏好 | `user` | "我是数据科学家，关注可观测性" |
| 用户纠正 Agent 行为 | `feedback` | "不要这么做，上次出过问题" |
| 用户确认非显而易见的做法 | `feedback` | "对，合并成一个 PR 是正确的" |
| 得知项目背景/约束 | `project` | "本周四后冻结合并，移动端发版" |
| 得知外部系统信息 | `reference` | "Bug 在 Linear 项目 INGEST 中追踪" |

**不应保存的内容：**
- 可从代码/git 推导的信息（文件路径、架构模式）
- 本次对话的临时任务状态
- 已在 CLAUDE.md 中记录的项目指令
- Bug 修复方案（修复在代码和 commit message 中）

## 与 Prompt System 的集成

会话开始时，MemoryManager 的索引摘要被注入到 System Prompt：

```rust
// PromptEngine 中
fn build_system_prompt(&self, memory: &MemoryManager) -> String {
    let mut parts = Vec::new();

    parts.push(self.base_prompt.clone());
    parts.push(self.agent_role.clone());

    // 注入记忆索引
    let memory_index = memory.index_summary();
    if !memory_index.is_empty() {
        parts.push(format!("\n## 持久记忆\n\n{}", memory_index));
    }

    parts.join("\n\n")
}
```

## 安全考虑

- 记忆文件存储在用户本地目录，不上传云端
- 敏感信息（API Key 等）不应写入记忆 — 由 MemoryManager 做关键词过滤
- 用户可通过设置清除所有记忆

---

> 下一模块：[Plan Mode](./plan-mode.md)
> 返回 [总览](../agent-architecture-design.md)
