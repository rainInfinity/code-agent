# Tool System — 工具系统

> 返回 [总览](../agent-architecture-design.md) | 上一模块：[Prompt Cache](./prompt-cache.md) | 下一模块：[Agent System](./agent-system.md)

---

## 概述

Tool System 定义和执行 Agent 可用的所有工具。设计上借鉴了 Claude Code 工具系统的核心模式：**Builder + 安全默认**、**并发安全分区**、**三层条件注册**和**工具级权限委托**。

**当前状态:** Phase 2 框架部分已完成。Trait + Registry + Executor 均已实现并集成到 Agent Loop，但**具体工具尚未实现**——`with_defaults()` 返回空注册表。

---

## 架构

```
┌──────────────────────────────────────────────────────────────────┐
│                        Tool System                                │
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐   │
│  │  ToolRegistry    │  │  Tool Executor   │  │   Sandbox     │   │
│  │  (三层注册/查找) │  │  (并发分区/超时/ │  │  (路径白名单) │   │
│  │                  │  │   结果截断)      │  │               │   │
│  └──────────────────┘  └──────────────────┘  └──────────────┘   │
│                                                                   │
│  已实现: 框架就绪，待注册具体工具                                  │
│  待实现: read_file, write_file, grep, bash, sandbox ...          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 核心接口

### 扩展的 Tool trait

```rust
/// 工具风险等级
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RiskLevel {
    /// 只读操作，无副作用
    Safe,
    /// 网络请求，可能暴露信息
    Moderate,
    /// 写入文件或执行命令
    Dangerous,
}

/// 工具元数据（安全默认均为 fail-closed）
pub struct ToolMeta {
    pub risk_level: RiskLevel,
    pub needs_approval: bool,
    pub timeout_ms: u64,
    pub max_output_bytes: usize,
    pub is_concurrency_safe: bool,
    pub is_read_only: bool,
    pub is_destructive: bool,
}

impl Default for ToolMeta {
    fn default() -> Self {
        Self {
            risk_level: RiskLevel::Dangerous,   // 默认最高风险
            needs_approval: true,               // 默认需要用户确认
            timeout_ms: 120_000,                // 默认 2 分钟
            max_output_bytes: 100_000,           // 默认 100KB 截断
            is_concurrency_safe: false,         // 默认不能并发 → fail-closed
            is_read_only: false,                // 默认假设写入 → fail-closed
            is_destructive: false,
        }
    }
}

/// 工具执行上下文
pub struct ToolContext {
    pub workspace_root: PathBuf,
    pub allowed_paths: Vec<PathBuf>,
    pub env_vars: HashMap<String, String>,
    pub cancellation: CancellationToken,
}

/// 扩展后的 Tool trait
#[async_trait]
pub trait Tool: Send + Sync {
    // ── 身份标识 ──
    fn name(&self) -> String;
    fn description(&self) -> String;
    /// 3-10 个词的简短搜索提示，用于工具搜索引擎匹配
    fn search_hint(&self) -> &str { "" }
    /// 工具别名列表
    fn aliases(&self) -> &[&str] { &[] }

    // ── Schema 定义 ──
    fn parameters_schema(&self) -> Value;

    // ── 核心方法 ──
    async fn execute(&self, params: Value, ctx: &ToolContext) -> Result<ToolResult, String>;

    // ── 安全与权限 ──
    fn meta(&self) -> ToolMeta { ToolMeta::default() }
    fn is_enabled(&self) -> bool { true }
    fn is_read_only(&self, _params: &Value) -> bool { self.meta().is_read_only }
    fn is_concurrency_safe(&self, _params: &Value) -> bool { self.meta().is_concurrency_safe }
    fn is_destructive(&self, _params: &Value) -> bool { self.meta().is_destructive }

    /// 输入预校验（在权限检查之前执行）
    async fn validate_input(&self, _params: &Value, _ctx: &ToolContext)
        -> Result<(), String> { Ok(()) }

