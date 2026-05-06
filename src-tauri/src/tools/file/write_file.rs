use super::{ensure_not_directory, file_name, resolve_file_path, WRITE_FILE_TOOL_NAME};
use crate::models::ToolResult;
use crate::tools::{display_path, RiskLevel, Tool, ToolContext, ToolMeta};
use async_trait::async_trait;
use serde_json::{json, Value};
use std::fs;
use std::path::Path;

pub struct WriteFileTool;

#[async_trait]
impl Tool for WriteFileTool {
    fn name(&self) -> String {
        WRITE_FILE_TOOL_NAME.to_string()
    }

    fn description(&self) -> String {
        "Create a file or overwrite an existing file with new content.".to_string()
    }

    fn parameters_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "Path to the file to write as a plain JSON string. Use an absolute or workspace-relative path like \"src/main.rs\". Do not wrap it in XML or nested objects."
                },
                "content": {
                    "type": "string",
                    "description": "Full file contents to write."
                }
            },
            "required": ["file_path", "content"],
            "additionalProperties": false
        })
    }

    fn meta(&self) -> ToolMeta {
        ToolMeta {
            risk_level: RiskLevel::Dangerous,
            needs_approval: true,
            timeout_ms: 60_000,
            ..ToolMeta::default()
        }
    }

    async fn validate_input(&self, params: &Value, ctx: &ToolContext) -> Result<(), String> {
        let Some(file_path_value) = params.get("file_path") else {
            return Err("file_path is required".to_string());
        };
        let file_path = file_path_value
            .as_str()
            .ok_or_else(|| "file_path must be a string".to_string())?;
        let path = resolve_file_path(ctx, file_path)?;
        ensure_not_directory(&path)?;
        params
            .get("content")
            .and_then(Value::as_str)
            .ok_or_else(|| "content must be a string".to_string())?;
        Ok(())
    }

    fn user_facing_name(&self, params: &Value) -> String {
        params
            .get("file_path")
            .and_then(Value::as_str)
            .map(Path::new)
            .map(file_name)
            .map(|name| format!("写入 {name}"))
            .unwrap_or_else(|| "写入文件".to_string())
    }

    fn search_hint(&self) -> &str {
        "create or overwrite a file at path with content"
    }

    fn aliases(&self) -> &[&str] {
        &["write", "create_file"]
    }

    fn get_path(&self, params: &Value) -> Option<String> {
        params
            .get("file_path")
            .and_then(Value::as_str)
            .map(ToString::to_string)
    }

    async fn execute(&self, params: Value, ctx: &ToolContext) -> Result<ToolResult, String> {
        let file_path = params
            .get("file_path")
            .and_then(Value::as_str)
            .ok_or_else(|| "file_path must be a string".to_string())?;
        let content = params
            .get("content")
            .and_then(Value::as_str)
            .ok_or_else(|| "content must be a string".to_string())?;
        let path = resolve_file_path(ctx, file_path)?;

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Failed to create parent directories: {}", error))?;
        }

        fs::write(&path, content).map_err(|error| format!("Failed to write file: {}", error))?;

        Ok(ToolResult {
            success: true,
            output: format!(
                "Wrote {} bytes to '{}'.",
                content.len(),
                display_path(&path, ctx)
            ),
            error: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::fs;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};
    use tokio_util::sync::CancellationToken;

    static NEXT_ID: AtomicU64 = AtomicU64::new(0);

    struct TestWorkspace {
        root: PathBuf,
    }

    impl TestWorkspace {
        fn new(name: &str) -> Self {
            let path = std::env::temp_dir().join(format!(
                "code-agent-{name}-{}",
                NEXT_ID.fetch_add(1, Ordering::Relaxed)
            ));
            if path.exists() {
                let _ = fs::remove_dir_all(&path);
            }
            fs::create_dir_all(&path).unwrap();
            Self { root: path }
        }

        fn context(&self) -> ToolContext {
            ToolContext {
                workspace_root: self.root.clone(),
                allowed_paths: vec![],
                env_vars: HashMap::new(),
                cancellation: CancellationToken::new(),
            }
        }
    }

    impl Drop for TestWorkspace {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    #[tokio::test]
    async fn write_file_creates_new_file() {
        let workspace = TestWorkspace::new("write-create");
        let file_path = workspace.root.join("nested/demo.txt");

        WriteFileTool
            .execute(
                json!({
                    "file_path": file_path.to_string_lossy().to_string(),
                    "content": "hello"
                }),
                &workspace.context(),
            )
            .await
            .unwrap();

        assert_eq!(fs::read_to_string(file_path).unwrap(), "hello");
    }

    #[tokio::test]
    async fn write_file_overwrites_existing_file() {
        let workspace = TestWorkspace::new("write-overwrite");
        let file_path = workspace.root.join("demo.txt");
        fs::write(&file_path, "before").unwrap();

        WriteFileTool
            .execute(
                json!({
                    "file_path": file_path.to_string_lossy().to_string(),
                    "content": "after"
                }),
                &workspace.context(),
            )
            .await
            .unwrap();

        assert_eq!(fs::read_to_string(file_path).unwrap(), "after");
    }

    #[tokio::test]
    async fn write_file_rejects_directory_target() {
        let workspace = TestWorkspace::new("write-dir");
        let directory = workspace.root.join("folder");
        fs::create_dir_all(&directory).unwrap();

        let error = WriteFileTool
            .validate_input(
                &json!({
                    "file_path": directory.to_string_lossy().to_string(),
                    "content": "blocked"
                }),
                &workspace.context(),
            )
            .await
            .unwrap_err();

        assert!(error.contains("is a directory"));
    }
}
