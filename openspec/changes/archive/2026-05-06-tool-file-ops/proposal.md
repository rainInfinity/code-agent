## 依赖顺序

**上游依赖:**
- `tool-base-types` — 需要 ToolMeta、ToolContext、完整 Tool trait
- `tool-concurrent-executor` — 需要 execute_batch 框架就绪

**下游依赖:** `tool-sandbox` — 沙箱系统在文件工具之后实现，对已有的文件路径进行约束

**可并行:** `tool-search-shell` 与本提案无直接依赖，但均依赖 `tool-concurrent-executor`

---

## Why

当前 Agent 完全没有文件操作能力——`ToolRegistry::with_defaults()` 返回空注册表，Agent 无法读取用户项目文件、编写代码、修改文件。这是整个 Agent 系统最大的功能空白。

文件系统工具是最核心的工具集：Agent 需要读取代码才能分析问题，需要编辑文件才能修复 bug/添加功能。

本次实现 `read_file`、`write_file`、`edit_file` 三个最基础的文件工具。

## What Changes

- 新建 `src-tauri/src/tools/file/` 模块
- 实现 `ReadFileTool`：读文件，支持行范围、图片/PDF 检测
- 实现 `WriteFileTool`：创建/覆盖文件
- 实现 `EditFileTool`：精确字符串替换（old_string 必须唯一匹配）
- `ToolRegistry::with_defaults()` 注册这三个工具

## Capabilities

### New Capabilities

- `tool-file-ops`: 文件读写编辑工具集

## Impact

- `src-tauri/src/tools/file/mod.rs` — 新模块入口 + 工具常量
- `src-tauri/src/tools/file/read_file.rs` — ReadFileTool
- `src-tauri/src/tools/file/write_file.rs` — WriteFileTool
- `src-tauri/src/tools/file/edit_file.rs` — EditFileTool
- `src-tauri/src/tools/mod.rs` — with_defaults() 注册文件工具