    /// 工具级权限检查（可覆盖默认权限逻辑）
    async fn check_permissions(&self, _params: &Value, _ctx: &ToolContext)
        -> PermissionResult { PermissionResult::Allow }

    /// 用户可读的操作描述（如 "编辑 src/main.rs"）
    fn user_facing_name(&self, params: &Value) -> String { self.name() }

    /// 结果最大字符数（可被具体工具覆盖）
    fn max_result_size_chars(&self) -> usize { self.meta().max_output_bytes as usize }

    /// 从工具路径中提取操作目标
    fn get_path(&self, _params: &Value) -> Option<String> { None }
}
```

**设计要点:**

- **fail-closed 默认值**: `ToolMeta::default()` 中 `is_concurrency_safe` 和 `is_read_only` 都默认 `false`。如果工具作者忘了声明，系统采用最保守假设。
- **工具级方法覆盖**: `is_read_only(input)`、`is_concurrency_safe(input)` 可基于具体输入参数判断（如 Bash 命令的语义分析），而非只看静态元数据。
- **验证前置**: `validate_input` 在权限检查之前执行，确保只对合法输入发权限请求。
- **权限委托**: `check_permissions` 让 BashTool 可以检查命令安全性，FileEditTool 可以验证路径范围，而非所有工具共用一套通用逻辑。

---

### ToolRegistry：三层条件注册

```rust
pub struct ToolRegistry {
    tools: HashMap<String, Arc<dyn Tool>>,
    /// 编译期功能标志
    compile_time_features: HashSet<String>,
    /// 运行时环境变量
    runtime_env: EnvConfig,
}

impl ToolRegistry {
    pub fn new() -> Self;
    pub fn with_defaults() -> Self;         // 注册所有内置工具

    pub fn register(&mut self, tool: Arc<dyn Tool>);
    pub fn get(&self, name: &str) -> Option<Arc<dyn Tool>>;

    /// 获取当前启用的工具列表（经过三层过滤）
    pub fn get_enabled_tools(&self) -> Vec<Arc<dyn Tool>> {
        self.tools.values()
            .filter(|t| t.is_enabled())              // 第三层: 运行时 isEnabled()
            .filter(|t| self.apply_deny_rules(t))    // deny rules 过滤
            .cloned()
            .collect()
    }

    /// 生成 LLM 工具定义列表
    pub fn definitions(&self) -> Vec<ToolDefinition>;

    /// 组装完整工具池（built-in + MCP）
    pub fn assemble_tool_pool(
        built_in: &[Arc<dyn Tool>],
        mcp_tools: &[Arc<dyn Tool>],
    ) -> Vec<Arc<dyn Tool>> {
        let mut sorted_builtin = built_in.to_vec();
        sorted_builtin.sort_by_key(|t| t.name());
        let mut sorted_mcp = mcp_tools.to_vec();
        sorted_mcp.sort_by_key(|t| t.name());

        // built-in 在前，MCP 在后，不混合排序
        // 原因: API 在 built-in 最后一个工具位置设置了 cache breakpoint
        // 如果 MCP 混入 built-in 区间，会导致所有下游 cache key 失效
        let mut pool = sorted_builtin;
        pool.extend(sorted_mcp);
        pool
    }

    fn apply_deny_rules(&self, tool: &Arc<dyn Tool>) -> bool;
}
```

**三层条件注册机制:**

```
编译期 cfg(feature = "...")  →  模块级 DCE，不编译进二进制
模块加载时 env var 检查      →  内部版/外部版区分（如 USER_TYPE=ant）
运行时 isEnabled()           →  动态 feature flag / 模型兼容性检查
       ↓
  deny rules 过滤            →  权限配置中禁用的工具
