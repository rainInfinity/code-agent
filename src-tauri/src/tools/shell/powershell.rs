use super::{
    execute_shell, shell_is_read_only, shell_meta, shell_permission_result, validate_shell_input,
    ShellSyntax, POWERSHELL_TOOL_NAME,
};
use crate::models::ToolResult;
use crate::tools::{PermissionResult, Tool, ToolContext, ToolMeta};
use async_trait::async_trait;
use serde_json::{json, Value};

pub struct PowerShellTool;

#[async_trait]
impl Tool for PowerShellTool {
    fn name(&self) -> String {
        POWERSHELL_TOOL_NAME.to_string()
    }

    fn description(&self) -> String {
        "Execute a Windows PowerShell command inside the workspace.".to_string()
    }

    fn parameters_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "PowerShell command to execute."
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
            .map(|command| shell_is_read_only(command, ShellSyntax::PowerShell))
            .unwrap_or(false)
    }

    async fn validate_input(&self, params: &Value, ctx: &ToolContext) -> Result<(), String> {
        validate_shell_input(params, ctx)
    }

    async fn check_permissions(&self, params: &Value, _ctx: &ToolContext) -> PermissionResult {
        params
            .get("command")
            .and_then(Value::as_str)
            .map(|command| shell_permission_result(command, ShellSyntax::PowerShell))
            .unwrap_or_else(|| PermissionResult::Deny("command must be a string".to_string()))
    }

    fn search_hint(&self) -> &str {
        "execute PowerShell command in project workspace"
    }

    async fn execute(&self, params: Value, ctx: &ToolContext) -> Result<ToolResult, String> {
        execute_shell(params, ctx, ShellSyntax::PowerShell).await
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
    fn powershell_identifies_read_only_commands() {
        let tool = PowerShellTool;
        assert!(tool.is_read_only(&json!({ "command": "Get-ChildItem" })));
        assert!(!tool.is_read_only(&json!({ "command": "Remove-Item foo.txt" })));
    }

    #[tokio::test]
    async fn powershell_rejects_dangerous_commands() {
        let tool = PowerShellTool;
        let result = tool
            .check_permissions(
                &json!({ "command": "Remove-Item -Recurse -Force ." }),
                &tool_context(),
            )
            .await;
        assert!(matches!(result, PermissionResult::Deny(_)));
    }

    #[tokio::test]
    async fn powershell_runs_basic_cmdlet() {
        if !shell_available(ShellSyntax::PowerShell) {
            return;
        }

        let tool = PowerShellTool;
        let result = tool
            .execute(json!({ "command": "Write-Output hello" }), &tool_context())
            .await
            .unwrap();

        let payload: Value = serde_json::from_str(&result.output).unwrap();
        assert!(result.success);
        assert_eq!(payload["stdout"], "hello\r\n");
    }

    #[tokio::test]
    async fn powershell_times_out_long_running_command() {
        if !shell_available(ShellSyntax::PowerShell) {
            return;
        }

        let tool = PowerShellTool;
        let error = tool
            .execute(
                json!({ "command": "Start-Sleep -Seconds 1", "timeout": 10 }),
                &tool_context(),
            )
            .await
            .unwrap_err();

        assert!(error.contains("timed out"));
    }

    #[tokio::test]
    async fn powershell_reports_error_exit_code() {
        if !shell_available(ShellSyntax::PowerShell) {
            return;
        }

        let tool = PowerShellTool;
        let result = tool
            .execute(
                json!({ "command": "Write-Error boom; exit 7" }),
                &tool_context(),
            )
            .await
            .unwrap();

        assert!(!result.success);
        assert_eq!(result.error.as_deref(), Some("Command exited with code 7"));
    }
}
