## 依赖顺序

本提案是工具系统渐进式改造的第一步，**无上游依赖**。后续提案均依赖本提案完成。

**下游提案:** `tool-concurrent-executor`, `tool-registry-enhance`（可并行依赖本提案）

---

## Why

当前 Tool trait 过于简化——只有 5 个方法（`name`, `description`, `parameters_schema`, `execute`），缺少安全元数据（`ToolMeta`）、执行上下文（`ToolContext`）和工具级权限/校验方法。设计文档 [tool-system.md](../../docs/agent-architecture/tool-system.md) 已详细定义了完整的 trait 接口，但未落地到代码。

核心问题：
1. `execute()` 没有 `ToolContext` 参数，工具无法感知工作目录、沙箱路径、取消令牌等运行时信息
2. 无安全默认 — 缺少 `ToolMeta` 的 fail-closed 设计，新工具可能忘记声明安全属性
3. 无并发安全判断依据 — `ToolExecutor` 无法区分只读/写入工具
4. 无输入校验 — 参数校验在权限检查之前缺失

本次变更将 Tool trait 扩展到设计文档定义的完整接口，**所有新增方法均带默认实现，零破坏性**。

## What Changes

- 新建 `ToolMeta` 结构体（fail-closed 安全默认）
- 新建 `ToolContext` 结构体（workspace_root, allowed_paths, env_vars, cancellation）
- 新建 `PermissionResult` 枚举（Allow / Deny / AskUser）
- 扩展 `Tool` trait 新增 10 个带默认实现的方法
- `models.rs` 新增对应类型导出

## Capabilities

### New Capabilities

- `tool-base-types`: ToolMeta 安全元数据、ToolContext 执行上下文、PermissionResult 权限结果、完整 Tool trait 接口

### Modified Capabilities

- 无现有 capability 变更

## Impact

- `src-tauri/src/tools/mod.rs` — 扩展 Tool trait，新增 ToolMeta, ToolContext, PermissionResult, RiskLevel
- `src-tauri/src/models.rs` — 导出新类型
