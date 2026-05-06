## 依赖顺序

**上游依赖:** `tool-base-types` — 需要 ToolMeta（is_concurrency_safe 判断依据）、ToolContext（执行上下文构造）

**下游依赖:** `tool-file-ops`, `tool-search-shell` — 具体工具实现依赖并发执行框架就绪

**可并行:** `tool-registry-enhance` 与本提案无直接依赖，可并行开发

---

## Why

当前 `ToolExecutor` 只有单工具执行能力（`execute(tool, input)`），`agent_loop` 中逐个串行执行 tool_calls：

```rust
for tool_call in tool_calls {
    let result = executor.execute(tool, tool_call.input).await;
    // ...
}
```

这导致两个问题：
1. **性能浪费** — LLM 返回的多个只读工具调用（如同时 read_file + grep）本可并发执行
2. **输出截断简陋** — 当前只是简单头部截断 + `"...(truncated)"`，破坏代码/JSON 结构

设计文档 [tool-system.md](../../docs/agent-architecture/tool-system.md) 定义了 `execute_batch()` + `partition_tool_calls()` 并发安全分区算法和结构化截断，本次实现。

## What Changes

- `ToolExecutor` 新增 `execute_batch()` 方法替代单工具执行
- 实现 `partition_tool_calls()` 并发安全分区算法
- 实现结构化输出截断（头尾保留 + 中间截断信息）
- `agent_loop` 中工具执行从串行 for 循环改为调用 `execute_batch()`
- `ToolExecutor` 内部构造 `ToolContext` 并注入（proposal 1 定义的类型在此首次使用）

## Capabilities

### New Capabilities

- `tool-concurrent-executor`: 并发安全分区算法 + 批量工具执行 + 结构化输出截断

### Modified Capabilities

- 无现有 capability 变更

## Impact

- `src-tauri/src/tools/executor.rs` — 新增 execute_batch, partition_tool_calls, truncate_output
- `src-tauri/src/agent/runtime.rs` — agent_loop 中工具执行改用 execute_batch