```

| 层级 | 时机 | 适用场景 |
|------|------|---------|
| 编译期 | `#[cfg(feature = "...")]` | 从同一份代码构建多版本（内部版/外部版） |
| 加载期 | 模块初始化时 `env var` | 区分内部用户（`USER_TYPE=ant`） |
| 运行时 | `is_enabled()` | GrowthBook feature flag / 模型兼容性（如 Haiku 不支持 tool_reference） |
| deny rules | `filter(deny_rules)` | 用户通过 `permissions.deny` 显式禁用 |

---

### ToolExecutor：并发安全分区 + 超时 + 截断

```rust
pub struct ToolExecutor {
    timeout_secs: u64,
    output_max_chars: usize,
}

/// 执行批次
struct Batch {
    is_concurrent: bool,
    calls: Vec<ToolCall>,
}

impl ToolExecutor {
    pub fn new(timeout_secs: u64, output_max_chars: usize) -> Self;

    /// 执行一批工具调用（自动分区并发/串行）
    pub async fn execute_batch(
        &self,
        registry: &ToolRegistry,
        calls: &[ToolCall],
        ctx: &ToolContext,
    ) -> Vec<ToolResult> {
        let batches = self.partition_tool_calls(registry, calls);
        let mut results = vec![];

        for batch in batches {
            if batch.is_concurrent {
                let batch_results = futures::future::join_all(
                    batch.calls.iter().map(|c| self.execute_one(registry, c, ctx))
                ).await;
                results.extend(batch_results);
            } else {
                for call in batch.calls {
                    results.push(self.execute_one(registry, &call, ctx).await);
                }
            }
        }
        results
    }

    /// 并发安全分区算法
    /// 将连续的 is_concurrency_safe 工具合并为一个并发 batch
    /// 不安全的工具各自独立为一个串行 batch
    fn partition_tool_calls(
        &self,
        registry: &ToolRegistry,
        calls: &[ToolCall],
    ) -> Vec<Batch> {
        calls.iter().fold(vec![], |mut acc: Vec<Batch>, call| {
            let tool = registry.get(&call.name);
            let is_safe = tool
                .and_then(|t| {
                    let parsed = serde_json::from_value(call.input.clone()).ok()?;
                    Some(t.is_concurrency_safe(&parsed))
                })
                .unwrap_or(false);  // 解析失败 → 保守处理（不并发）

            if is_safe && acc.last().map_or(false, |b| b.is_concurrent) {
                acc.last_mut().unwrap().calls.push(call.clone());
            } else {
                acc.push(Batch {
                    is_concurrent: is_safe,
                    calls: vec![call.clone()],
                });
            }
            acc
        })
    }

    async fn execute_one(
        &self,
        registry: &ToolRegistry,
        call: &ToolCall,
        ctx: &ToolContext,
    ) -> ToolResult {
        let tool = match registry.get(&call.name) {
            Some(t) => t,
            None => return ToolResult {
                success: false,
                output: String::new(),
                error: Some(format!("Unknown tool: {}", call.name)),
            },
        };

        // 1. 输入验证（Zod safeParse 等价操作）
        if let Err(e) = tool.validate_input(&call.input, ctx).await {
            return ToolResult::denied(e);
        }

        // 2. 超时执行
        let result = tokio::time::timeout(
            Duration::from_secs(self.timeout_secs),
            tool.execute(call.input.clone(), ctx),
        ).await;

        match result {
            Ok(Ok(output)) => self.truncate_output(output, tool.max_result_size_chars()),
            Ok(Err(e)) => ToolResult {
                success: false,
                output: String::new(),
                error: Some(e),
            },
            Err(_) => ToolResult {
                success: false,
                output: String::new(),
                error: Some(format!(
                    "Tool '{}' timed out after {}s",
                    tool.name(), self.timeout_secs,
                )),
            },
        }
    }

    /// 结构化截断：保留头部 + 尾部，中间插入截断信息
    fn truncate_output(&self, result: ToolResult, max_chars: usize) -> ToolResult {
        if result.output.chars().count() <= max_chars {
            return result;
        }

        let half = max_chars / 2;
        let head: String = result.output.chars().take(half).collect();
        let tail: String = result.output.chars().rev().take(half).collect::<String>()
            .chars().rev().collect();
        let skipped = result.output.chars().count() - max_chars;

        ToolResult {
            success: result.success,
            output: format!(
                "{}\n\n... [{} 字符被截断] ...\n\n{}",
                head, skipped, tail,
            ),
            error: result.error,
        }
    }
}
```

