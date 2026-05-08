use serde::{Deserialize, Serialize};

// Re-export tool system types from the tools module
#[allow(unused_imports)]
pub use crate::tools::{PermissionResult, RiskLevel, ToolContext, ToolMeta};

/// Result of a tool execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub success: bool,
    pub output: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Tool definition for LLM (function calling format)
#[derive(Debug, Clone, Serialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    #[serde(rename = "input_schema")]
    pub parameters: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionContext {
    pub os: String,
    pub shell: String,
    pub arch: String,
    pub cwd: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub git_branch: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub git_status: Option<String>,
}
