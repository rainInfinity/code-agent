# Tool System — 工具系统

> 返回 [总览](./agent-architecture-design.md) | 上一模块：[Prompt Cache](./prompt-cache.md) | 下一模块：[Agent System](./agent-system.md)

---

## 概述

Tool System 定义和执行 Agent 可用的所有工具。它在现有 `Tool` trait（[src-tauri/src/tools.rs](../../src-tauri/src/tools.rs)）基础上扩展，加入风险分级、沙箱控制、超时管理和并行执行能力。

## 当前状态

项目中已有工具系统雏形：

- **`Tool` trait** — 定义了 `name()`、`description()`、`parameters_schema()`、`execute()` 接口
- **`ToolRegistry`** — 工具注册和查找
- **`EchoTool`** — 测试用 Echo 工具

**缺失：**
- 未集成到 `commands::send_message` 对话流程
- 没有沙箱、超时、权限等安全机制
- 没有实际开发工具（文件、Shell、搜索等）

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Tool System                             │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ │
│  │  ToolRegistry  │  │ Tool Executor  │  │  Sandbox      │ │
│  │  (注册/查找)   │  │ (执行/超时/    │  │  (路径白名单) │ │
│  │                │  │  结果截断)     │  │               │ │
│  └────────────────┘  └────────────────┘  └───────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                   工具清单                              │ │
│  │                                                        │ │
│  │  文件工具      搜索工具       系统工具      代码工具    │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │ │
│  │  │ReadFile  │ │Grep      │ │Bash      │ │LSP       │ │ │
│  │  │WriteFile │ │Glob      │ │PowerShell│ │Formatter │ │ │
│  │  │EditFile  │ │ListDir   │ │Process   │ │Linter    │ │ │
│  │  │DeleteFile│ │WebSearch │ │Git       │ │Test      │ │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 核心接口

### 扩展的 Tool trait

```rust
/// 工具风险等级
#[derive(Debug, Clone, PartialEq, Eq)]
enum RiskLevel {
    /// 只读操作，无副作用
    Safe,
    /// 网络请求，可能暴露信息
    Moderate,
    /// 写入文件或执行命令
    Dangerous,
}

/// 工具元数据
struct ToolMeta {
    /// 风险等级
    risk_level: RiskLevel,
    /// 是否需要用户确认
    needs_approval: bool,
    /// 执行超时（毫秒）
    timeout_ms: u64,
    /// 最大输出大小（字节），超出截断
    max_output_bytes: usize,
}

/// 工具执行上下文
struct ToolContext {
    /// 工作空间根目录
    workspace_root: PathBuf,
    /// 允许访问的路径白名单
    allowed_paths: Vec<PathBuf>,
    /// 可用的环境变量
    env_vars: HashMap<String, String>,
    /// 取消令牌
    cancellation: CancellationToken,
}

/// 扩展后的 Tool trait
#[async_trait]
trait Tool: Send + Sync {
    /// 唯一名称
    fn name(&self) -> &str;

    /// 人类可读描述
    fn description(&self) -> &str;

    /// 参数 JSON Schema
    fn parameters_schema(&self) -> Value;

    /// 工具元数据
    fn meta(&self) -> ToolMeta;

    /// 执行工具
    async fn execute(
        &self,
        params: Value,
        ctx: &ToolContext,
    ) -> Result<ToolResult, String>;
}
```

### ToolExecutor

```rust
struct ToolExecutor {
    registry: Arc<ToolRegistry>,
    sandbox: SandboxConfig,
    default_context: ToolContext,
}

impl ToolExecutor {
    /// 执行指定工具
    async fn execute(
        &self,
        tool_name: &str,
        params: Value,
    ) -> ToolResult {
        let tool = match self.registry.get(tool_name) {
            Some(t) => t,
            None => return ToolResult {
                success: false,
                output: String::new(),
                error: Some(format!("Unknown tool: {}", tool_name)),
            },
        };

        let meta = tool.meta();

        // 1. Sandbox 验证
        if let Err(e) = self.sandbox.validate(tool_name, &params) {
            return ToolResult::denied(e);
        }

        // 2. 执行（带超时）
        let result = tokio::time::timeout(
            Duration::from_millis(meta.timeout_ms),
            tool.execute(params, &self.default_context),
        ).await;

        match result {
            Ok(Ok(output)) => {
                // 3. 截断过长输出
                self.truncate_output(output, meta.max_output_bytes)
            }
            Ok(Err(e)) => ToolResult {
                success: false,
                output: String::new(),
                error: Some(e),
            },
            Err(_) => ToolResult {
                success: false,
                output: String::new(),
                error: Some(format!(
                    "Tool '{}' timed out after {}ms",
                    tool_name, meta.timeout_ms
                )),
            },
        }
    }

    fn truncate_output(&self, result: ToolResult, max_bytes: usize) -> ToolResult {
        if result.output.len() <= max_bytes {
            return result;
        }

        let half = max_bytes / 2;
        let head = &result.output[..half];
        let tail_start = result.output.len().saturating_sub(half);
        let tail = &result.output[tail_start..];

        ToolResult {
            success: result.success,
            output: format!(
                "{}\n\n... [{} 字节被截断] ...\n\n{}",
                head,
                result.output.len() - max_bytes,
                tail
            ),
            error: result.error,
        }
    }
}
```

