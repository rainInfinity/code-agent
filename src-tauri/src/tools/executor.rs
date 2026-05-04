use crate::models::ToolResult;
use crate::tools::Tool;
use serde_json::Value;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::timeout;

pub struct ToolExecutor {
    timeout_secs: u64,
    output_max_chars: usize,
}

impl ToolExecutor {
    pub fn new(timeout_secs: u64, output_max_chars: usize) -> Self {
        Self {
            timeout_secs,
            output_max_chars,
        }
    }

    pub async fn execute(&self, tool: Arc<dyn Tool>, input: Value) -> ToolResult {
        match timeout(Duration::from_secs(self.timeout_secs), tool.execute(input)).await {
            Ok(Ok(result)) => self.truncate_result(result),
            Ok(Err(error)) => ToolResult {
                success: false,
                output: String::new(),
                error: Some(error),
            },
            Err(_) => ToolResult {
                success: false,
                output: String::new(),
                error: Some(format!(
                    "Tool timed out after {} seconds",
                    self.timeout_secs
                )),
            },
        }
    }

    fn truncate_result(&self, mut result: ToolResult) -> ToolResult {
        if result.output.chars().count() > self.output_max_chars {
            result.output = result
                .output
                .chars()
                .take(self.output_max_chars)
                .collect::<String>();
            result.output.push_str("...(truncated)");
        }
        result
    }
}
