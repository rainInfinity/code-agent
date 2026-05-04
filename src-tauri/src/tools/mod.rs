pub mod executor;

use crate::models::{ToolDefinition, ToolResult};
use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;

#[async_trait]
pub trait Tool: Send + Sync {
    fn name(&self) -> String;
    fn description(&self) -> String;
    fn parameters_schema(&self) -> Value;
    async fn execute(&self, params: Value) -> Result<ToolResult, String>;
}

pub struct ToolRegistry {
    tools: HashMap<String, Arc<dyn Tool>>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self {
            tools: HashMap::new(),
        }
    }

    pub fn with_defaults() -> Self {
        let mut registry = Self::new();
        registry.register(Arc::new(EchoTool));
        registry
    }

    pub fn register(&mut self, tool: Arc<dyn Tool>) {
        self.tools.insert(tool.name(), tool);
    }

    pub fn get(&self, name: &str) -> Option<Arc<dyn Tool>> {
        self.tools.get(name).cloned()
    }

    pub fn definitions(&self) -> Vec<ToolDefinition> {
        self.tools
            .values()
            .map(|tool| ToolDefinition {
                name: tool.name(),
                description: tool.description(),
                parameters: tool.parameters_schema(),
            })
            .collect()
    }
}

pub struct EchoTool;

#[async_trait]
impl Tool for EchoTool {
    fn name(&self) -> String {
        "echo".to_string()
    }

    fn description(&self) -> String {
        "Echoes back the input message. Used for testing the tool system.".to_string()
    }

    fn parameters_schema(&self) -> Value {
        serde_json::json!({
            "type": "object",
            "properties": {
                "message": {
                    "type": "string",
                    "description": "The message to echo back"
                }
            },
            "required": ["message"],
            "additionalProperties": false
        })
    }

    async fn execute(&self, params: Value) -> Result<ToolResult, String> {
        let message = params
            .get("message")
            .and_then(|value| value.as_str())
            .unwrap_or("(empty)");

        Ok(ToolResult {
            success: true,
            output: format!("Echo: {}", message),
            error: None,
        })
    }
}