**`partition_tool_calls` 算法逻辑:**

1. 先用 `serde_json::from_value` 解析输入
2. 调用 `is_concurrency_safe(input)` 判断能否并发
3. 连续的安全工具合并为一个并发 `Batch`
4. 不安全的工具各自独立为一个串行 `Batch`
5. 解析失败 → `false`（保守处理，fail-closed）

**并发度:** 默认不限制，可通过 `Semaphore` 控制最大并发数：
```rust
// 可选：用 Semaphore 限制最大并发度
let semaphore = Arc::new(Semaphore::new(10));  // 最多 10 个工具并发
```

---

### ToolResult

```rust
pub struct ToolResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
    /// 截断信息（如果输出被截断）
    pub truncation: Option<TruncationInfo>,
}

pub struct TruncationInfo {
    pub original_bytes: usize,
    pub truncated_bytes: usize,
}
```

---

## 工具定义输出（给 LLM）

```rust
/// 给 LLM 的工具定义
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub parameters: Value,       // JSON Schema，序列化为 input_schema
}

impl ToolRegistry {
    pub fn definitions(&self) -> Vec<ToolDefinition> {
        self.tools
            .values()
            .map(|tool| ToolDefinition {
                name: tool.name(),
                description: tool.description(),
                parameters: tool.parameters_schema(),
            })
            .collect()
    }
}
```

### Bash 工具定义示例

```json
{
  "name": "bash",
  "description": "执行 Shell 命令。命令在项目工作空间中执行。避免交互式命令和长时间运行的进程。",
  "parameters": {
    "type": "object",
    "properties": {
      "command": {
        "type": "string",
        "description": "要执行的 Shell 命令"
      },
      "workdir": {
        "type": "string",
        "description": "可选，命令执行的工作目录，默认为项目根目录"
      }
    },
    "required": ["command"]
  }
}
```

### Edit 工具定义示例

```json
{
  "name": "edit_file",
  "description": "在文件中执行精确字符串替换。old_string 必须在文件中唯一匹配。",
  "parameters": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "要编辑的文件路径"
      },
      "old_string": {
        "type": "string",
        "description": "要替换的原字符串（必须唯一匹配）"
      },
      "new_string": {
        "type": "string",
        "description": "替换后的新字符串"
      }
    },
    "required": ["path", "old_string", "new_string"]
  }
}
```

---

## Agent Loop 中的使用

在 `agent_loop()` 中，工具执行流程（使用并发分区）：

```rust
// 每轮循环获取工具定义（chat 模式跳过）
let tools = if session.agent_type == "chat" {
    Vec::new()
} else {
    session.tool_registry.definitions()
};

// LLM 返回 tool_calls 后，使用并发分区执行
if !tool_calls.is_empty() {
    let results = executor.execute_batch(
        &session.tool_registry,
        &tool_calls,
        &tool_context,
    ).await;

    for result in results {
        emitter.emit_tool_result(result);
        session.add_tool_result(result);
    }
}
```

---

## 工具目录组织模式

每个工具遵循统一的目录结构（参照 Claude Code 实践）：

