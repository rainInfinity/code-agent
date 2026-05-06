# tool-base-types Specification

## ADDED Requirements

### Requirement: ToolMeta — 工具安全元数据

ToolMeta 定义工具的静态安全属性，遵循 fail-closed 默认原则。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `risk_level` | `RiskLevel` | `Dangerous` | 工具风险等级 |
| `needs_approval` | `bool` | `true` | 执行前是否需要用户确认 |
| `timeout_ms` | `u64` | `120000` | 工具执行超时（毫秒） |
| `max_output_bytes` | `usize` | `100000` | 输出最大字节数 |
| `is_concurrency_safe` | `bool` | `false` | 是否可与其他工具并发执行 |
| `is_read_only` | `bool` | `false` | 是否为只读操作 |
| `is_destructive` | `bool` | `false` | 是否为破坏性操作 |

`ToolMeta::default()` 返回最保守配置：Dangerous + needs_approval + 不可并发 + 非只读。

### Requirement: RiskLevel — 风险等级枚举

| 变体 | 含义 | 典型工具 |
|------|------|---------|
| `Safe` | 只读，无副作用 | read_file, grep |
| `Moderate` | 网络请求 | web_search |
| `Dangerous` | 写入/执行 | write_file, bash |

### Requirement: ToolContext — 工具执行上下文

ToolContext 封装工具执行所需的运行时环境信息。

| 字段 | 类型 | 说明 |
|------|------|------|
| `workspace_root` | `PathBuf` | 项目工作目录 |
| `allowed_paths` | `Vec<PathBuf>` | 沙箱路径白名单 |
| `env_vars` | `HashMap<String, String>` | 环境变量 |
| `cancellation` | `CancellationToken` | 取消令牌 |

### Requirement: PermissionResult — 权限检查结果

| 变体 | 含义 |
|------|------|
| `Allow` | 允许执行 |
| `Deny` | 禁止执行，返回拒绝原因 |
| `AskUser` | 需要用户确认，附带操作描述 |

### Requirement: Tool trait 扩展方法

在现有 5 个方法基础上，新增以下方法（全部带默认实现）：

安全与权限：
- `fn meta(&self) -> ToolMeta` — 返回工具安全元数据
- `fn is_read_only(&self, params: &Value) -> bool` — 基于输入判断是否只读
- `fn is_concurrency_safe(&self, params: &Value) -> bool` — 基于输入判断是否可并发
- `fn is_destructive(&self, params: &Value) -> bool` — 基于输入判断是否破坏性
- `fn is_enabled(&self) -> bool` — 运行时是否启用

校验与权限：
- `async fn validate_input(&self, params: &Value, ctx: &ToolContext) -> Result<(), String>` — 输入预校验
- `async fn check_permissions(&self, params: &Value, ctx: &ToolContext) -> PermissionResult` — 工具级权限检查

辅助方法：
- `fn search_hint(&self) -> &str` — 3-10 词的搜索提示
- `fn aliases(&self) -> &[&str]` — 工具别名列表
- `fn user_facing_name(&self, params: &Value) -> String` — 用户可读的操作描述
- `fn get_path(&self, params: &Value) -> Option<String>` — 从参数中提取操作目标路径
- `fn max_result_size_chars(&self) -> usize` — 结果最大字符数

约束：
- `execute()` 签名保持不变：`async fn execute(&self, params: Value) -> Result<ToolResult, String>`
- 所有新增方法均为 trait 默认方法，不强制实现者覆盖
- `ToolMeta::default()` 必须返回 fail-closed 配置
