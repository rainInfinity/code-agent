## 1. Data structures

- [x] 1.1 Define `Batch` in `tools/executor.rs` with `is_concurrent: bool` and `calls: Vec<ToolCall>`
- [x] 1.2 Confirm `ToolCall`, `ToolResult`, `ToolContext`, and `ToolRegistry` are available from the base tool types change

## 2. Concurrency-safe partitioning

- [x] 2.1 Implement `partition_tool_calls(&self, registry: &ToolRegistry, calls: &[ToolCall]) -> Vec<Batch>`
- [x] 2.2 Parse each tool call input JSON before checking concurrency safety
- [x] 2.3 Call `tool.is_concurrency_safe(&input)` and conservatively fall back to serial handling on parse failure
- [x] 2.4 Merge contiguous safe tools into concurrent batches and keep unsafe tools as standalone serial batches
- [x] 2.5 Add unit coverage for:
- [x] all safe tools producing a single concurrent batch
- [x] mixed sequences producing separate batches
- [x] empty input producing no batches
- [x] unknown or invalid cases falling back to serial handling

## 3. Structured truncation

- [x] 3.1 Implement `truncate_output(&self, result: ToolResult, max_chars: usize) -> ToolResult`
- [x] 3.2 Preserve the first and last halves of the output and insert a truncation marker in the middle
- [x] 3.3 Add unit coverage for:
- [x] outputs shorter than the limit remaining unchanged
- [x] long outputs preserving head and tail content
- [x] UTF-8 multi-byte characters being truncated safely

## 4. Single tool execution refactor

- [x] 4.1 Refactor the old `execute` path into `execute_one(&self, registry: &ToolRegistry, call: &ToolCall, ctx: &ToolContext) -> ToolResult`
- [x] 4.2 Run `validate_input` inside `execute_one`
- [x] 4.3 Return structured unknown-tool errors from `execute_one`
- [x] 4.4 Preserve timeout handling with `tokio::time::timeout`

## 5. Batch execution

- [x] 5.1 Implement `execute_batch(&self, registry, calls, ctx) -> Vec<ToolResult>`
- [x] 5.2 Use `futures::future::join_all` for concurrent batches
- [x] 5.3 Use serial iteration for non-concurrent batches
- [x] 5.4 Add focused batch execution tests

## 6. Agent loop integration

- [x] 6.1 Build `ToolContext` inside `agent_loop` from `AgentSession` workspace and cancellation state
- [x] 6.2 Replace the per-tool `executor.execute(tool, input)` loop with `executor.execute_batch(registry, tool_calls, ctx)`
- [x] 6.3 Remove direct `session.tool_registry.get()` handling from `agent_loop`

## 7. Verification

- [x] 7.1 Verify `0` tool calls still short-circuit to `Complete` without calling `execute_batch`
- [x] 7.2 Verify a single tool call still works through a one-item batch
- [x] 7.3 Verify multiple safe tools execute concurrently while preserving result order
- [x] 7.4 Verify timeout handling still works
- [x] 7.5 Verify cancellation context is threaded into tool execution
- [x] 7.6 Run `cargo test`
