# Prompt System — Prompt 引擎

> 返回 [总览](./agent-architecture-design.md) | 上一模块：[Agent Runtime](./agent-runtime.md) | 下一模块：[Context Manager](./context-manager.md)

---

## 概述

Prompt Engine 负责动态组装发送给 LLM 的完整 Prompt。它将系统提示、Agent 角色描述、运行时上下文、工具定义、对话历史等组件按策略拼接，确保 LLM 获得清晰、完整的指令。

设计上参考了 Claude Code 的 System Prompt 工程实践，核心原则：**静态与动态分离以优化 API 缓存命中率**。

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
│  │  │  Base  │ │ Agent  │ │   Dynamic    │  │   │
│  │  │ System │ │  Role  │ │   Boundary   │  │   │
│  │  │(cache: │ │(cache: │ │    Marker    │  │   │
│  │  │ global)│ │ global)│ │              │  │   │
│  │  └────────┘ └────────┘ └──────────────┘  │   │
│  │  ┌──────────────┐ ┌──────────────────┐   │   │
│  │  │   Runtime    │ │   Tool Priority  │   │   │
│  │  │   Context    │ │   Instructions   │   │   │
│  │  └──────────────┘ └──────────────────┘   │   │
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
│  │  + User Context (CLAUDE.md 等前置注入)    │   │
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
    Dynamic {
        generator: Box<dyn Fn(&SessionContext) -> String + Send + Sync>,
        /// 是否每轮重新计算（破坏 API Prompt Cache）
        cache_break: bool,
    },
    /// 引用另一个模板
    Include(String),
}
```

### 模板分层

System Prompt 分为静态段和动态段，中间用显式边界标记分隔：

```
┌─────────────────────────────────────────────┐
│       静态段（cacheScope: 'global'）           │
│       跨所有用户/会话共享 API 缓存             │
├─────────────────────────────────────────────┤
│ Layer 1: Base System Prompt (所有 Agent 共享) │
│   ├── 角色定位："你是一个 AI 编程助手..."      │
│   ├── 行为准则："用简体中文回答"、"保持专业简洁"│
│   ├── 代码规范："优先编辑现有文件"              │
│   └── 安全约束："不执行危险命令"               │
├─────────────────────────────────────────────┤
│ Layer 2: Agent Role Prompt (每个 Agent 专属)   │
│   ├── General:"你是全栈开发助手..."            │
│   ├── Explore:"你是代码探索专家，只读分析..."   │
│   ├── Plan:"你是架构规划师..."                 │
│   └── Review:"你是代码审查员..."               │
├─────────────────────────────────────────────┤
│ Layer 2.5: 工具使用优先级指令                  │
│   ├── "用专用工具读文件，而非 cat/head/tail"    │
│   ├── "用专用工具编辑文件，而非 sed/awk"        │
│   └── "Bash 仅用于系统命令和终端操作"          │
├─────────────────────────────────────────────┤
│ === SYSTEM_PROMPT_DYNAMIC_BOUNDARY ===       │
│   (缓存分界线 — 以下内容不参与全局缓存)        │
├─────────────────────────────────────────────┤
│       动态段（cacheScope: null）              │
│       每会话可能不同的内容                     │
├─────────────────────────────────────────────┤
│ Layer 3: Runtime Context (运行时动态)          │
│   ├── 操作系统信息 (OS, Shell, Arch)          │
│   ├── 工作目录 (CWD)                          │
│   ├── Git 状态 (branch, changed files, commits)│
│   └── 当前日期                                │
├─────────────────────────────────────────────┤
│ Layer 4: 会话特定配置                          │
│   ├── 语言偏好                                │
│   ├── Memory 系统内容                         │
│   └── MCP 服务器指令 (标记为 DANGEROUS_uncached)│
└─────────────────────────────────────────────┘
```

> **关键设计决策**：CLAUDE.md / 项目说明等内容**不放在 System Prompt 中**，而是前置注入到 User Message。因为它们因项目而异，放在 System Prompt 中会严重破坏 API 前缀缓存命中率。

### `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` — 缓存优化的核心机制

Anthropic API 的 Prompt Cache 按**前缀匹配**工作。如果 System Prompt 第一段就包含会话特定内容，所有用户的请求都无法共享缓存。

解决方案：在所有静态内容之后插入一个显式边界标记，API 层根据此标记将 System Prompt 拆分为不同缓存作用域的块：

```rust
/// 缓存分界线标记
/// 此标记之前的 System Prompt 段使用 cacheScope: 'global'（跨用户共享缓存）
/// 此标记之后的 System Prompt 段使用 cacheScope: null（不参与全局缓存）
const SYSTEM_PROMPT_DYNAMIC_BOUNDARY: &str = "__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__";
```

API 层的拆分逻辑：

```rust
fn split_sysprompt_prefix(blocks: &[String]) -> Vec<CacheBlock> {
    let boundary_idx = blocks.iter()
        .position(|b| b == SYSTEM_PROMPT_DYNAMIC_BOUNDARY);

    let mut result = Vec::new();

    if let Some(idx) = boundary_idx {
        // 静态段 → cacheScope: 'global'，所有用户共享
        let static_text = blocks[..idx].join("\n\n");
        result.push(CacheBlock {
            text: static_text,
            cache_scope: CacheScope::Global,
        });

        // 动态段 → cacheScope: null
        let dynamic_text = blocks[idx + 1..].join("\n\n");
        result.push(CacheBlock {
            text: dynamic_text,
            cache_scope: CacheScope::None,
        });
    }

    result
}
```

### Section 缓存系统

动态段中的每个 Section 区分两种生命周期：

```rust
/// 计算一次，缓存到会话结束（或 /clear、/compact）
fn system_prompt_section(
    name: &str,
    compute: ComputeFn,
) -> PromptSection {
    // cache_break: false — 会话内只计算一次
}

