## 依赖顺序

**上游依赖:**
- `tool-base-types` — 需要 ToolContext（allowed_paths 字段在沙箱中首次被实际使用）
- `tool-concurrent-executor` — 需要在 execute_one 中集成沙箱检查
- `tool-file-ops` + `tool-search-shell` — 沙箱对文件工具和 Shell 工具施加约束

**无下游依赖** — 这是工具系统 Phase 2 的最后一个提案

---

## Why

当前所有工具执行无路径/命令约束，Agent 理论上可以访问文件系统任何位置、执行任何命令。需要实现沙箱控制：

1. **路径白名单** — 文件操作限定在项目工作目录内
2. **命令黑名单** — 阻止危险的 Shell 命令（如 `rm -rf /`）
3. **命令模式过滤** — 正则匹配阻止危险命令参数组合

## What Changes

- 新建 `src-tauri/src/tools/sandbox.rs` — SandboxConfig 实现
- `ToolExecutor::execute_one` 在 `validate_input` 之后、`execute` 之前调用沙箱检查
- 文件工具中实际消费 `ToolContext::allowed_paths`

## Capabilities

### New Capabilities

- `tool-sandbox`: 文件路径白名单 + 命令黑名单 + 命令模式正则过滤

## Impact

- `src-tauri/src/tools/sandbox.rs` — 新文件
- `src-tauri/src/tools/mod.rs` — 声明 sandbox 模块
- `src-tauri/src/tools/executor.rs` — execute_one 集成 sandbox check
