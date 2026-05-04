# Slash Commands — 内置命令系统

> 返回 [总览](../agent-architecture-design.md) | 上一模块：[Hooks System](./hooks-system.md)

---

## 概述

Slash Commands 是用户通过 `/command` 语法与 Agent 交互的控制面。它们不是发给 LLM 的消息，而是在 Agent Runtime 层被拦截和处理的内置指令。这给了用户丰富的运行时控制能力。

## 设计理念

- **以 `/` 开头** — 明确的命令前缀，区别于普通对话
- **前端路由** — 前端先拦截，本地能处理的不要让 LLM 处理
- **可扩展** — 用户可注册自定义命令（通过 Hooks）
- **上下文感知** — 命令可访问当前会话状态

## 架构

```
用户输入: "/compact"
         │
         ▼
┌─────────────────┐
│  Command Parser  │  ← 前缀匹配 /
└────────┬────────┘
         │
    ┌────┴────┐
    │ 是命令？  │
    └────┬────┘
         │
    ┌────┴────────────┐
    ▼                 ▼
  是                 否
    │                 │
    ▼                 ▼
┌────────┐      ┌──────────┐
│Command  │      │ 正常发送  │
│Handler  │      │ 到 Agent  │
└───┬─────┘      └──────────┘
    │
    ├── 本地命令 (前端/Rust 直接处理)
    │   /help, /clear, /config, /undo...
    │
    └── Agent 命令 (传给 Agent 处理)
        /task, /plan, /review...
```

## 命令分类

### 本地命令（不在 LLM 上下文中执行）

| 命令 | 参数 | 说明 |
|------|------|------|
| `/help` | `[command]` | 显示帮助信息 |
| `/clear` | — | 清除当前会话上下文 |
| `/compact` | — | 压缩/摘要上下文历史 |
| `/undo` | — | 撤销最近一次文件操作 |
| `/diff` | — | 显示当前工作区变更 |
| `/config` | `<key> [value]` | 查看/修改配置项 |
| `/doctor` | — | 系统自检与修复 |
| `/status` | — | 显示当前 Agent 状态 |
| `/quit` | — | 退出 Agent |

### Agent 命令（委托给 Agent 处理）

| 命令 | 参数 | 说明 |
|------|------|------|
| `/task` | `create/list/done` | 任务管理 |
| `/plan` | `[description]` | 进入规划模式 |
| `/review` | `[file]` | 代码审查 |
| `/explore` | `[query]` | 代码探索 |
| `/model` | `<model-id>` | 切换 LLM 模型 |
| `/agent` | `<agent-type>` | 切换 Agent 类型 |

## 核心数据结构

```rust
/// 命令定义
struct CommandDefinition {
    /// 命令名称（不含 /）
    name: String,
    /// 简短描述
    description: String,
    /// 参数说明
    args: Vec<CommandArg>,
    /// 命令处理器类型
    handler: CommandHandler,
    /// 别名
    aliases: Vec<String>,
}

struct CommandArg {
    name: String,
    required: bool,
    description: String,
    default: Option<String>,
}

enum CommandHandler {
    /// 前端直接处理
    Frontend,
    /// Rust 后端处理
    Backend,
    /// 委托给 Agent（进入对话循环）
    Agent,
}

/// 命令执行结果
enum CommandResult {
    /// 命令已处理，前端显示结果
    Handled { message: String, data: Option<Value> },
    /// 委托给 Agent 处理
    DelegateToAgent { prompt: String },
    /// 命令无效
    Invalid { reason: String },
}
```

## 命令注册表