```
src-tauri/src/tools/
├── mod.rs                    # Tool trait + ToolRegistry + ToolExecutor
├── sandbox.rs               # SandboxConfig（路径白名单/命令黑名单）
│
├── file/
│   ├── mod.rs
│   ├── read_file.rs         # 读文件（支持行范围 + 图片/PDF）
│   ├── write_file.rs        # 写文件
│   ├── edit_file.rs         # 精确字符串替换
│   └── delete_file.rs       # 删除文件
│
├── search/
│   ├── mod.rs
│   ├── grep.rs              # 正则搜索代码内容
│   ├── glob.rs              # 按模式匹配文件名
│   └── list_dir.rs          # 列出目录结构
│
├── shell/
│   ├── mod.rs
│   ├── bash.rs              # Bash 执行（含命令语义分析 + AST 安全检查）
│   └── powershell.rs        # PowerShell 执行
│
├── web/
│   ├── mod.rs
│   ├── web_search.rs        # 搜索引擎请求
│   └── web_fetch.rs         # URL 获取 + HTML → Markdown
│
└── git/
    ├── mod.rs
    ├── git_diff.rs          # 查看暂存/未暂存 Diff
    └── git_log.rs           # 查看提交历史
```

**组织原则:**
- 工具名的常量定义在 `mod.rs` 中（避免循环依赖）
- 复杂工具（如 BashTool）可自由拆分子模块（安全分析、命令语义等）
- 沙箱配置独立于具体工具

---

## 沙箱控制

```rust
pub struct SandboxConfig {
    /// 允许的路径前缀（所有文件操作必须在此范围内）
    allowed_prefixes: Vec<PathBuf>,
    /// 禁止的命令列表
    blocked_commands: Vec<String>,
    /// 禁止的命令参数模式（正则）
    blocked_patterns: Vec<Regex>,
}

impl SandboxConfig {
    /// 验证工具调用是否在沙箱内（在 ToolExecutor.execute_one 中调用）
    fn validate(&self, tool_name: &str, params: &Value) -> Result<(), String> {
        match tool_name {
            "read_file" | "write_file" | "edit_file" => {
                let path = params["path"].as_str().ok_or("Missing path")?;
                self.check_path(path)?;
            }
            "bash" | "powershell" => {
                let command = params["command"].as_str().ok_or("Missing command")?;
                self.check_command(command)?;
            }
            _ => {} // grep/glob 等不需要特别沙箱
        }
        Ok(())
    }

    fn check_path(&self, path: &str) -> Result<(), String> {
        let resolved = canonicalize(path)?;
        let allowed = self.allowed_prefixes.iter()
            .any(|prefix| resolved.starts_with(prefix));

        if allowed {
            Ok(())
        } else {
            Err(format!("Path outside allowed workspace. Allowed: {:?}", self.allowed_prefixes))
        }
    }

    fn check_command(&self, command: &str) -> Result<(), String> {
        for blocked in &self.blocked_commands {
            if command.contains(blocked) {
                return Err(format!("Command '{}' is blocked", blocked));
            }
        }
        for pattern in &self.blocked_patterns {
            if pattern.is_match(command) {
                return Err(format!("Command matches blocked pattern: {}", pattern));
            }
        }
        Ok(())
    }
}
```

---

## 工具清单与优先级

### Phase 2 立即实现（P0）

| 工具 | 名称 | 风险 | `is_read_only` | `is_concurrency_safe` | 说明 |
|------|------|------|----------------|----------------------|------|
| 读取文件 | `read_file` | Safe | `true` | `true` | 按路径读文件，支持行范围 |
| 写入文件 | `write_file` | Dangerous | `false` | `false` | 创建/覆盖文件 |
| 编辑文件 | `edit_file` | Dangerous | `false` | `false` | 精确字符串替换 |
| 文本搜索 | `grep` | Safe | `true` | `true` | 正则搜索代码内容 |
| 文件匹配 | `glob` | Safe | `true` | `true` | 按模式匹配文件名 |
| 列出目录 | `list_directory` | Safe | `true` | `true` | 列出目录结构 |
| 执行命令 | `bash` / `powershell` | Dangerous | `false` | `false` | 执行 Shell 命令 |

