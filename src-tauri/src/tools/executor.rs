use crate::llm::ToolCall;
use crate::models::ToolResult;
use crate::tools::file::{EDIT_FILE_TOOL_NAME, READ_FILE_TOOL_NAME, WRITE_FILE_TOOL_NAME};
use crate::tools::sandbox::SandboxConfig;
use crate::tools::{workspace_root, ToolContext, ToolRegistry};
use futures_util::future::join_all;
use serde_json::Value;
use std::path::PathBuf;
use std::time::Duration;
use tokio::time::timeout;

#[derive(Debug, Clone)]
struct Batch {
    is_concurrent: bool,
    calls: Vec<ToolCall>,
}

pub struct ToolExecutor {
    timeout_secs: u64,
    output_max_chars: usize,
    sandbox: Option<SandboxConfig>,
}

impl ToolExecutor {
    pub fn new(timeout_secs: u64, output_max_chars: usize) -> Self {
        Self {
            timeout_secs,
            output_max_chars,
            sandbox: Some(SandboxConfig::default()),
        }
    }

    pub fn with_sandbox(mut self, sandbox: Option<SandboxConfig>) -> Self {
        self.sandbox = sandbox;
        self
    }

    pub async fn execute_batch(
        &self,
        registry: &ToolRegistry,
        calls: &[ToolCall],
        ctx: &ToolContext,
    ) -> Vec<ToolResult> {
        let batches = self.partition_tool_calls(registry, calls);
        let mut results = Vec::with_capacity(calls.len());

        for batch in batches {
            if batch.is_concurrent {
                results.extend(
                    join_all(
                        batch
                            .calls
                            .iter()
                            .map(|call| self.execute_one(registry, call, ctx)),
                    )
                    .await,
                );
            } else {
                for call in &batch.calls {
                    results.push(self.execute_one(registry, call, ctx).await);
                }
            }
        }

        results
    }

    fn partition_tool_calls(&self, registry: &ToolRegistry, calls: &[ToolCall]) -> Vec<Batch> {
        let mut batches = Vec::new();
        let mut concurrent_calls = Vec::new();

        for call in calls {
            let is_concurrency_safe = registry
                .get(&call.name)
                .and_then(|tool| {
                    serde_json::from_value::<Value>(call.input.clone())
                        .ok()
                        .map(|input| tool.is_concurrency_safe(&input))
                })
                .unwrap_or(false);

            if is_concurrency_safe {
                concurrent_calls.push(call.clone());
                continue;
            }

            if !concurrent_calls.is_empty() {
                batches.push(Batch {
                    is_concurrent: true,
                    calls: std::mem::take(&mut concurrent_calls),
                });
            }

            batches.push(Batch {
                is_concurrent: false,
                calls: vec![call.clone()],
            });
        }

        if !concurrent_calls.is_empty() {
            batches.push(Batch {
                is_concurrent: true,
                calls: concurrent_calls,
            });
        }

        batches
    }

    async fn execute_one(
        &self,
        registry: &ToolRegistry,
        call: &ToolCall,
        ctx: &ToolContext,
    ) -> ToolResult {
        let Some(tool) = registry.get(&call.name) else {
            return ToolResult {
                success: false,
                output: String::new(),
                error: Some(format!("Unknown tool: {}", call.name)),
            };
        };

        if let Err(error) = tool.validate_input(&call.input, ctx).await {
            return ToolResult {
                success: false,
                output: String::new(),
                error: Some(format_validation_error(&call.name, &call.input, &error)),
            };
        }

        let sandbox_input = match sandbox_input_for_tool(&call.name, &call.input, ctx) {
            Ok(input) => input,
            Err(error) => {
                return ToolResult {
                    success: false,
                    output: String::new(),
                    error: Some(format_validation_error(&call.name, &call.input, &error)),
                };
            }
        };
        if let Some(sandbox) = self.sandbox_for_context(ctx) {
            if let Err(error) = sandbox.validate(&call.name, &sandbox_input) {
                return ToolResult {
                    success: false,
                    output: String::new(),
                    error: Some(format!("Validation: {}", error)),
                };
            }
        }

        match tool.check_permissions(&call.input, ctx).await {
            crate::tools::PermissionResult::Allow => {}
            crate::tools::PermissionResult::Deny(reason) => {
                return ToolResult {
                    success: false,
                    output: String::new(),
                    error: Some(format!("Permission denied: {}", reason)),
                };
            }
            crate::tools::PermissionResult::AskUser { description } => {
                return ToolResult {
                    success: false,
                    output: String::new(),
                    error: Some(format!("Approval required: {}", description)),
                };
            }
        }

        match timeout(
            Duration::from_secs(self.timeout_secs),
            tool.execute(call.input.clone(), ctx),
        )
        .await
        {
            Ok(Ok(mut result)) => {
                self.truncate_output(
                    &mut result,
                    self.output_max_chars.min(tool.max_result_size_chars()),
                );
                result
            }
            Ok(Err(error)) => ToolResult {
                success: false,
                output: String::new(),
                error: Some(error),
            },
            Err(_) => ToolResult {
                success: false,
                output: String::new(),
                error: Some(format!(
                    "Tool '{}' timed out after {}s",
                    call.name, self.timeout_secs
                )),
            },
        }
    }

