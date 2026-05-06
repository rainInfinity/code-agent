# tool-search-shell Specification

## ADDED Requirements

### Requirement: grep — 正则搜索代码内容

| 属性 | 值 |
|------|-----|
| `name` | `"grep"` |
| `risk_level` | `Safe` |
| `is_read_only` | `true` |
| `is_concurrency_safe` | `true` |
| `needs_approval` | `false` |

参数：

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `pattern` | `string` | 是 | 正则表达式 |
| `path` | `string` | 否 | 搜索目录，默认项目根目录 |
| `glob` | `string` | 否 | 文件名过滤（如 `"*.rs"`） |
| `output_mode` | `string` | 否 | 输出模式：content/files_with_matches/count |
| `head_limit` | `integer` | 否 | 结果数量上限 |
| `-i` | `boolean` | 否 | 大小写不敏感 |
| `multiline` | `boolean` | 否 | 多行匹配模式 |

行为：
- 使用 ripgrep 语义（正则、glob 过滤、输出模式）
- 默认 `output_mode="files_with_matches"`
- 默认 `head_limit=250`
- 支持 `-A`/`-B`/`-C` 上下文行数（后续扩展）

search_hint: `"search code for regex pattern with ripgrep semantics"`
aliases: `["search", "rg"]`

### Requirement: glob — 按模式匹配文件名

| 属性 | 值 |
|------|-----|
| `name` | `"glob"` |
| `risk_level` | `Safe` |
| `is_read_only` | `true` |
| `is_concurrency_safe` | `true` |
| `needs_approval` | `false` |

参数：

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `pattern` | `string` | 是 | Glob 模式（如 `"**/*.rs"`） |
| `path` | `string` | 否 | 搜索目录，默认项目根目录 |

行为：
- 返回匹配文件的路径列表，按修改时间排序
- 使用 `glob` crate 或标准库遍历

search_hint: `"find files matching glob pattern by name"`
aliases: `["find"]`

### Requirement: list_directory — 列出目录结构

| 属性 | 值 |
|------|-----|
| `name` | `"list_directory"` |
| `risk_level` | `Safe` |
| `is_read_only` | `true` |
| `is_concurrency_safe` | `true` |
| `needs_approval` | `false` |

参数：

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `path` | `string` | 否 | 目录路径，默认项目根目录 |
| `depth` | `integer` | 否 | 递归深度，默认 2 |
| `offset` | `integer` | 否 | 分页偏移 |
| `limit` | `integer` | 否 | 返回条目上限，默认 200 |

行为：
- 返回目录树结构（文件/目录、大小、修改时间）
- 默认深度 2 层
- 自动跳过 `.git`、`node_modules`、`target` 等常见忽略目录

search_hint: `"list directory contents with tree structure"`
aliases: `["ls", "dir"]`

### Requirement: bash — 执行 Bash 命令

| 属性 | 值 |
|------|-----|
| `name` | `"bash"` |
| `risk_level` | `Dangerous` |
| `is_read_only` | `false` |
| `is_concurrency_safe` | `false` |
| `needs_approval` | `true` |
| `is_destructive` | `false`（默认，具体命令可能改变） |
| `timeout_ms` | `120000` |

参数：

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `command` | `string` | 是 | 要执行的 Shell 命令 |
| `workdir` | `string` | 否 | 工作目录，默认项目根目录 |
| `timeout` | `integer` | 否 | 超时（毫秒），默认 120000 |

行为：
- 在项目工作目录中执行命令
- 返回 stdout + stderr + exit code
- 超时后强制终止进程

`is_read_only(input)` 覆盖：基于命令语义分析返回——纯读命令（`cat`、`ls`、`git status`、`grep` 等）返回 `true`。
`check_permissions` 覆盖：命令安全检查——拒绝 `rm -rf /`、`chmod 777` 等危险模式。
search_hint: `"execute shell command in project workspace"`

### Requirement: powershell — 执行 PowerShell 命令

与 `bash` 相同的元数据和安全属性，区别：
- 使用 PowerShell 语法（Windows PowerShell 5.1 兼容）
- 命令分析器适配 PowerShell 语法（`Remove-Item`、`Stop-Process` 等）
- 文档说明 PowerShell 5.1 限制（无 `&&`/`||`、无三元操作符）

search_hint: `"execute PowerShell command in project workspace"`