### Phase 3+ 扩展（P1-P2）

| 工具 | 名称 | 风险 | 说明 |
|------|------|------|------|
| 网络搜索 | `web_search` | Moderate | 向搜索引擎发起请求 |
| 获取网页 | `web_fetch` | Moderate | 获取 URL 内容并转为 Markdown |
| 删除文件 | `delete_file` | Dangerous | 删除指定文件 |
| 查看 Diff | `git_diff` | Safe | 查看暂存/未暂存变更 |
| 查看日志 | `git_log` | Safe | 查看 Git 提交历史 |
| 读取 Linter | `read_lints` | Safe | 获取 LSP 诊断信息 |
| 运行测试 | `run_tests` | Moderate | 执行测试套件 |

---

## 可迁移的设计模式

### 模式 1：Builder + 安全默认（fail-closed）

工具作者只需关注自己的特殊逻辑，不可能忘记处理安全性：

```rust
impl Default for ToolMeta {
    fn default() -> Self {
        Self {
            risk_level: RiskLevel::Dangerous,
            needs_approval: true,
            is_concurrency_safe: false,    // 假设不安全
            is_read_only: false,           // 假设写入
            is_destructive: false,
            // ...
        }
    }
}
```

**适用场景:** 任何插件/中间件系统，特别是涉及安全敏感操作时。

### 模式 2：分层条件注册

将条件注册分为编译期（DCE）、模块加载期（env var）、运行时（`is_enabled()`）三层，形成过滤漏斗。编译期条件可以彻底删除代码路径，运行时条件可以响应动态配置。

```
编译期 cfg(feature) → 模块加载时 env check → 运行时 is_enabled() → 权限 deny rules
```

**适用场景:** 需要从同一份代码构建多个版本，且不同版本有不同功能集的项目。

### 模式 3：并发安全分区

通过 `is_concurrency_safe` 标记将批量操作分区为可并发组和必须串行组。默认 `false` 确保安全（fail-closed），显式声明 `true` 才启用并发。

- 连续的只读工具（如 `read_file` + `grep` + `glob`）→ 同一 batch，并发执行
- 写入工具（如 `write_file`）→ 独立 batch，串行执行
- 解析失败 → 保守处理为串行

**适用场景:** 任何需要批量执行异构任务的系统（如构建工具、数据管道、API 网关）。

---

## 与其它模块的协作

```
ToolExecutor
    │
    ├─ AgentRuntime::agent_loop()   → 调用方
    │     └─ 每轮循环解析 LLM 的 tool_calls，通过 execute_batch 批量执行
    │
    ├─ PermissionManager::check()   → 执行前的权限检查
    │     └─ 危险工具需要用户确认（先调 Tool.check_permissions()，再走通用权限）
    │
    ├─ ContextManager               → 工具结果裁剪后加入上下文
    │     └─ truncate_output() 防止 token 爆炸
    │
    └─ PromptEngine                 → 提供工具定义 (JSON Schema)
          └─ definitions() 供 Prompt 组装使用
```

---

## 当前限制与待实现

1. **无具体工具** — 需要逐个实现文件系统、搜索、Shell 等工具（Phase 2 P0）
2. **无沙箱控制** — `SandboxConfig` 路径白名单/命令黑名单未实现（Phase 3 规划）
3. **无权限检查** — 所有工具直接执行，不区分风险等级（Phase 3 规划）
4. **并行执行未分区** — 当前 `execute_batch` 尚未实现，多个 tool_use 逐个串行执行
5. **无工具输出上下文感知截断** — 简单字符截断可能破坏 JSON/代码结构（Phase 3 规划）
6. **无 MCP 集成** — `assemble_tool_pool` 中 MCP 部分预留但未实现

---

> 上一模块：[Prompt Cache](./prompt-cache.md) | 下一模块：[Agent System](./agent-system.md)
> 返回 [总览](../agent-architecture-design.md)
