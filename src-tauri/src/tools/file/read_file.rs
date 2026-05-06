use super::{file_name, resolve_file_path, READ_FILE_TOOL_NAME};
use crate::models::ToolResult;
use crate::tools::{display_path, RiskLevel, Tool, ToolContext, ToolMeta};
use async_trait::async_trait;
use serde_json::{json, Value};
use std::fs;
use std::path::Path;

pub struct ReadFileTool;

#[async_trait]
impl Tool for ReadFileTool {
    fn name(&self) -> String {
        READ_FILE_TOOL_NAME.to_string()
    }

    fn description(&self) -> String {
        "Read file contents from disk with optional line-range support.".to_string()
    }

    fn parameters_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "Path to the file to read as a plain JSON string. Use an absolute or workspace-relative path like \"src/main.rs\". Do not wrap it in XML or nested objects."
                },
                "offset": {
                    "type": "integer",
                    "minimum": 0,
                    "description": "Optional zero-based starting line."
                },
                "limit": {
                    "type": "integer",
                    "minimum": 0,
                    "description": "Optional number of lines to return."
                },
                "pages": {
                    "type": "string",
                    "description": "Optional PDF page range such as \"1-5\"."
                }
            },
            "required": ["file_path"],
            "additionalProperties": false
        })
    }

    fn meta(&self) -> ToolMeta {
        ToolMeta {
            risk_level: RiskLevel::Safe,
            needs_approval: false,
            timeout_ms: 30_000,
            is_concurrency_safe: true,
            is_read_only: true,
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
        resolve_file_path(ctx, file_path)?;

        if let Some(offset) = params.get("offset") {
            offset
                .as_u64()
                .ok_or_else(|| "offset must be a non-negative integer".to_string())?;
        }

        if let Some(limit) = params.get("limit") {
            limit
                .as_u64()
                .ok_or_else(|| "limit must be a non-negative integer".to_string())?;
        }

        if let Some(pages) = params.get("pages") {
            pages
                .as_str()
                .ok_or_else(|| "pages must be a string".to_string())?;
        }

        Ok(())
    }

    fn user_facing_name(&self, params: &Value) -> String {
        params
            .get("file_path")
            .and_then(Value::as_str)
            .map(Path::new)
            .map(file_name)
            .map(|name| format!("读取 {name}"))
            .unwrap_or_else(|| "读取文件".to_string())
    }

    fn search_hint(&self) -> &str {
        "read file contents with optional line range and image/pdf support"
    }

    fn aliases(&self) -> &[&str] {
        &["read", "cat"]
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
        let path = resolve_file_path(ctx, file_path)?;

        if !path.exists() {
            return Err(format!("File not found: {}", path.display()));
        }

        if path.is_dir() {
            return Err(format!("'{}' is a directory", path.display()));
        }

        let offset = params
            .get("offset")
            .and_then(Value::as_u64)
            .map(|value| value as usize)
            .unwrap_or(0);
        let limit = params
            .get("limit")
            .and_then(Value::as_u64)
            .map(|value| value as usize);
        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.to_ascii_lowercase());

        let output = match extension.as_deref() {
            Some("png" | "jpg" | "jpeg" | "gif" | "webp") => {
                let metadata = fs::metadata(&path)
                    .map_err(|error| format!("Failed to stat file: {}", error))?;
                format!(
                    "Image file detected at '{}'. Size: {} bytes. Image parsing is not implemented in V1.",
                    display_path(&path, ctx),
                    metadata.len()
                )
            }
            Some("pdf") => {
                let metadata = fs::metadata(&path)
                    .map_err(|error| format!("Failed to stat file: {}", error))?;
                let page_hint = params
                    .get("pages")
                    .and_then(Value::as_str)
                    .map(|value| format!(" Requested pages: {value}."))
                    .unwrap_or_default();
                format!(
                    "PDF file detected at '{}'. Size: {} bytes. PDF parsing is not implemented in V1.{}",
                    display_path(&path, ctx),
                    metadata.len(),
                    page_hint
                )
            }
            _ => {
                let content = fs::read_to_string(&path)
                    .map_err(|error| format!("Failed to read file: {}", error))?;
                slice_lines(&content, offset, limit)
            }
        };

        Ok(ToolResult {
            success: true,
            output,
            error: None,
        })
    }
}

fn slice_lines(content: &str, offset: usize, limit: Option<usize>) -> String {
    let lines: Vec<&str> = content.split_inclusive('\n').collect();
    if lines.is_empty() {
        return if offset == 0 {
            content.to_string()
        } else {
            String::new()
        };
    }

    if offset >= lines.len() {
        return String::new();
    }

    let end = limit
        .map(|value| offset.saturating_add(value).min(lines.len()))
        .unwrap_or(lines.len());
    lines[offset..end].concat()
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
    async fn read_file_reads_existing_file() {
        let workspace = TestWorkspace::new("read-file");
        let file_path = workspace.write("src/demo.txt", "alpha\nbeta\n");

        let result = ReadFileTool
            .execute(
                json!({ "file_path": file_path.to_string_lossy().to_string() }),
                &workspace.context(),
            )
            .await
            .unwrap();

        assert_eq!(result.output, "alpha\nbeta\n");
    }

    #[tokio::test]
    async fn read_file_reports_missing_file() {
        let workspace = TestWorkspace::new("read-missing");

        let error = ReadFileTool
            .execute(
                json!({
                    "file_path": workspace.root.join("missing.txt").to_string_lossy().to_string()
                }),
                &workspace.context(),
            )
            .await
            .unwrap_err();

        assert!(error.contains("File not found"));
    }

    #[tokio::test]
    async fn read_file_supports_offset_and_limit() {
        let workspace = TestWorkspace::new("read-range");
        let file_path = workspace.write("src/demo.txt", "zero\none\ntwo\nthree\n");

        let result = ReadFileTool
            .execute(
                json!({
                    "file_path": file_path.to_string_lossy().to_string(),
                    "offset": 1,
                    "limit": 2
                }),
                &workspace.context(),
            )
            .await
            .unwrap();

        assert_eq!(result.output, "one\ntwo\n");
    }

    #[tokio::test]
    async fn read_file_handles_empty_file() {
        let workspace = TestWorkspace::new("read-empty");
        let file_path = workspace.write("src/empty.txt", "");

        let result = ReadFileTool
            .execute(
                json!({ "file_path": file_path.to_string_lossy().to_string() }),
                &workspace.context(),
            )
            .await
            .unwrap();

        assert_eq!(result.output, "");
    }
}
