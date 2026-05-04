# Agent System — 多 Agent 系统

> 返回 [总览](./agent-architecture-design.md) | 上一模块：[Tool System](./tool-system.md) | 下一模块：[Task System](./task-system.md)

---

## 概述

Agent System 管理多个专职 Agent 的定义、注册和调度。不同 Agent 有不同的系统提示词、可用工具集、权限策略和默认模型，根据用户意图智能路由到最合适的 Agent。

## 设计理念

不是"一个超级 Agent 做所有事"，而是"多个专职 Agent 各司其职"：

```
用户输入: "帮我找一下项目中所有用了 useState 的组件"
                │
                ▼
        ┌──────────────┐
        │  Agent Router │  ← 分析意图
        └──────┬───────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
┌──────┐ ┌──────┐ ┌──────────┐
│Explore│ │General│ │  Plan   │
└──────┘ └──────┘ └──────────┘
    │
    ▼
  只读工具: grep, glob, read_file
  自动批准，无需用户确认
```

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                   Agent Manager                          │
│                                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │              Agent Registry                         │ │
│  │                                                     │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐           │ │
│  │  │ General  │ │ Explore  │ │  Plan    │  ...      │ │
│  │  │ Purpose  │ │  Agent   │ │  Agent   │           │ │
│  │  └──────────┘ └──────────┘ └──────────┘           │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │              Agent Router                           │ │
│  │                                                     │ │
│  │  用户输入 → 意图分析 → 选择合适的 Agent              │ │
│  │  或: 用户显式指定 Agent 类型                         │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │           Agent Delegation                          │ │
│  │  主 Agent 可以委托子 Agent 执行子任务                │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 核心数据结构

### AgentDefinition

```rust
/// Agent 定义 — 描述一个 Agent 的所有配置
struct AgentDefinition {
    /// Agent 类型标识
    agent_type: AgentType,
    /// 展示名称
    display_name: String,
    /// 描述
    description: String,
    /// 系统提示模板名称（对应 prompts/ 目录）
    system_prompt_template: String,
    /// 可用工具名称列表（"*" 表示全部）
    tools: Vec<String>,
    /// 默认使用的模型
    default_model: String,
    /// 权限策略
    permission_policy: PermissionPolicy,
    /// 是否允许委托给其他 Agent
    can_delegate: bool,
    /// 是否允许被其他 Agent 调用（子 Agent）
    is_subagent: bool,
    /// UI 图标标识
    icon: String,
}

enum AgentType {
    /// 通用 Agent — 全功能，可读写文件、执行命令
    GeneralPurpose,
    /// 探索 Agent — 只读代码分析
    Explore,
    /// 规划 Agent — 架构设计和方案评估
    Plan,
    /// 审查 Agent — 代码变更审查
    CodeReview,
}
```

### 内置 Agent 定义

```rust
fn built_in_agents() -> Vec<AgentDefinition> {
    vec![
        AgentDefinition {
            agent_type: AgentType::GeneralPurpose,
            display_name: "General".into(),
            description: "全栈开发助手，可以读写文件、执行命令、搜索代码。适用于大多数开发任务。".into(),
            system_prompt_template: "agent_general".into(),
            tools: vec!["*".into()],
            default_model: "claude-sonnet-4-6".into(),
            permission_policy: PermissionPolicy::AskAll,
            can_delegate: true,
            is_subagent: false,
            icon: "bot".into(),
        },
        AgentDefinition {
            agent_type: AgentType::Explore,
            display_name: "Explore".into(),
            description: "代码探索专家，只读分析代码库，不修改任何文件。用于搜索、理解和分析代码。".into(),
            system_prompt_template: "agent_explore".into(),
            tools: vec![
                "read_file".into(),
                "grep".into(),
                "glob".into(),
                "list_directory".into(),
                "git_log".into(),
            ],
            default_model: "claude-haiku-4-5-20251001".into(),
            permission_policy: PermissionPolicy::AutoApprove,
            can_delegate: false,
            is_subagent: true,
            icon: "search".into(),
        },
        AgentDefinition {
            agent_type: AgentType::Plan,
            display_name: "Plan".into(),
            description: "架构规划师，负责设计方案、评估技术选型、拆解任务。".into(),
            system_prompt_template: "agent_plan".into(),
            tools: vec![
                "read_file".into(),
                "grep".into(),
                "glob".into(),
                "list_directory".into(),
                "web_search".into(),
            ],
            default_model: "claude-sonnet-4-6".into(),
            permission_policy: PermissionPolicy::AutoApprove,
            can_delegate: true,
            is_subagent: false,
            icon: "clipboard".into(),
        },
        AgentDefinition {
            agent_type: AgentType::CodeReview,
            display_name: "Review".into(),
            description: "代码审查员，检查安全漏洞、代码质量和最佳实践。".into(),
            system_prompt_template: "agent_review".into(),
            tools: vec![
                "read_file".into(),
                "grep".into(),
                "git_diff".into(),
                "read_lints".into(),
            ],
            default_model: "claude-sonnet-4-6".into(),
            permission_policy: PermissionPolicy::AutoApprove,
            can_delegate: true,
            is_subagent: false,
            icon: "shield".into(),
        },
    ]
}
```

## Agent 路由