    fn truncate_output(&self, result: &mut ToolResult, max_chars: usize) {
        let output_chars: Vec<char> = result.output.chars().collect();
        let total_chars = output_chars.len();

        if total_chars <= max_chars {
            return;
        }

        let head_len = max_chars / 2;
        let tail_len = max_chars - head_len;
        let skipped = total_chars.saturating_sub(head_len + tail_len);
        let head = output_chars.iter().take(head_len).collect::<String>();
        let tail = output_chars
            .iter()
            .skip(total_chars.saturating_sub(tail_len))
            .collect::<String>();

        result.output = format!("{head}\n\n... [{skipped} chars truncated] ...\n\n{tail}");
    }

    fn sandbox_for_context(&self, ctx: &ToolContext) -> Option<SandboxConfig> {
        self.sandbox.as_ref().map(|sandbox| {
            let mut sandbox = sandbox.clone();

            if sandbox.allowed_prefixes.is_empty() {
                if !ctx.workspace_root.as_os_str().is_empty() {
                    sandbox.allowed_prefixes.push(ctx.workspace_root.clone());
                }
                sandbox
                    .allowed_prefixes
                    .extend(ctx.allowed_paths.iter().cloned());
            }

            sandbox
        })
    }
}

fn format_validation_error(tool_name: &str, input: &Value, error: &str) -> String {
    let received = serde_json::to_string(input).unwrap_or_else(|_| "<unserializable>".to_string());

    let guidance = match (tool_name, error) {
        (READ_FILE_TOOL_NAME | WRITE_FILE_TOOL_NAME | EDIT_FILE_TOOL_NAME, "file_path must be a string") => {
            " Expected a raw JSON object like {\"file_path\":\"src/main.rs\"}. Do not wrap the path in XML, markdown, or nested objects."
        }
        (READ_FILE_TOOL_NAME | WRITE_FILE_TOOL_NAME | EDIT_FILE_TOOL_NAME, "file_path is required") => {
            " Expected a raw JSON object like {\"file_path\":\"src/main.rs\"}."
        }
        _ => "",
    };

    format!("Validation: {error}. Received input: {received}.{guidance}")
}

fn sandbox_input_for_tool(
    tool_name: &str,
    params: &Value,
    ctx: &ToolContext,
) -> Result<Value, String> {
    let mut sandbox_input = params.clone();

    if matches!(
        tool_name,
        READ_FILE_TOOL_NAME | WRITE_FILE_TOOL_NAME | EDIT_FILE_TOOL_NAME | "delete_file"
    ) {
        let path = params
            .get("file_path")
            .and_then(Value::as_str)
            .ok_or_else(|| "file_path must be a string".to_string())?;
        let absolute = absolute_tool_path(ctx, path)?;
        sandbox_input["file_path"] = Value::String(absolute);
    }

    Ok(sandbox_input)
}

