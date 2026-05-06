# tool-concurrent-executor Specification

## ADDED Requirements

### Requirement: execute_batch — 批量工具执行

```rust
pub async fn execute_batch(
    &self,
    registry: &ToolRegistry,
    calls: &[ToolCall],
    ctx: &ToolContext,
) -> Vec<ToolResult>
```

行为：
1. 调用 `partition_tool_calls(registry, calls)` 将 tool_calls 分为多个 Batch
2. 对每个 Batch：
   - 若 `is_concurrent == true`：使用 `futures::future::join_all` 并发执行所有调用
   - 若 `is_concurrent == false`：逐个串行执行
3. 返回按原始顺序排列的结果列表

约束：
- 输入 `calls` 为空时返回空 `Vec`
- 返回的 `ToolResult` 数量必须等于输入的 `calls` 数量
- 执行顺序：batch 之间串行，batch 内部按标志决定并发/串行

### Requirement: partition_tool_calls — 并发安全分区

```rust
fn partition_tool_calls(
    &self,
    registry: &ToolRegistry,
    calls: &[ToolCall],
) -> Vec<Batch>
```

分区规则：
1. 对每个 tool_call 解析 input JSON
2. 从 registry 查找对应 tool，调用 `tool.is_concurrency_safe(&input)`
3. 解析失败 → 保守处理为不可并发
4. 工具未注册 → 保守处理为不可并发（后续 execute_one 中报 Unknown tool）
5. 连续的可并发工具合并到同一个 `Batch { is_concurrent: true }`
6. 不可并发的工具各自独立为 `Batch { is_concurrent: false }`

```rust
struct Batch {
    is_concurrent: bool,
    calls: Vec<ToolCall>,
}
```

### Requirement: execute_one — 单工具执行

步骤：
1. 从 registry 查找 tool，未找到 → 返回 `ToolResult { success: false, error: "Unknown tool: {name}" }`
2. 调用 `tool.validate_input(&call.input, ctx)`，校验失败 → 返回 `ToolResult { success: false, error: "Validation: {msg}" }`
3. `tokio::time::timeout` 包裹 `tool.execute(input)`，超时 → 返回 `ToolResult { success: false, error: "Tool '{name}' timed out after {s}s" }`
4. 执行成功 → `truncate_output(result, tool.max_result_size_chars())`

约束：
- `validate_input` 失败不应触发权限弹窗——那属于权限系统范畴
- 超时时间取自 `self.timeout_secs`，不依赖单工具 meta 中的 timeout_ms（后续扩展点）

### Requirement: truncate_output — 结构化截断

```rust
fn truncate_output(&self, result: ToolResult, max_chars: usize) -> ToolResult
```

行为：
- 若 `output.chars().count() <= max_chars`：原样返回
- 否则：保留前 `max_chars/2` 字符 + 截断提示行 + 后 `max_chars/2` 字符
- 截断提示格式：`\n\n... [{N} 字符被截断] ...\n\n`

约束：
- 字符计数（`.chars().count()`）而非字节计数，确保 UTF-8 安全
- 截断后仍需保留 `success` 和 `error` 字段原值

### Requirement: Agent Loop 集成

变更前：
```rust
for tool_call in tool_calls {
    let result = match session.tool_registry.get(&tool_call.name) {
        Some(tool) => executor.execute(tool, tool_call.input.clone()).await,
        None => ToolResult { /* error */ },
    };
    // emit + add to context
}
```

变更后：
```rust
let ctx = ToolContext { /* from session */ };
let results = executor.execute_batch(
    &session.tool_registry,
    &tool_calls,
    &ctx,
).await;
for (tool_call, result) in tool_calls.iter().zip(results) {
    // emit + add to context (逻辑不变)
}
```

约束：
- `agent_loop` 中不再直接调用 `executor.execute(tool, input)`，统一使用 `execute_batch`
- 空的 tool_calls 列表 → 不调用 `execute_batch`，直接返回 Complete