```rust
/// Agent 路由器 — 分析用户输入，选择合适的 Agent
struct AgentRouter {
    agents: Vec<AgentDefinition>,
    default_agent: AgentType,
}

impl AgentRouter {
    /// 根据用户消息选择 Agent
    fn route(&self, user_message: &str, explicit_choice: Option<AgentType>) -> AgentType {
        // 用户显式选择 → 直接使用
        if let Some(agent_type) = explicit_choice {
            return agent_type;
        }

        // 关键词匹配
        let msg_lower = user_message.to_lowercase();

        if self.contains_any(&msg_lower, &["探索", "查找", "搜索", "explore", "find", "search", "grep", "where is", "what file"]) {
            return AgentType::Explore;
        }

        if self.contains_any(&msg_lower, &["设计", "规划", "架构", "方案", "design", "plan", "architecture", "approach"]) {
            return AgentType::Plan;
        }

        if self.contains_any(&msg_lower, &["审查", "review", "检查", "check", "安全", "security"]) {
            return AgentType::CodeReview;
        }

        // 默认
        self.default_agent.clone()
    }

    fn contains_any(&self, text: &str, keywords: &[&str]) -> bool {
        keywords.iter().any(|kw| text.contains(kw))
    }
}
```

## Agent 委托机制

主 Agent（General）可以将子任务委托给子 Agent：

```
主 Agent (General)                   子 Agent (Explore)
      │                                     │
      │ delegate("搜索 useState 用法")        │
      │────────────────────────────────────→│
      │                                     │ 独立上下文
      │                                     │ 只读工具
      │                                     │ 自动批准
      │         结果: found 3 files          │
      │←────────────────────────────────────│
      │                                     │
      │ 继续主循环                            │
```

### 实现

```rust
impl AgentRuntime {
    /// 委托子任务给另一个 Agent
    async fn delegate(
        &self,
        to: AgentType,
        task: String,
        parent_session: &AgentSession,
    ) -> Result<String, AgentError> {
        let child_config = AgentConfig {
            agent_type: to,
            max_turns: 10, // 子 Agent 限制更严格
            auto_approve_safe: true,
            ..parent_session.config.clone()
        };

        // 子 Agent 使用独立会话
        let result = self.run(task, child_config).await?;

        // 返回结果给父 Agent
        Ok(result.final_message)
    }
}
```

## Agent Manager

```rust
/// Agent 管理器 — 全局单例
struct AgentManager {
    /// Agent 注册表
    registry: HashMap<AgentType, AgentDefinition>,
    /// 路由器
    router: AgentRouter,
    /// 当前活跃的 Agent 类型
    active_agent: Mutex<AgentType>,
}

impl AgentManager {
    fn new() -> Self {
        let agents = built_in_agents();
        let registry: HashMap<_, _> = agents
            .into_iter()
            .map(|a| (a.agent_type.clone(), a))
            .collect();

        Self {
            registry,
            router: AgentRouter::new(),
            active_agent: Mutex::new(AgentType::GeneralPurpose),
        }
    }

    /// 获取 Agent 定义
    fn get(&self, agent_type: &AgentType) -> Option<&AgentDefinition> {
        self.registry.get(agent_type)
    }

    /// 列出所有可用 Agent（供前端展示）
    fn list_agents(&self) -> Vec<&AgentDefinition> {
        self.registry.values().collect()
    }

    /// 切换活跃 Agent
    fn set_active(&self, agent_type: AgentType) {
        *self.active_agent.lock().unwrap() = agent_type;
    }
}
```

## 前端 Agent 选择 UI

```
┌─────────────────────────────────────────┐
│  Agent: [General ▼]                     │
│  ┌─────────────────────────────────┐    │
│  │ 🤖 General   全栈开发助手        │    │
│  │ 🔍 Explore   代码探索（只读）    │    │
│  │ 📋 Plan      架构规划师          │    │
│  │ 🛡️ Review    代码审查员          │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

前端通过 `useAgent` Hook 管理 Agent 选择和状态：

```typescript
// src/hooks/useAgent.ts
function useAgent() {
  const [activeAgent, setActiveAgent] = useState<AgentType>('general');
  const [agents, setAgents] = useState<AgentDefinition[]>([]);

  const send = useCallback(async (message: string) => {
    await invoke('run_agent', {
      message,
      agentType: activeAgent,
      config: { /* ... */ },
    });
  }, [activeAgent]);

  return { agents, activeAgent, setActiveAgent, send };
}
```

## 与其它模块的协作

| 模块 | 提供给 Agent System | 从 Agent System 获取 |
|------|-------------------|-------------------|
| Prompt Engine | — | Agent 角色描述、工具列表 |
| Tool System | 可用工具定义 | 该 Agent 允许的工具名称 |
| Permission Manager | — | Agent 的权限策略 |
| Task System | — | Agent 类型作为任务执行者 |
| Agent Runtime | — | Agent 定义（配置来源） |

## 扩展性

支持通过配置文件自定义 Agent：

```json
// settings.json 中的自定义 Agent 定义
{
  "customAgents": [
    {
      "type": "docs-writer",
      "displayName": "Docs Writer",
      "description": "文档编写专家",
      "tools": ["read_file", "write_file", "grep"],
      "model": "claude-haiku-4-5-20251001",
      "permissionPolicy": "ask_once"
    }
  ]
}
```

---

> 上一模块：[Tool System](./tool-system.md) | 下一模块：[Task System](./task-system.md)
> 返回 [总览](./agent-architecture-design.md)