fn absolute_tool_path(ctx: &ToolContext, path: &str) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("file_path is required".to_string());
    }

    let candidate = PathBuf::from(trimmed);
    let absolute = if candidate.is_absolute() {
        candidate
    } else {
        workspace_root(ctx)?.join(candidate)
    };

    Ok(absolute.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tools::{Tool, ToolMeta, ToolRegistry};
    use async_trait::async_trait;
    use serde_json::json;
    use std::collections::HashMap;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;
    use tokio::time::sleep;
    use tokio_util::sync::CancellationToken;

    #[derive(Default)]
    struct ConcurrencyTracker {
        current: AtomicUsize,
        max_seen: AtomicUsize,
    }

    impl ConcurrencyTracker {
        fn enter(&self) {
            let current = self.current.fetch_add(1, Ordering::SeqCst) + 1;
            let mut observed = self.max_seen.load(Ordering::SeqCst);
            while current > observed {
                match self.max_seen.compare_exchange(
                    observed,
                    current,
                    Ordering::SeqCst,
                    Ordering::SeqCst,
                ) {
                    Ok(_) => break,
                    Err(actual) => observed = actual,
                }
            }
        }

        fn exit(&self) {
            self.current.fetch_sub(1, Ordering::SeqCst);
        }
    }

    struct TestTool {
        name: &'static str,
        concurrency_safe: bool,
        output: &'static str,
        delay_ms: u64,
        validate_error: Option<&'static str>,
        require_cancelled: bool,
        tracker: Option<Arc<ConcurrencyTracker>>,
        max_chars: usize,
    }

    #[async_trait]
    impl Tool for TestTool {
        fn name(&self) -> String {
            self.name.to_string()
        }

        fn description(&self) -> String {
            format!("Test tool {}", self.name)
        }

        fn parameters_schema(&self) -> Value {
            json!({
                "type": "object"
            })
        }

        fn meta(&self) -> ToolMeta {
            ToolMeta {
                is_concurrency_safe: self.concurrency_safe,
                max_output_bytes: self.max_chars,
                ..ToolMeta::default()
            }
        }

        async fn validate_input(&self, _params: &Value, _ctx: &ToolContext) -> Result<(), String> {
            if self.require_cancelled && !_ctx.cancellation.is_cancelled() {
                return Err("cancellation token was not forwarded".to_string());
            }

            match self.validate_error {
                Some(error) => Err(error.to_string()),
                None => Ok(()),
            }
        }

        fn max_result_size_chars(&self) -> usize {
            self.max_chars
        }

        async fn execute(&self, _params: Value, _ctx: &ToolContext) -> Result<ToolResult, String> {
            if let Some(tracker) = &self.tracker {
                tracker.enter();
            }

            if self.delay_ms > 0 {
                sleep(Duration::from_millis(self.delay_ms)).await;
            }

            if let Some(tracker) = &self.tracker {
                tracker.exit();
            }

            Ok(ToolResult {
                success: true,
                output: self.output.to_string(),
                error: None,
            })
        }
    }

    fn register_tool(registry: &mut ToolRegistry, tool: TestTool) {
        registry.register(Arc::new(tool));
    }

    fn tool_call(id: &str, name: &str) -> ToolCall {
        ToolCall {
            id: id.to_string(),
            name: name.to_string(),
            input: json!({}),
        }
    }

    fn tool_context() -> ToolContext {
        ToolContext {
            workspace_root: PathBuf::from("workspace"),
            allowed_paths: vec![],
            env_vars: HashMap::new(),
            cancellation: CancellationToken::new(),
        }
    }

    #[test]
    fn validation_error_for_file_tools_includes_example_and_received_input() {
        let message = format_validation_error(
            "read_file",
            &json!({ "file_path": { "string": "true", "value": "README.md" } }),
            "file_path must be a string",
        );

        assert!(message.contains("Validation: file_path must be a string"));
        assert!(message.contains("\"file_path\":{\"string\":\"true\",\"value\":\"README.md\"}"));
        assert!(message.contains("{\"file_path\":\"src/main.rs\"}"));
        assert!(message.contains("Do not wrap the path in XML"));
    }

    #[test]
    fn partition_tool_calls_groups_contiguous_safe_calls() {
        let executor = ToolExecutor::new(1, 100);
        let mut registry = ToolRegistry::new();
        register_tool(
            &mut registry,
            TestTool {
                name: "safe_a",
                concurrency_safe: true,
                output: "a",
                delay_ms: 0,
                validate_error: None,
                require_cancelled: false,
                tracker: None,
                max_chars: 100,
            },
        );
        register_tool(
            &mut registry,
            TestTool {
                name: "safe_b",
                concurrency_safe: true,
                output: "b",
                delay_ms: 0,
                validate_error: None,
                require_cancelled: false,
                tracker: None,
                max_chars: 100,
            },
        );

        let batches = executor.partition_tool_calls(
            &registry,
            &[tool_call("1", "safe_a"), tool_call("2", "safe_b")],
        );

        assert_eq!(batches.len(), 1);
        assert!(batches[0].is_concurrent);
        assert_eq!(batches[0].calls.len(), 2);
    }

    #[test]
    fn partition_tool_calls_splits_mixed_sequences() {
        let executor = ToolExecutor::new(1, 100);
        let mut registry = ToolRegistry::new();
        register_tool(
            &mut registry,
            TestTool {
                name: "safe",
                concurrency_safe: true,
                output: "safe",
                delay_ms: 0,
                validate_error: None,
                require_cancelled: false,
                tracker: None,
                max_chars: 100,
            },
        );
        register_tool(
            &mut registry,
            TestTool {
                name: "unsafe",
                concurrency_safe: false,
                output: "unsafe",
                delay_ms: 0,
                validate_error: None,
                require_cancelled: false,
                tracker: None,
                max_chars: 100,
            },
        );

        let batches = executor.partition_tool_calls(
            &registry,
            &[
                tool_call("1", "safe"),
                tool_call("2", "unsafe"),
                tool_call("3", "missing"),
                tool_call("4", "safe"),
            ],
        );

        assert_eq!(batches.len(), 4);
        assert!(batches[0].is_concurrent);
        assert_eq!(batches[0].calls[0].name, "safe");
        assert!(!batches[1].is_concurrent);
        assert_eq!(batches[1].calls[0].name, "unsafe");
        assert!(!batches[2].is_concurrent);
        assert_eq!(batches[2].calls[0].name, "missing");
        assert!(batches[3].is_concurrent);
        assert_eq!(batches[3].calls[0].name, "safe");
    }

    #[test]
    fn truncate_output_preserves_head_tail_and_utf8() {
        let executor = ToolExecutor::new(1, 4);
        let mut short_result = ToolResult {
            success: true,
            output: "ok".to_string(),
            error: None,
        };
        let mut result = ToolResult {
            success: true,
            output: "\u{4F60}\u{597D}\u{4E16}\u{754C}\u{518D}\u{89C1}".to_string(),
            error: None,
        };

        executor.truncate_output(&mut short_result, 4);
        executor.truncate_output(&mut result, 4);

        assert_eq!(short_result.output, "ok");
        assert_eq!(
            result.output,
            "\u{4F60}\u{597D}\n\n... [2 chars truncated] ...\n\n\u{518D}\u{89C1}"
        );
    }

    #[tokio::test]
    async fn execute_batch_returns_empty_for_empty_calls() {
        let executor = ToolExecutor::new(1, 100);
        let registry = ToolRegistry::new();

        let results = executor
            .execute_batch(&registry, &[], &tool_context())
            .await;

        assert!(results.is_empty());
    }

    #[tokio::test]
    async fn execute_batch_preserves_result_order_for_concurrent_calls() {
        let tracker = Arc::new(ConcurrencyTracker::default());
        let executor = ToolExecutor::new(1, 100);
        let mut registry = ToolRegistry::new();
        register_tool(
            &mut registry,
            TestTool {
                name: "first",
                concurrency_safe: true,
                output: "first",
                delay_ms: 50,
                validate_error: None,
                require_cancelled: false,
                tracker: Some(tracker.clone()),
                max_chars: 100,
            },
        );
        register_tool(
            &mut registry,
            TestTool {
                name: "second",
                concurrency_safe: true,
                output: "second",
                delay_ms: 10,
                validate_error: None,
                require_cancelled: false,
                tracker: Some(tracker.clone()),
                max_chars: 100,
            },
        );

        let results = executor
            .execute_batch(
                &registry,
                &[tool_call("1", "first"), tool_call("2", "second")],
                &tool_context(),
            )
            .await;

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].output, "first");
        assert_eq!(results[1].output, "second");
        assert!(tracker.max_seen.load(Ordering::SeqCst) >= 2);
    }

    #[tokio::test]
    async fn execute_batch_returns_unknown_validation_and_timeout_errors() {
        let executor = ToolExecutor::new(1, 100);
        let mut registry = ToolRegistry::new();
        register_tool(
            &mut registry,
            TestTool {
                name: "invalid",
                concurrency_safe: false,
                output: "invalid",
                delay_ms: 0,
                validate_error: Some("bad input"),
                require_cancelled: false,
                tracker: None,
                max_chars: 100,
            },
        );
        register_tool(
            &mut registry,
            TestTool {
                name: "slow",
                concurrency_safe: false,
                output: "slow",
                delay_ms: 1_100,
                validate_error: None,
                require_cancelled: false,
                tracker: None,
                max_chars: 100,
            },
        );

        let results = executor
            .execute_batch(
                &registry,
                &[
                    tool_call("1", "missing"),
                    tool_call("2", "invalid"),
                    tool_call("3", "slow"),
                ],
                &tool_context(),
            )
            .await;

        assert_eq!(results.len(), 3);
        assert_eq!(results[0].error.as_deref(), Some("Unknown tool: missing"));
        assert_eq!(
            results[1].error.as_deref(),
            Some("Validation: bad input. Received input: {}.")
        );
        assert_eq!(
            results[2].error.as_deref(),
            Some("Tool 'slow' timed out after 1s")
        );
    }

    #[tokio::test]
    async fn execute_batch_passes_cancellation_context_to_tools() {
        let executor = ToolExecutor::new(1, 100);
        let mut registry = ToolRegistry::new();
        let cancellation = CancellationToken::new();
        cancellation.cancel();

        register_tool(
            &mut registry,
            TestTool {
                name: "cancelled",
                concurrency_safe: false,
                output: "ok",
                delay_ms: 0,
                validate_error: None,
                require_cancelled: true,
                tracker: None,
                max_chars: 100,
            },
        );

        let ctx = ToolContext {
            workspace_root: PathBuf::from("workspace"),
            allowed_paths: vec![],
            env_vars: HashMap::new(),
            cancellation,
        };

        let results = executor
            .execute_batch(&registry, &[tool_call("1", "cancelled")], &ctx)
            .await;

        assert_eq!(results.len(), 1);
        assert!(results[0].success);
        assert!(results[0].error.is_none());
    }

    #[tokio::test]
    async fn execute_batch_applies_sandbox_validation() {
        let executor = ToolExecutor::new(1, 100);
        let mut registry = ToolRegistry::new();
        register_tool(
            &mut registry,
            TestTool {
                name: "bash",
                concurrency_safe: false,
                output: "ok",
                delay_ms: 0,
                validate_error: None,
                require_cancelled: false,
                tracker: None,
                max_chars: 100,
            },
        );

        let results = executor
            .execute_batch(
                &registry,
                &[ToolCall {
                    id: "1".to_string(),
                    name: "bash".to_string(),
                    input: json!({ "command": "rm -rf /" }),
                }],
                &tool_context(),
            )
            .await;

        assert_eq!(results.len(), 1);
        assert_eq!(
            results[0].error.as_deref(),
            Some("Validation: Command 'rm -rf /' is blocked")
        );
    }

    #[tokio::test]
    async fn execute_batch_skips_sandbox_when_disabled() {
        let executor = ToolExecutor::new(1, 100).with_sandbox(None);
        let mut registry = ToolRegistry::new();
        register_tool(
            &mut registry,
            TestTool {
                name: "bash",
                concurrency_safe: false,
                output: "ok",
                delay_ms: 0,
                validate_error: None,
                require_cancelled: false,
                tracker: None,
                max_chars: 100,
            },
        );

        let results = executor
            .execute_batch(
                &registry,
                &[ToolCall {
                    id: "1".to_string(),
                    name: "bash".to_string(),
                    input: json!({ "command": "rm -rf /" }),
                }],
                &tool_context(),
            )
            .await;

        assert_eq!(results.len(), 1);
        assert!(results[0].success);
        assert_eq!(results[0].output, "ok");
    }
}