```rust
/// 命令注册表
struct CommandRegistry {
    commands: HashMap<String, CommandDefinition>,
}

impl CommandRegistry {
    fn new() -> Self {
        let mut registry = Self { commands: HashMap::new() };

        // === 本地命令 ===

        registry.register(CommandDefinition {
            name: "help".into(),
            description: "显示帮助信息。用法: /help [command]".into(),
            args: vec![CommandArg {
                name: "command".into(),
                required: false,
                description: "要查看帮助的命令名".into(),
                default: None,
            }],
            handler: CommandHandler::Frontend,
            aliases: vec!["h".into(), "?".into()],
        });

        registry.register(CommandDefinition {
            name: "clear".into(),
            description: "清除当前会话上下文，开始新对话".into(),
            args: vec![],
            handler: CommandHandler::Backend,
            aliases: vec![],
        });

        registry.register(CommandDefinition {
            name: "compact".into(),
            description: "压缩上下文历史，释放 token 预算".into(),
            args: vec![],
            handler: CommandHandler::Backend,
            aliases: vec!["compress".into()],
        });

        registry.register(CommandDefinition {
            name: "undo".into(),
            description: "撤销最近一次文件修改操作".into(),
            args: vec![],
            handler: CommandHandler::Backend,
            aliases: vec![],
        });

        registry.register(CommandDefinition {
            name: "diff".into(),
            description: "显示当前工作区所有未提交的变更".into(),
            args: vec![],
            handler: CommandHandler::Backend,
            aliases: vec!["changes".into()],
        });

        registry.register(CommandDefinition {
            name: "doctor".into(),
            description: "运行系统自检，诊断常见配置问题".into(),
            args: vec![],
            handler: CommandHandler::Backend,
            aliases: vec![],
        });

        // === Agent 命令 ===

        registry.register(CommandDefinition {
            name: "task".into(),
            description: "任务管理: /task [create|list|done]".into(),
            args: vec![CommandArg {
                name: "action".into(),
                required: false,
                description: "create, list, 或 done".into(),
                default: Some("list".into()),
            }],
            handler: CommandHandler::Agent,
            aliases: vec![],
        });

        registry.register(CommandDefinition {
            name: "model".into(),
            description: "切换 LLM 模型: /model <model-id>".into(),
            args: vec![CommandArg {
                name: "model".into(),
                required: true,
                description: "模型 ID，如 claude-sonnet-4-6".into(),
                default: None,
            }],
            handler: CommandHandler::Backend,
            aliases: vec![],
        });

        registry
    }

    fn register(&mut self, def: CommandDefinition) {
        self.commands.insert(def.name.clone(), def);
        for alias in &def.aliases {
            self.commands.insert(alias.clone(), CommandDefinition {
                name: alias.clone(),
                ..def.clone()
            });
        }
    }
}
```

## 命令解析器

```rust
/// 解析用户输入中的命令
struct CommandParser;

impl CommandParser {
    /// 解析命令字符串
    fn parse(input: &str) -> Option<ParsedCommand> {
        let input = input.trim();

        // 必须以 / 开头
        if !input.starts_with('/') {
            return None;
        }

        // 分离命令名和参数
        let parts: Vec<&str> = input[1..].splitn(2, ' ').collect();
        let name = parts[0].to_lowercase();
        let args = parts.get(1).unwrap_or(&"").to_string();

        Some(ParsedCommand { name, args })
    }
}

struct ParsedCommand {
    name: String,
    args: String,
}
```

## 命令执行流程