/// 每轮重新计算，会破坏 API Prompt Cache
/// 必须提供原因说明！
fn DANGEROUS_uncached_system_prompt_section(
    name: &str,
    compute: ComputeFn,
    reason: &str,  // 必须写明原因！
) -> PromptSection {
    // cache_break: true — 每轮重新计算
}
```

`DANGEROUS_` 前缀的命名约定强制开发者意识到代价——每次使用 uncached section，API Prompt Cache 就会失效，直接增加调用成本。当前仅 MCP 服务器指令需要使用此标记（因为 MCP 服务器可在对话中连接/断开）。

Section 的解析逻辑：

```rust
async fn resolve_sections(sections: &[PromptSection]) -> Vec<Option<String>> {
    let cache = get_section_cache();

    futures::future::join_all(sections.iter().map(|s| async {
        match s {
            PromptSection::Dynamic { cache_break: false, .. } => {
                // 读缓存
                cache.get(s.name()).cloned()
            }
            _ => {
                // 重新计算并写入缓存
                let value = s.compute().await;
                cache.set(s.name(), value.clone());
                Some(value)
            }
        }
    })).await
}
```

缓存在 `/clear`（清空对话）或 `/compact`（压缩上下文）时被清除。

### PromptEngine 实现

```rust
struct PromptEngine {
    /// 模板注册表
    templates: HashMap<String, PromptTemplate>,
    /// 项目信息提供者
    project_info: Arc<ProjectInfoProvider>,
    /// Section 缓存
    section_cache: HashMap<String, String>,
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

