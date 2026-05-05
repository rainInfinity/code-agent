# Prompt System — Prompt 引擎

> 返回 [总览](../agent-architecture-design.md) | 上一模块：[Agent Runtime](./agent-runtime.md)

---

## 概述

Prompt Engine 负责动态组装发送给 LLM 的完整 System Prompt。它将系统提示、Agent 角色描述、运行时上下文、工具定义等组件按模板拼接，最终输出单个 system prompt 字符串。

**当前状态:** Phase 1 已完成。支持 code/chat 双模式，模板通过 `include_str!` 编译时嵌入。

---

## 架构

```
┌─────────────────────────────────────────────────┐
│              Prompt Engine                       │
│                                                  │
│  输入: agent_type + messages + tools + ctx       │
│  输出: PromptBuildResult { system_prompt,        │
│          messages, tools }                       │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │          System Prompt 组装顺序            │   │
│  │                                           │   │
│  │  code 模式:                               │   │
│  │  base_system.md (静态)                    │   │
│  │  → agent_code.md (静态)                  │   │
│  │  → rules_tool_priority.md (静态)          │   │
│  │  → __CACHE_BOUNDARY__ (缓存分界线)        │   │
│  │  → runtime_context.md (动态，占位符替换)  │   │
│  │                                           │   │
│  │  chat 模式:                               │   │
│  │  base_system.md (静态)                    │   │
│  │  → agent_chat.md (静态)                  │   │
│  │  → __CACHE_BOUNDARY__ (缓存分界线)        │   │
│  │  → runtime_context.md (动态，占位符替换)  │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

## 核心数据结构

### PromptSection — 模板片段

```rust
pub enum PromptSection {
    /// 静态文本，编译时嵌入（include_str!）
    Static(&'static str),
    /// 动态文本，运行时进行 {{placeholder}} 替换
    Dynamic(&'static str),
    /// 引用内容，作为分隔标记插入
    Include(&'static str),
}
```

### PromptTemplate — 模板定义

```rust
pub struct PromptTemplate {
    pub sections: Vec<PromptSection>,
}
```

### PromptEngine — 构建器

```rust
pub struct PromptEngine {
    templates: TemplateRegistry,  // HashMap<&'static str, PromptTemplate>
}

pub struct PromptBuildResult {
    pub system_prompt: String,         // 完整 System Prompt 字符串
    pub messages: Vec<ChatMessage>,    // 透传的消息列表
    pub tools: Vec<ToolDefinition>,    // 透传的工具定义
}
```

---

## 模板注册 (builtins)

模板在编译时通过 `include_str!` 宏嵌入二进制文件，存储在 `src-tauri/prompts/` 目录：

```
src-tauri/prompts/
├── base_system.md          # 基础系统提示（所有模式共享）
├── agent_code.md           # Code Agent 角色提示
├── agent_chat.md           # Chat Agent 角色提示
├── rules_tool_priority.md  # 工具使用优先级指令
└── runtime_context.md      # 运行时上下文模板
```

```rust
pub fn registry() -> TemplateRegistry {
    [
        ("code", PromptTemplate::new(vec![
            PromptSection::Static(BASE_SYSTEM),
            PromptSection::Static(AGENT_CODE),
            PromptSection::Static(RULES_TOOL_PRIORITY),
            PromptSection::Include(CACHE_BOUNDARY),       // "__CACHE_BOUNDARY__"
            PromptSection::Dynamic(RUNTIME_CONTEXT),
        ])),
        ("chat", PromptTemplate::new(vec![
            PromptSection::Static(BASE_SYSTEM),
            PromptSection::Static(AGENT_CHAT),
            PromptSection::Include(CACHE_BOUNDARY),
            PromptSection::Dynamic(RUNTIME_CONTEXT),
        ])),
    ].into_iter().collect()
}
```

**关键差异:**
- **code 模式**包含 `rules_tool_priority.md`（工具使用优先级指令），Agent Loop 中会传入工具定义
- **chat 模式**不含工具规则，Agent Loop 中传入空工具列表，LLM 不会调用工具

---

## 缓存边界标记

`CACHE_BOUNDARY = "__CACHE_BOUNDARY__"` 标记插入在静态段和动态段之间，用于后续 Prompt Cache 实现中划分缓存作用域：

```
静态段（可全局缓存）
  base_system.md + agent_code.md + rules_tool_priority.md
  ↓
__CACHE_BOUNDARY__
  ↓
动态段（不可缓存，每会话变化）
  runtime_context.md（OS、Shell、CWD、Git 状态等）
```

> **注意**: 当前仅插入了边界标记字符串，尚未实现 Anthropic `cache_control` API 头。完整的 Prompt Cache 功能将在 Phase 6 实现。

---

## 运行时上下文

`collect_session_context()` 在每次 `agent_loop` 迭代时收集：

```rust
pub struct SessionContext {
    pub os: String,              // std::env::consts::OS
    pub shell: String,           // 从 SHELL/ComSpec 环境变量提取
    pub arch: String,            // std::env::consts::ARCH
    pub cwd: String,             // 工作目录（前端传入或当前目录）
    pub git_branch: Option<String>,  // git rev-parse --abbrev-ref HEAD
    pub git_status: Option<String>,  // git status --short
}
```

动态模板 `runtime_context.md` 使用 `{{placeholder}}` 语法：

```markdown
## Runtime Environment
- OS: {{os}}
- Shell: {{shell}} ({{arch}})
- Current working directory: {{cwd}}
- Git branch: {{git_branch}}
- Git status: {{git_status}}
```

占位符在 `render_runtime_context()` 中进行字符串替换。

---

## PromptEngine::build() 流程

```rust
pub fn build(&self, agent_type: &str, messages: &[ChatMessage],
             tools: &[ToolDefinition], session_ctx: &SessionContext) -> PromptBuildResult {
    let template = self.template_for(agent_type);
    let system_prompt = template.sections.iter()
        .map(|section| match section {
            PromptSection::Static(content) | PromptSection::Include(content) => {
                content.trim().to_string()
            }
            PromptSection::Dynamic(content) => {
                render_runtime_context(content, session_ctx)
            }
        })
        .filter(|section| !section.is_empty())
        .collect::<Vec<_>>()
        .join("\n\n");

    PromptBuildResult {
        system_prompt,
        messages: messages.to_vec(),
        tools: tools.to_vec(),
    }
}
```

---

## 与其它模块的协作

| 协作模块 | 提供内容 | 时机 |
|---------|---------|------|
| Agent Runtime | `agent_type` + `messages` + `tools` | 每次 LLM 调用前 |
| Tool System | 可用工具定义 (JSON Schema) | agent_loop 中获取 `registry.definitions()` |
| LLM Client | 接收 `system_prompt` 字符串 | 作为 `stream_chat_with_tools` 的 `system` 参数 |

---

## 当前限制与待实现

1. **仅两个 Agent 类型** — code/chat，不支持 Explore/Plan/Review（Phase 4 规划）
2. **无 Section 缓存** — 动态段每轮都重新执行 git 命令（Phase 6 规划）
3. **无 Anthropic cache_control** — CACHE_BOUNDARY 标记已插入但 API 层未使用（Phase 6 规划）
4. **无 CLAUDE.md 注入** — 项目/用户级指令文件未读取和注入（Memory System Phase 5 规划）
5. **无模板热更新** — 模板编译时嵌入，修改需要重新编译
6. **无 Prompt 优先级覆盖** — 不支持用户自定义 system prompt 覆盖

---

> 上一模块：[Agent Runtime](./agent-runtime.md) | 下一模块：[Context Manager](./context-manager.md)
> 返回 [总览](../agent-architecture-design.md)
