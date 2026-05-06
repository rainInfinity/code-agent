use super::{ensure_not_directory, file_name, resolve_file_path, EDIT_FILE_TOOL_NAME};
use crate::models::ToolResult;
use crate::tools::{display_path, RiskLevel, Tool, ToolContext, ToolMeta};
use async_trait::async_trait;
use serde_json::{json, Value};
use std::fs;
use std::path::Path;

pub struct EditFileTool;

#[async_trait]
impl Tool for EditFileTool {
    fn name(&self) -> String {
        EDIT_FILE_TOOL_NAME.to_string()
    }

    fn description(&self) -> String {
        "Edit an existing file by replacing an exact string match.".to_string()
    }

    fn parameters_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "Path to the file to edit as a plain JSON string. Use an absolute or workspace-relative path like \"src/main.rs\". Do not wrap it in XML or nested objects."
                },
                "old_string": {
                    "type": "string",
                    "description": "Exact string to replace."
                },
                "new_string": {
                    "type": "string",
                    "description": "Replacement content."
                },
                "replace_all": {
                    "type": "boolean",
                    "description": "Replace all matches instead of requiring a unique match."
                }
            },
            "required": ["file_path", "old_string", "new_string"],
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

        let old_string = params
            .get("old_string")
            .and_then(Value::as_str)
            .ok_or_else(|| "old_string must be a string".to_string())?;
        if old_string.is_empty() {
            return Err("old_string must not be empty".to_string());
        }

        params
            .get("new_string")
            .and_then(Value::as_str)
            .ok_or_else(|| "new_string must be a string".to_string())?;

        if let Some(replace_all) = params.get("replace_all") {
            replace_all
                .as_bool()
                .ok_or_else(|| "replace_all must be a boolean".to_string())?;
        }

        Ok(())
    }

    fn user_facing_name(&self, params: &Value) -> String {
        params
            .get("file_path")
            .and_then(Value::as_str)
            .map(Path::new)
            .map(file_name)
            .map(|name| format!("编辑 {name}"))
            .unwrap_or_else(|| "编辑文件".to_string())
    }

    fn search_hint(&self) -> &str {
        "perform exact string replacements in existing file"
    }

    fn aliases(&self) -> &[&str] {
        &["edit"]
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
        let old_string = params
            .get("old_string")
            .and_then(Value::as_str)
            .ok_or_else(|| "old_string must be a string".to_string())?;
        let new_string = params
            .get("new_string")
            .and_then(Value::as_str)
            .ok_or_else(|| "new_string must be a string".to_string())?;
        let replace_all = params
            .get("replace_all")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let path = resolve_file_path(ctx, file_path)?;

        if !path.exists() {
            return Err(format!("File not found: {}", path.display()));
        }

        let content =
            fs::read_to_string(&path).map_err(|error| format!("Failed to read file: {}", error))?;
        let matches = content.matches(old_string).count();

        if matches == 0 {
            return Err("No match found".to_string());
        }

        if matches > 1 && !replace_all {
            return Err(
                "Multiple matches found, use replace_all or provide more context".to_string(),
            );
        }

        let updated = if replace_all {
            content.replace(old_string, new_string)
        } else {
            content.replacen(old_string, new_string, 1)
        };

        if updated == content {
            return Ok(ToolResult {
                success: true,
                output: format!("No changes were needed for '{}'.", display_path(&path, ctx)),
                error: None,
            });
        }

        fs::write(&path, updated).map_err(|error| format!("Failed to write file: {}", error))?;

        let replacements = if replace_all { matches } else { 1 };
        Ok(ToolResult {
            success: true,
            output: format!(
                "Updated '{}' with {} replacement{}.",
                display_path(&path, ctx),
                replacements,
                if replacements == 1 { "" } else { "s" }
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

        fn write(&self, relative: &str, contents: &str) -> PathBuf {
            let path = self.root.join(relative);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).unwrap();
            }
            fs::write(&path, contents).unwrap();
            path
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
    async fn edit_file_replaces_unique_match() {
        let workspace = TestWorkspace::new("edit-unique");
        let file_path = workspace.write("src/demo.txt", "hello world");

        EditFileTool
            .execute(
                json!({
                    "file_path": file_path.to_string_lossy().to_string(),
                    "old_string": "world",
                    "new_string": "team"
                }),
                &workspace.context(),
            )
            .await
            .unwrap();

        assert_eq!(fs::read_to_string(file_path).unwrap(), "hello team");
    }

    #[tokio::test]
    async fn edit_file_errors_when_no_match_exists() {
        let workspace = TestWorkspace::new("edit-none");
        let file_path = workspace.write("src/demo.txt", "hello world");

        let error = EditFileTool
            .execute(
                json!({
                    "file_path": file_path.to_string_lossy().to_string(),
                    "old_string": "missing",
                    "new_string": "team"
                }),
                &workspace.context(),
            )
            .await
            .unwrap_err();

        assert_eq!(error, "No match found");
    }

    #[tokio::test]
    async fn edit_file_errors_when_multiple_matches_exist() {
        let workspace = TestWorkspace::new("edit-many");
        let file_path = workspace.write("src/demo.txt", "echo\necho\n");

        let error = EditFileTool
            .execute(
                json!({
                    "file_path": file_path.to_string_lossy().to_string(),
                    "old_string": "echo",
                    "new_string": "print"
                }),
                &workspace.context(),
            )
            .await
            .unwrap_err();

        assert!(error.contains("Multiple matches found"));
    }

    #[tokio::test]
    async fn edit_file_replace_all_updates_all_matches() {
        let workspace = TestWorkspace::new("edit-all");
        let file_path = workspace.write("src/demo.txt", "echo\necho\n");

        EditFileTool
            .execute(
                json!({
                    "file_path": file_path.to_string_lossy().to_string(),
                    "old_string": "echo",
                    "new_string": "print",
                    "replace_all": true
                }),
                &workspace.context(),
            )
            .await
            .unwrap();

        assert_eq!(fs::read_to_string(file_path).unwrap(), "print\nprint\n");
    }
}