        // 1. 组装 System Prompt（包含静态段 + boundary + 动态段）
        let system_parts = self.build_system_prompt(agent_type, session_ctx);
        blocks.extend(system_parts);

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
    ) -> Vec<ContentBlock> {
        let template = self.templates.get(agent_type.template_key()).unwrap();
        let mut static_parts = Vec::new();
        let mut dynamic_parts = Vec::new();

        for section in &template.sections {
            match section {
                PromptSection::Static(text) => {
                    static_parts.push(ContentBlock::text(text.clone()));
                }
                PromptSection::Include(name) => {
                    if let Some(included) = self.templates.get(name) {
                        static_parts.push(
                            ContentBlock::text(self.render_static(included, ctx))
                        );
                    }
                }
                PromptSection::Dynamic { generator, cache_break } => {
                    let rendered = self.resolve_cached(section, ctx);
                    if let Some(text) = rendered {
                        if *cache_break {
                            // 标记为 uncached，每轮重新计算
                            dynamic_parts.push(
                                ContentBlock::text(text).with_cache_scope(None)
                            );
                        } else {
                            dynamic_parts.push(ContentBlock::text(text));
                        }
                    }
                }
            }
        }

        // 在静态段和动态段之间插入边界标记
        let mut result = Vec::new();
        result.extend(static_parts);
        result.push(ContentBlock::text(
            SYSTEM_PROMPT_DYNAMIC_BOUNDARY.to_string()
        ));
        result.extend(dynamic_parts);
        result
    }
}
```

### Prompt 优先级体系

`getSystemPrompt()` 不是唯一的 prompt 来源。提供完整的优先级链，支持不同场景下的覆盖：

```rust
impl PromptEngine {
    /// 按优先级合并最终 System Prompt
    fn build_effective_system_prompt(&self, opts: BuildOptions) -> Vec<String> {
        // 0. Override（最高优先级，如 loop mode）→ 完全替换
        if let Some(override_prompt) = opts.override_system_prompt {
            return vec![override_prompt];
        }

        // 1. Agent prompt（来自 .claude/agents/*.md）
        //    - Proactive 模式：追加到默认 prompt
        //    - 普通模式：替换默认 prompt
        if let Some(agent_prompt) = opts.agent_system_prompt {
            if opts.is_proactive {
                return [
                    self.default_system_prompt.clone(),
                    agent_prompt,
                    opts.append.unwrap_or_default(),
                ].concat();
            }
            return [agent_prompt, opts.append.unwrap_or_default()].concat();
        }

        // 2. Custom system prompt（--system-prompt 参数）→ 替换默认
        if let Some(custom) = opts.custom_system_prompt {
            return [custom, opts.append.unwrap_or_default()].concat();
        }

        // 3. Default system prompt → getSystemPrompt() 的结果
        [
            self.default_system_prompt.clone(),
            opts.append.unwrap_or_default(),
        ].concat()
    }
}
```

优先级链：**Override → Agent（替换或追加）→ Custom → Default + Append**

### 上下文分层放置策略

并非所有上下文都放入 System Prompt。根据内容特性分三层放置：

| 内容 | 放置位置 | 原因 |
|------|---------|------|
| 行为指引（代码风格、安全约束） | System Prompt 静态段 | 不变，可全局缓存 |
| Agent 角色描述 | System Prompt 静态段 | 不变，可全局缓存 |
| 工具使用优先级 | System Prompt 静态段 | 不变，可全局缓存 |
| 运行时环境信息（OS、Shell） | System Prompt 动态段 | 每会话不同 |
| Git 状态信息 | System Prompt 动态段 | 每轮可能变化 |
| **CLAUDE.md / 项目说明** | **User Message 前面** | 因项目而异，放 System Prompt 会破坏缓存 |
| 当前日期 | User Message 前面 | 避免污染 System Prompt |

```rust
/// 系统上下文 — 追加到 System Prompt 末尾（动态段）
struct SystemContext {
    os: String,
    shell: String,
    arch: String,
    cwd: PathBuf,
    git_branch: String,
    git_status: String,
    recent_commits: Vec<String>,
}

/// 用户上下文 — 前置到 User Message
/// 这些内容因项目而异，放在 System Prompt 中会破坏缓存
struct UserContext {
    claude_md_content: Option<String>,  // 项目和用户级记忆文件
    current_date: String,
}

