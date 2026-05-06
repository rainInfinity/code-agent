## 设计决策

### 1. partition_tool_calls 算法

```
输入: [tool_call_A, tool_call_B, tool_call_C, tool_call_D]
       is_safe(T)         is_safe(F)    is_safe(T)    is_safe(T)

输出: [Batch { concurrent: true,  calls: [A] },
       Batch { concurrent: false, calls: [B] },
       Batch { concurrent: true,  calls: [C, D] }]
```

算法逻辑：
1. 对每个 tool_call 用 `serde_json::from_value` 解析 input
2. 解析成功 → 调用 `tool.is_concurrency_safe(&input)` 判断
3. 解析失败 → 保守处理为 `false`（不可并发）
4. 连续的可安全工具合并到同一个并发 `Batch`
5. 不安全的工具各自独立为一个串行 `Batch`

关键边界：
- 三个连续安全工具 → 同一个并发 batch
- 安全 → 不安全 → 安全 → 三个 batch，其中第1和第3各自并发

### 2. execute_batch 执行模型

```
for batch in batches:
    if batch.is_concurrent:
        join_all(batch.calls.map(execute_one))  // 并发执行
    else:
        for call in batch.calls:
            execute_one(call)                    // 串行执行
```

### 3. 并发度控制

第一版不引入 Semaphore 限制，让所有安全工具自由并发。后续如遇到 API 限流或资源耗尽，再通过 `tokio::sync::Semaphore` 加入并发度上限。

### 4. execute_one 的执行步骤

```
execute_one(tool, call, ctx):
    1. ToolRegistry::get(name) → 未找到返回 error result
    2. tool.validate_input(input, ctx) → 校验失败返回 denied result
    3. tokio::time::timeout(timeout, tool.execute(input)) → 超时返回 error
    4. truncate_output(result, tool.max_result_size_chars()) → 结构化截断
```

注意：`check_permissions` 在本阶段不调用——权限系统属于 Phase 3，由 `AgentRuntime` 层在调用 `execute_batch` 之前处理。

### 5. ToolContext 构造

`ToolExecutor` 新增 `execute_batch` 时接收从 `AgentSession` 提取的信息构造 `ToolContext`：

```rust
let ctx = ToolContext {
    workspace_root: session.work_dir.clone().unwrap_or_default().into(),
    allowed_paths: vec![],      // Proposal 6 (Sandbox) 前为空
    env_vars: HashMap::new(),   // 后续扩展
    cancellation: session.cancel_token.clone(),
};
```

### 6. 结构化截断

```
原始输出 (150KB) → 保留头部 50KB + 截断信息 + 保留尾部 50KB
```

```rust
fn truncate_output(result: ToolResult, max_chars: usize) -> ToolResult {
    if output.chars().count() <= max_chars { return result; }
    
    let half = max_chars / 2;
    let head = output.chars().take(half).collect();
    let tail = output.chars().rev().take(half).collect().reverse();
    let skipped = total_chars - max_chars;
    
    format!("{head}\n\n... [{skipped} 字符被截断] ...\n\n{tail}")
}
```

### 7. agent_loop 中的集成变更

```rust
// Before (逐个串行):
for tool_call in tool_calls {
    let result = match session.tool_registry.get(&tool_call.name) {
        Some(tool) => executor.execute(tool, tool_call.input.clone()).await,
        None => ToolResult { /* error */ },
    };
    // emit + add to context
}

// After (批量执行):
let ctx = ToolContext { /* from session */ };
let results = executor.execute_batch(
    &session.tool_registry,
    &tool_calls,
    &ctx,
).await;
for result in results {
    // emit + add to context
}
```
