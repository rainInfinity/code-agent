# Prompt System — Prompt 引擎

> 返回 [总览](./agent-architecture-design.md) | 上一模块：[Agent Runtime](./agent-runtime.md) | 下一模块：[Context Manager](./context-manager.md)

---

## 概述

Prompt Engine 负责动态组装发送给 LLM 的完整 Prompt。它将系统提示、Agent 角色描述、运行时上下文、工具定义、对话历史等组件按策略拼接，确保 LLM 获得清晰、完整的指令。

## 架构

```
┌─────────────────────────────────────────────────┐
│              Prompt Engine                       │
│                                                  │
│  输入: SessionConfig + Messages + Tools          │
│  输出: Vec<ContentBlock> (Anthropic 格式)        │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │          Layer 1: System Prompt           │   │
│  │  ┌────────┐ ┌────────┐ ┌──────────────┐  │   │
│  │  │  Base  │ │ Agent  │ │   Runtime    │  │   │
│  │  │ System │ │  Role  │ │   Context    │  │   │
│  │  └────────┘ └────────┘ └──────────────┘  │   │
│  └──────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────┐   │
│  │       Layer 2: Tool Definitions           │   │
│  │  (JSON Schema, 按 Agent 类型筛选)         │   │
│  └──────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────┐   │
│  │    Layer 3: Conversation History          │   │
│  │  (由 Context Manager 裁剪后提供)          │   │
│  └──────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────┐   │
│  │    Layer 4: User Message                  │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## 核心设计

### Prompt 模板

```rust
/// Prompt 模板 — 由多个 Section 组成
struct PromptTemplate {
    name: String,
    sections: Vec<PromptSection>,
}

/// Prompt Section — 静态文本或动态生成
enum PromptSection {
    /// 静态文本，从文件或常量加载
    Static(String),
    /// 动态生成，运行时计算
    Dynamic(Box<dyn Fn(&SessionContext) -> String + Send + Sync>),
    /// 引用另一个模板
    Include(String),
}
```

### 模板分层

System Prompt 分三层，从通用到具体：

```
Layer 1: Base System Prompt (所有 Agent 共享)
    ├── 角色定位："你是一个 AI 编程助手..."
    ├── 行为准则："用简体中文回答"、"保持专业简洁"
    ├── 代码规范："优先编辑现有文件"、"不要引入过度抽象"
    └── 安全约束："不执行危险命令"

Layer 2: Agent Role Prompt (每个 Agent 专属)
    ├── General:"你是全栈开发助手，可以读写文件、执行命令..."
    ├── Explore:"你是代码探索专家，只读分析，不修改文件..."
    ├── Plan:"你是架构规划师，负责设计方案..."
    └── Review:"你是代码审查员，检查安全性和质量..."

Layer 3: Runtime Context (运行时动态)
    ├── 操作系统信息 (OS, Shell, Arch)
    ├── 工作目录 (CWD)
    ├── Git 状态 (branch, changed files, recent commits)
    ├── 项目结构概览 (关键目录和文件)
    └── CLAUDE.md / 项目说明内容
```

### PromptEngine 实现

```rust
struct PromptEngine {
    /// 模板注册表
    templates: HashMap<String, PromptTemplate>,
    /// 项目信息提供者
    project_info: Arc<ProjectInfoProvider>,
}

impl PromptEngine {
    /// 构建完整的 Agent Prompt
    fn build(
        &self,
        agent_type: AgentType,
        tools: &[ToolDefinition],
        messages: &[ContentBlock],
        session_ctx: &SessionContext,
    ) -> Vec<ContentBlock> {
        let mut blocks = Vec::new();

        // 1. 组装 System Prompt
        let system_text = self.build_system_prompt(agent_type, session_ctx);
        blocks.push(ContentBlock::text(system_text));

        // 2. 添加工具定义（作为 system 块的 tool 子块）
        if !tools.is_empty() {
            blocks.push(ContentBlock::tool_definitions(tools));
        }

        // 3. 添加裁剪后的对话历史
        blocks.extend(messages.to_vec());

        blocks
    }

    fn build_system_prompt(
        &self,
        agent_type: AgentType,
        ctx: &SessionContext,
    ) -> String {
        let template = self.templates.get(agent_type.template_key()).unwrap();
        let mut parts = Vec::new();

        for section in &template.sections {
            match section {
                PromptSection::Static(text) => parts.push(text.clone()),
                PromptSection::Dynamic(generator) => parts.push(generator(ctx)),
                PromptSection::Include(name) => {
                    if let Some(included) = self.templates.get(name) {
                        parts.push(self.render_static(included, ctx));
                    }
                }
            }
        }

        parts.join("\n\n")
    }
}
```

### 运行时上下文生成

```rust
struct SessionContext {
    os: String,           // "Windows 11", "macOS 15.1"
    shell: String,        // "PowerShell 5.1", "zsh"
    arch: String,         // "x86_64", "aarch64"
    cwd: PathBuf,         // 当前工作目录
    git_branch: String,   // "main"
    git_status: String,   // "2 modified, 1 untracked"
    recent_commits: Vec<String>,
    project_layout: String, // 项目目录结构概要
}

fn runtime_context_section(ctx: &SessionContext) -> String {
    format!(
        r#"## 运行环境
- 操作系统: {}
- Shell: {} ({})
- 工作目录: {}
- Git 分支: {}
- 当前日期: {}"#,
        ctx.os,
        ctx.shell,
        ctx.arch,
        ctx.cwd.display(),
        ctx.git_branch,
        chrono::Local::now().format("%Y-%m-%d"),
    )
}
```

## 模板文件管理

将 Prompt 模板存储为独立 Markdown 文件，放在 `src-tauri/prompts/` 目录：

```
src-tauri/prompts/
├── base_system.md          # 基础系统提示
├── agent_general.md        # General Agent 角色提示
├── agent_explore.md        # Explore Agent 角色提示
├── agent_plan.md           # Plan Agent 角色提示
├── agent_review.md         # Review Agent 角色提示
├── rules_code_style.md     # 代码规范相关提示
├── rules_security.md       # 安全规范相关提示
└── examples/               # Few-shot 示例
    ├── file_edit.md
    └── code_search.md
```

模板中支持占位符变量：

```markdown
# base_system.md

你是一个 AI 编程助手，运行在 {{os}} 系统上，使用 {{shell}}。

## 代码规范
{{#include rules_code_style.md}}

## 项目说明
{{claude_md_content}}
```

## 与其它模块的协作

| 协作模块 | 提供内容 | 时机 |
|---------|---------|------|
| Context Manager | 裁剪后的对话历史 | 每次 LLM 调用前 |
| Tool System | 可用工具定义 (JSON Schema) | 每次 LLM 调用前 |
| Agent System | Agent 角色描述 | 会话创建时 |
| Prompt Cache | 缓存断点标记 | Prompt 组装完成后 |

## 注意事项

1. **Anthropic 格式兼容** — System prompt 必须是顶级 `system` 类型的 content block，工具定义放在 system 块内
2. **缓存断点位置** — System prompt 末尾放置 `cache_control` 标记，参考 [Prompt Cache](./prompt-cache.md)
3. **模板热更新** — 开发阶段支持监听 `prompts/` 目录变更，自动重载模板
4. **跨平台适配** — Shell 模板根据系统自动选择 `bash` 或 `powershell` 示例

---

> 上一模块：[Agent Runtime](./agent-runtime.md) | 下一模块：[Context Manager](./context-manager.md)
> 返回 [总览](./agent-architecture-design.md)