fn prepend_user_context(messages: &[ContentBlock], ctx: &UserContext) -> Vec<ContentBlock> {
    let mut result = Vec::new();
    if let Some(claude_md) = &ctx.claude_md_content {
        result.push(ContentBlock::text(format!(
            "## 项目说明\n\n{}", claude_md
        )));
    }
    result.push(ContentBlock::text(format!(
        "当前日期: {}", ctx.current_date
    )));
    result.extend(messages.to_vec());
    result
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

### 工具使用优先级指令

在 System Prompt 静态段显式编码工具使用优先级，减少模型选错工具的概率。专用工具有更好的权限控制、更精确的进度展示和更安全的执行环境：

```rust
fn tool_priority_section(enabled_tools: &HashSet<ToolName>) -> String {
    let items = [
        format!("用 {} 读取文件，而非 cat、head、tail", FILE_READ_TOOL_NAME),
        format!("用 {} 编辑文件，而非 sed、awk", FILE_EDIT_TOOL_NAME),
        format!("用 {} 创建文件，而非 echo/cat heredoc", FILE_WRITE_TOOL_NAME),
        format!("用 {} 搜索文件，而非 find/ls", GLOB_TOOL_NAME),
        format!("用 {} 搜索内容，而非 grep/rg", GREP_TOOL_NAME),
        format!("{} 仅用于系统命令和终端操作", BASH_TOOL_NAME),
    ];
    format!("# 工具使用规则\n\n{}", items.join("\n"))
}
```

### 预取策略

Prompt 的计算不应等到用户发送消息才开始。在 Agent Runtime 初始化时并行预取系统上下文：

```rust
impl AgentRuntime {
    async fn start_deferred_prefetches(&self) {
        // 并行预取，不阻塞 UI 渲染
        tokio::join!(
            self.prefetch_user_context(),   // CLAUDE.md 内容
            self.prefetch_system_context(), // Git 状态等
        );
    }

    async fn prefetch_system_context(&self) {
        // 仅在用户已接受信任对话框后预取
        // Git 状态可能包含敏感信息
        if !self.trust_dialog_accepted() {
            return;
        }
        // 并行执行 Git 命令
        let (branch, status, log) = tokio::join!(
            git_branch(),
            git_status_short(),
            git_log_recent(5),
        );
        self.cache_system_context(branch, status, log);
    }
}
```

### Subagent 的 Prompt 增强

创建子 Agent 时，除了切换角色 Prompt，还需追加 Agent 隔离相关的运行时约束：

```rust
fn enhance_for_subagent(
    existing_prompt: &[String],
    model: &str,
    working_dirs: &[PathBuf],
) -> Vec<String> {
    let mut enhanced = existing_prompt.to_vec();

    // Agent 隔离约束
    enhanced.push(r#"## Agent 隔离说明
- Agent 线程每次 bash 调用后 CWD 会被重置，请始终使用绝对路径
- 最终回复中分享文件路径时，一律使用绝对路径，不要使用相对路径
- 与用户沟通时避免使用 emoji"#.to_string());

    // 追加环境信息
    let env_info = compute_env_info(model, working_dirs);
    enhanced.push(env_info);

    enhanced
}
```

对于 fork 类型的子 Agent，可直接复用父线程已渲染的 system prompt 字节（而非重新生成），确保 fork children 之间共享 API 缓存：

```rust
fn build_fork_subagent_prompt(
    parent_rendered_prompt: &[u8],  // 父线程已渲染的字节
    tool_definitions: &[ToolDefinition],
) -> SystemPrompt {
    // 直接复用父线程的渲染结果，保证字节级精确
    // 避免因 GrowthBook 冷/热状态不同导致缓存失效
    SystemPrompt::from_bytes(parent_rendered_prompt, tool_definitions)
}
```

## 模板文件管理

将 Prompt 模板存储为独立 Markdown 文件，放在 `src-tauri/prompts/` 目录：

```
src-tauri/prompts/
├── base_system.md          # 基础系统提示（静态段）
├── agent_general.md        # General Agent 角色提示（静态段）
├── agent_explore.md        # Explore Agent 角色提示（静态段）
├── agent_plan.md           # Plan Agent 角色提示（静态段）
├── agent_review.md         # Review Agent 角色提示（静态段）
├── rules_code_style.md     # 代码规范相关提示
├── rules_security.md       # 安全规范相关提示
├── rules_tool_priority.md  # 工具使用优先级
├── agent_isolation.md      # Subagent 隔离约束
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

## 工具使用规则
{{#include rules_tool_priority.md}}
```

## 与其它模块的协作

| 协作模块 | 提供内容 | 时机 |
|---------|---------|------|
| Context Manager | 裁剪后的对话历史 | 每次 LLM 调用前 |
| Tool System | 可用工具定义 (JSON Schema) | 每次 LLM 调用前 |
| Agent System | Agent 角色描述 | 会话创建时 |
| Prompt Cache | 缓存断点标记 (boundary marker) | Prompt 组装完成后 |
| Agent Runtime | 预取触发信号 | 会话初始化时 |

## 注意事项

1. **Anthropic 格式兼容** — System prompt 必须是顶级 `system` 类型的 content block，工具定义放在 system 块内
2. **缓存断点位置** — 静态段与动态段之间放置 `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` 标记，API 层据此拆分缓存块
3. **CLAUDE.md 不放 System Prompt** — 项目说明内容前置到 User Message，避免破坏 System Prompt 前缀缓存
4. **模板热更新** — 开发阶段支持监听 `prompts/` 目录变更，自动重载模板
5. **跨平台适配** — Shell 模板根据系统自动选择 `bash` 或 `powershell` 示例
6. **`DANGEROUS_` 约定** — 对每轮重新计算的 Section 使用 `DANGEROUS_uncached` 前缀，强制开发者意识到 API 缓存失效的成本
7. **预取优先** — 在 Agent Runtime 初始化时并行预取系统上下文，避免 Prompt 构建时的串行等待

---

> 上一模块：[Agent Runtime](./agent-runtime.md) | 下一模块：[Context Manager](./context-manager.md)
> 返回 [总览](./agent-architecture-design.md)
