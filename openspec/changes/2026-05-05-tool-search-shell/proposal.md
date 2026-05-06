## 依赖顺序

**上游依赖:**
- `tool-base-types` — 需要 ToolMeta、ToolContext、完整 Tool trait
- `tool-concurrent-executor` — 需要 execute_batch 框架就绪

**可并行:** `tool-file-ops` 与本提案无直接依赖，但均依赖 `tool-concurrent-executor`

**下游依赖:** `tool-sandbox` — 沙箱系统对 Shell 命令进行安全约束

---

## Why

Agent 需要搜索代码和理解项目结构。`grep`、`glob`、`list_directory` 是代码分析的核心工具。`bash` 和 `powershell` 让 Agent 能执行构建、测试、依赖管理等各种开发任务。

**注意:** PowerShell 实现遵循 Windows PowerShell 5.1 兼容性要求（无 `&&`/`||` 链式操作符、无三元/null-coalescing 操作符）。

## What Changes

- 新建 `src-tauri/src/tools/search/` 模块（grep, glob, list_directory）
- 新建 `src-tauri/src/tools/shell/` 模块（bash, powershell）
- `ToolRegistry::with_defaults()` 注册这 5 个工具

## Capabilities

### New Capabilities

- `tool-search-shell`: 代码搜索与 Shell 执行工具集

## Impact

- `src-tauri/src/tools/search/mod.rs` + `grep.rs` + `glob.rs` + `list_dir.rs`
- `src-tauri/src/tools/shell/mod.rs` + `bash.rs` + `powershell.rs`
- `src-tauri/src/tools/mod.rs` — with_defaults() 注册搜索和 Shell 工具
