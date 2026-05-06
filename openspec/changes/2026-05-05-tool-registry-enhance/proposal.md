## 依赖顺序

**上游依赖:** `tool-base-types` — 需要 `ToolMeta::is_enabled()` 的默认实现

**可并行:** `tool-concurrent-executor` 与本提案无直接依赖，可并行开发

**下游依赖:** 无特定下游依赖，所有后续工具实现提案均受益于 Registry 增强

---

## Why

当前 `ToolRegistry` 只有基础 register/get/definitions 三个方法，缺少设计文档定义的核心能力：

1. **无三层条件注册** — 所有注册的工具都直接暴露给 LLM，无法按编译期/环境/运行时条件过滤
2. **无 deny rules** — 用户无法通过配置禁用特定工具
3. **无 MCP 工具池组装** — `assemble_tool_pool` 未实现，built-in 和 MCP 工具无法正确排序

设计文档 [tool-system.md](../../docs/agent-architecture/tool-system.md) 定义了完整的三层注册机制和工具池组装逻辑。

## What Changes

- `ToolRegistry` 新增 `get_enabled_tools()` 方法（三层过滤）
- `ToolRegistry` 新增 `assemble_tool_pool()` 静态方法
- `ToolRegistry` 新增 deny rules 过滤机制
- `definitions()` 改为调用 `get_enabled_tools()` 而非直接遍历全部工具

## Capabilities

### New Capabilities

- `tool-registry-enhance`: 三层条件注册、deny rules 过滤、工具池组装

### Modified Capabilities

- `tool-system` (现有): ToolRegistry 增强，不改变现有 API 签名

## Impact

- `src-tauri/src/tools/mod.rs` — ToolRegistry 新增方法
