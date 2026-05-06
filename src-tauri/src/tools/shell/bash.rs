use super::{
    execute_shell, shell_is_read_only, shell_meta, shell_permission_result, validate_shell_input,
    ShellSyntax, BASH_TOOL_NAME,
};
use crate::models::ToolResult;
use crate::tools::{PermissionResult, Tool, ToolContext, ToolMeta};
use async_trait::async_trait;
use serde_json::{json, Value};

pub struct BashTool;

#[async_trait]
impl Tool for BashTool {
    fn name(&self) -> String {
        BASH_TOOL_NAME.to_string()
    }

    fn description(&self) -> String {
        "Execute a bash command inside the workspace.".to_string()
    }

    fn parameters_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "Shell command to execute."
                },
                "workdir": {
                    "type": "string",
                    "description": "Optional working directory. Defaults to the workspace root."
                },
                "timeout": {
                    "type": "integer",
                    "minimum": 1,
                    "description": "Optional timeout in milliseconds. Defaults to 120000."
                }
            },
            "required": ["command"],
            "additionalProperties": false
        })
    }

    fn meta(&self) -> ToolMeta {
        shell_meta()
    }

    fn is_read_only(&self, params: &Value) -> bool {
        params
            .get("command")
            .and_then(Value::as_str)
            .map(|command| shell_is_read_only(command, ShellSyntax::Bash))
            .unwrap_or(false)
    }

    async fn validate_input(&self, params: &Value, ctx: &ToolContext) -> Result<(), String> {
        validate_shell_input(params, ctx)
    }

    async fn check_permissions(&self, params: &Value, _ctx: &ToolContext) -> PermissionResult {
        params
            .get("command")
            .and_then(Value::as_str)
            .map(|command| shell_permission_result(command, ShellSyntax::Bash))
            .unwrap_or_else(|| PermissionResult::Deny("command must be a string".to_string()))
    }

    fn search_hint(&self) -> &str {
        "execute shell command in project workspace"
    }

    async fn execute(&self, params: Value, ctx: &ToolContext) -> Result<ToolResult, String> {
        execute_shell(params, ctx, ShellSyntax::Bash).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tools::shell::shell_available;
    use std::collections::HashMap;
    use std::path::PathBuf;
    use tokio_util::sync::CancellationToken;

    fn tool_context() -> ToolContext {
        ToolContext {
            workspace_root: std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")),
            allowed_paths: vec![],
            env_vars: HashMap::new(),
            cancellation: CancellationToken::new(),
        }
    }

    #[test]
    fn bash_meta_marks_tool_as_dangerous() {
        let tool = BashTool;
        let meta = tool.meta();
        assert_eq!(meta.risk_level, crate::tools::RiskLevel::Dangerous);
        assert!(meta.needs_approval);
    }

    #[test]
    fn bash_identifies_read_only_commands() {
        let tool = BashTool;
        assert!(tool.is_read_only(&json!({ "command": "git status" })));
        assert!(!tool.is_read_only(&json!({ "command": "touch foo.txt" })));
    }

    #[tokio::test]
    async fn bash_rejects_dangerous_commands() {
        let tool = BashTool;
        let result = tool
            .check_permissions(&json!({ "command": "rm -rf /" }), &tool_context())
            .await;
        assert!(matches!(result, PermissionResult::Deny(_)));
    }

    #[tokio::test]
    async fn bash_runs_simple_command() {
        if !shell_available(ShellSyntax::Bash) {
            return;
        }

        let tool = BashTool;
        let result = tool
            .execute(json!({ "command": "printf hello" }), &tool_context())
            .await
            .unwrap();

        let payload: Value = serde_json::from_str(&result.output).unwrap();
        assert!(result.success);
        assert_eq!(payload["stdout"], "hello");
    }

    #[tokio::test]
    async fn bash_times_out_long_running_command() {
        if !shell_available(ShellSyntax::Bash) {
            return;
        }

        let tool = BashTool;
        let error = tool
            .execute(
                json!({ "command": "sleep 1", "timeout": 10 }),
                &tool_context(),
            )
            .await
            .unwrap_err();

        assert!(error.contains("timed out"));
    }

    #[tokio::test]
    async fn bash_reports_error_exit_code() {
        if !shell_available(ShellSyntax::Bash) {
            return;
        }

        let tool = BashTool;
        let result = tool
            .execute(json!({ "command": "exit 7" }), &tool_context())
            .await
            .unwrap();

        assert!(!result.success);
        assert_eq!(result.error.as_deref(), Some("Command exited with code 7"));
    }
}