```rust
impl CommandRegistry {
    async fn execute(
        &self,
        parsed: ParsedCommand,
        session: &AgentSession,
    ) -> CommandResult {
        let cmd = match self.commands.get(&parsed.name) {
            Some(c) => c,
            None => return CommandResult::Invalid {
                reason: format!("未知命令: /{}。输入 /help 查看可用命令", parsed.name)
            },
        };

        match cmd.handler {
            CommandHandler::Frontend => {
                CommandResult::Handled {
                    message: format!("/{} 命令已处理", cmd.name),
                    data: None,
                }
            }
            CommandHandler::Backend => {
                self.handle_backend_command(cmd, &parsed.args, session).await
            }
            CommandHandler::Agent => {
                // 转换为 Agent 对话
                CommandResult::DelegateToAgent {
                    prompt: format!("执行命令: /{} {}", cmd.name, parsed.args),
                }
            }
        }
    }

    async fn handle_backend_command(
        &self,
        cmd: &CommandDefinition,
        args: &str,
        session: &AgentSession,
    ) -> CommandResult {
        match cmd.name.as_str() {
            "clear" => {
                session.clear_context();
                CommandResult::Handled {
                    message: "上下文已清除".into(),
                    data: None,
                }
            }
            "compact" => {
                let summary = session.context_manager.compact().await;
                CommandResult::Handled {
                    message: format!("上下文已压缩 ({} → {} tokens)",
                        summary.before, summary.after),
                    data: None,
                }
            }
            "undo" => {
                match session.tool_history.last() {
                    Some(last) => {
                        // 撤销逻辑
                        CommandResult::Handled {
                            message: format!("已撤销: {}", last.summary),
                            data: None,
                        }
                    }
                    None => CommandResult::Handled {
                        message: "没有可撤销的操作".into(),
                        data: None,
                    }
                }
            }
            "diff" => {
                let diff = session.get_diff().await.unwrap_or_default();
                CommandResult::Handled {
                    message: if diff.is_empty() {
                        "没有未提交的变更".into()
                    } else {
                        diff
                    },
                    data: None,
                }
            }
            _ => CommandResult::Invalid {
                reason: format!("命令 /{} 的后端处理尚未实现", cmd.name)
            }
        }
    }
}
```

## 前端命令 UI

```
消息输入框:
┌────────────────────────────────────────────────────┐
│ /help                                          [↑] │
└────────────────────────────────────────────────────┘

输入 / 时触发自动补全:
┌──────────────────────────────┐
│ /help     - 显示帮助信息      │
│ /clear    - 清除会话上下文    │
│ /compact  - 压缩上下文        │
│ /diff     - 显示变更          │
│ /undo     - 撤销最近操作      │
│ /task     - 任务管理          │
│ /model    - 切换模型          │
│ /doctor   - 系统自检          │
└──────────────────────────────┘
```

### TypeScript 实现

```typescript
// src/commands/registry.ts
interface CommandDef {
  name: string;
  description: string;
  handler: 'frontend' | 'backend' | 'agent';
  aliases?: string[];
  args?: CommandArg[];
}

const COMMANDS: CommandDef[] = [
  { name: 'help', description: '显示帮助信息', handler: 'frontend', aliases: ['h', '?'] },
  { name: 'clear', description: '清除会话上下文', handler: 'backend' },
  { name: 'compact', description: '压缩上下文历史', handler: 'backend', aliases: ['compress'] },
  { name: 'undo', description: '撤销最近文件操作', handler: 'backend' },
  { name: 'diff', description: '显示工作区变更', handler: 'backend', aliases: ['changes'] },
  { name: 'doctor', description: '系统自检', handler: 'backend' },
  { name: 'task', description: '任务管理: /task [create|list|done]', handler: 'agent' },
  { name: 'plan', description: '进入规划模式', handler: 'agent' },
  { name: 'model', description: '切换 LLM 模型', handler: 'backend' },
  { name: 'agent', description: '切换 Agent 类型', handler: 'backend' },
];

function parseCommand(input: string): ParsedCommand | null {
  if (!input.startsWith('/')) return null;
  const trimmed = input.slice(1);
  const spaceIdx = trimmed.indexOf(' ');
  const name = spaceIdx > 0 ? trimmed.slice(0, spaceIdx).toLowerCase() : trimmed.toLowerCase();
  const args = spaceIdx > 0 ? trimmed.slice(spaceIdx + 1) : '';
  return { name, args };
}
```

## 用户自定义命令

通过 Hooks System，用户可以注册自定义命令：

```json
// .claude/hooks/hooks.json
{
  "customCommands": [
    {
      "name": "deploy-staging",
      "description": "部署到预发布环境",
      "command": "./scripts/deploy-staging.sh",
      "handler": "backend"
    },
    {
      "name": "todo",
      "description": "创建 TODO 并推送到 Linear",
      "command": "node .claude/hooks/create-todo.js",
      "handler": "backend"
    }
  ]
}
```

---

> 上一模块：[Hooks System](./hooks-system.md)
> 返回 [总览](../agent-architecture-design.md)