## 沙箱控制

```rust
struct SandboxConfig {
    /// 允许的路径前缀（所有文件操作必须在此范围内）
    allowed_prefixes: Vec<PathBuf>,
    /// 禁止的命令列表
    blocked_commands: Vec<String>,
    /// 禁止的命令参数模式（正则）
    blocked_patterns: Vec<Regex>,
}

impl SandboxConfig {
    /// 验证工具调用是否在沙箱内
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
            Err(format!(
                "Path '{}' is outside allowed workspace. Allowed: {:?}",
                path, self.allowed_prefixes
            ))
        }
    }
}
```

## 工具清单

### Phase 1 必需（P0）

| 工具 | 名称 | 风险 | 说明 |
|------|------|------|------|
| 读取文件 | `read_file` | Safe | 按路径读文件，支持行范围 |
| 写入文件 | `write_file` | Dangerous | 创建/覆盖文件 |
| 编辑文件 | `edit_file` | Dangerous | 精确字符串替换（类似 Sed） |
| 文本搜索 | `grep` | Safe | 正则搜索代码内容 |
| 文件匹配 | `glob` | Safe | 按模式匹配文件名 |
| 列出目录 | `list_directory` | Safe | 列出目录结构 |
| 执行命令 | `bash` / `powershell` | Dangerous | 执行 Shell 命令 |

### Phase 2 扩展（P1）

| 工具 | 名称 | 风险 | 说明 |
|------|------|------|------|
| 网络搜索 | `web_search` | Moderate | 向搜索引擎发起请求 |
| 获取网页 | `web_fetch` | Moderate | 获取 URL 内容并转为 Markdown |
| 删除文件 | `delete_file` | Dangerous | 删除指定文件 |
| 查看 Diff | `git_diff` | Safe | 查看暂存/未暂存变更 |
| 查看日志 | `git_log` | Safe | 查看 Git 提交历史 |

### Phase 3 高级（P2）

| 工具 | 名称 | 风险 | 说明 |
|------|------|------|------|
| 读取 Linter | `read_lints` | Safe | 获取 LSP 诊断信息 |
| 运行测试 | `run_tests` | Moderate | 执行测试套件 |
| 格式化代码 | `format_code` | Moderate | 代码格式化 |
| LSP 跳转 | `lsp_goto_def` | Safe | 跳转到定义 |
| LSP 引用 | `lsp_references` | Safe | 查找引用 |

## 工具定义输出（给 LLM）

```rust
impl ToolRegistry {
    /// 生成给 LLM 的工具定义列表
    fn definitions_for_llm(&self) -> Vec<ToolDefinition> {
        self.tools
            .values()
            .map(|tool| ToolDefinition {
                name: tool.name().to_string(),
                description: tool.description().to_string(),
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
  "description": "执行 Shell 命令。命令在项目工作空间中执行。避免使用交互式命令和长时间运行的进程。",
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

## 并行工具执行

当 LLM 返回多个独立的 tool_use 时，可以并行执行：

```rust
impl ToolExecutor {
    async fn execute_parallel(
        &self,
        tool_calls: &[ToolCall],
    ) -> Vec<ToolResult> {
        let futures: Vec<_> = tool_calls
            .iter()
            .map(|tc| self.execute(&tc.name, &tc.input))
            .collect();

        futures::future::join_all(futures).await
    }
}
```

并行执行条件：工具调用之间没有数据依赖（不依赖其他工具的输出）。

## 与现有代码的整合

```
现有 tools.rs:
  Tool trait          → 保留，扩展 meta() 方法
  ToolRegistry        → 保留，增加 definitions_for_llm()
  EchoTool            → 保留，用于测试

需改造:
  commands::send_message → 改为委托给 AgentRuntime（间接使用 ToolExecutor）
  models::ToolResult     → 已有，完全可用
  models::ToolDefinition → 已有，完全可用
```

## 与其它模块的协作

```
ToolExecutor
    │
    ├─ AgentRuntime::agent_loop()   → 调用方
    │     └─ 每轮循环解析 LLM 的 tool_calls，逐个调用 ToolExecutor
    │
    ├─ PermissionManager::check()   → 执行前的权限检查
    │     └─ 危险工具需要用户确认
    │
    ├─ ContextManager               → 工具结果裁剪后加入上下文
    │     └─ truncate_output() 防止 token 爆炸
    │
    └─ PromptEngine                 → 提供工具定义 (JSON Schema)
          └─ definitions_for_llm() 供 Prompt 组装使用
```

---

> 上一模块：[Prompt Cache](./prompt-cache.md) | 下一模块：[Agent System](./agent-system.md)
> 返回 [总览](./agent-architecture-design.md)
