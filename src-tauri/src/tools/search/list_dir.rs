use super::{
    should_skip_dir, DEFAULT_DIRECTORY_DEPTH, DEFAULT_DIRECTORY_LIMIT, LIST_DIRECTORY_TOOL_NAME,
};
use crate::models::ToolResult;
use crate::tools::{display_path, resolve_tool_path, RiskLevel, Tool, ToolContext, ToolMeta};
use async_trait::async_trait;
use serde::Serialize;
use serde_json::{json, Value};
use std::fs;
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

pub struct ListDirectoryTool;

#[derive(Serialize)]
struct DirectoryEntry {
    path: String,
    name: String,
    entry_type: &'static str,
    depth: usize,
    size: u64,
    modified_ms: Option<u128>,
}

#[derive(Serialize)]
struct ListDirectoryResponse {
    root: String,
    depth: usize,
    offset: usize,
    limit: usize,
    total: usize,
    entries: Vec<DirectoryEntry>,
}

#[async_trait]
impl Tool for ListDirectoryTool {
    fn name(&self) -> String {
        LIST_DIRECTORY_TOOL_NAME.to_string()
    }

    fn description(&self) -> String {
        "List directory contents with a bounded tree-style view.".to_string()
    }

    fn parameters_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Optional directory to list. Defaults to the workspace root."
                },
                "depth": {
                    "type": "integer",
                    "minimum": 0,
                    "description": "Maximum recursive depth. Defaults to 2."
                },
                "offset": {
                    "type": "integer",
                    "minimum": 0,
                    "description": "Pagination offset."
                },
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "description": "Maximum number of entries to return, capped at 200."
                }
            },
            "additionalProperties": false
        })
    }

    fn meta(&self) -> ToolMeta {
        ToolMeta {
            risk_level: RiskLevel::Safe,
            needs_approval: false,
            is_concurrency_safe: true,
            is_read_only: true,
            ..ToolMeta::default()
        }
    }

    async fn validate_input(&self, params: &Value, ctx: &ToolContext) -> Result<(), String> {
        let root = resolve_tool_path(ctx, params.get("path").and_then(Value::as_str))?;
        if !root.is_dir() {
            return Err(format!("'{}' is not a directory", root.display()));
        }

        if let Some(limit) = params.get("limit").and_then(Value::as_u64) {
            if limit == 0 {
                return Err("limit must be greater than zero".to_string());
            }
        }

        Ok(())
    }

    fn search_hint(&self) -> &str {
        "list directory contents with tree structure"
    }

    fn aliases(&self) -> &[&str] {
        &["ls", "dir"]
    }

    async fn execute(&self, params: Value, ctx: &ToolContext) -> Result<ToolResult, String> {
        let root = resolve_tool_path(ctx, params.get("path").and_then(Value::as_str))?;
        let depth = params
            .get("depth")
            .and_then(Value::as_u64)
            .map(|value| value as usize)
            .unwrap_or(DEFAULT_DIRECTORY_DEPTH);
        let offset = params
            .get("offset")
            .and_then(Value::as_u64)
            .map(|value| value as usize)
            .unwrap_or(0);
        let limit = params
            .get("limit")
            .and_then(Value::as_u64)
            .map(|value| value as usize)
            .unwrap_or(DEFAULT_DIRECTORY_LIMIT)
            .min(DEFAULT_DIRECTORY_LIMIT);

        let mut entries = Vec::new();

        for entry in WalkDir::new(&root)
            .max_depth(depth.saturating_add(1))
            .sort_by_file_name()
            .into_iter()
            .filter_entry(|entry| !should_skip_dir(entry))
        {
            let entry = match entry {
                Ok(entry) => entry,
                Err(_) => continue,
            };

            if entry.depth() == 0 {
                continue;
            }

            let metadata = match fs::metadata(entry.path()) {
                Ok(metadata) => metadata,
                Err(_) => continue,
            };
            let modified_ms = metadata
                .modified()
                .ok()
                .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_millis());

            entries.push(DirectoryEntry {
                path: display_path(entry.path(), ctx),
                name: entry.file_name().to_string_lossy().into_owned(),
                entry_type: if metadata.is_dir() {
                    "directory"
                } else {
                    "file"
                },
                depth: entry.depth(),
                size: if metadata.is_file() {
                    metadata.len()
                } else {
                    0
                },
                modified_ms,
            });
        }

        let total = entries.len();
        let page = entries.into_iter().skip(offset).take(limit).collect();
        let root_display = {
            let display = display_path(&root, ctx);
            if display.is_empty() {
                ".".to_string()
            } else {
                display
            }
        };

        let response = ListDirectoryResponse {
            root: root_display,
            depth,
            offset,
            limit,
            total,
            entries: page,
        };

        Ok(ToolResult {
            success: true,
            output: serde_json::to_string_pretty(&response)
                .map_err(|error| format!("failed to serialize directory results: {}", error))?,
            error: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tools::ToolContext;
    use serde_json::json;
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

        fn write(&self, relative: &str, contents: &str) {
            let path = self.root.join(relative);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).unwrap();
            }
            fs::write(path, contents).unwrap();
        }

        fn create_dir(&self, relative: &str) {
            fs::create_dir_all(self.root.join(relative)).unwrap();
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
    async fn list_directory_returns_tree_entries() {
        let workspace = TestWorkspace::new("list-tree");
        workspace.write("src/main.rs", "fn main() {}\n");

        let result = ListDirectoryTool
            .execute(json!({ "depth": 2 }), &workspace.context())
            .await
            .unwrap();

        let payload: Value = serde_json::from_str(&result.output).unwrap();
        let entries = payload["entries"].as_array().unwrap();
        assert!(entries.iter().any(|entry| entry["path"] == "src"));
        assert!(entries.iter().any(|entry| entry["path"] == "src/main.rs"));
    }

    #[tokio::test]
    async fn list_directory_respects_depth_limit() {
        let workspace = TestWorkspace::new("list-depth");
        workspace.write("src/nested/deep.rs", "fn deep() {}\n");

        let result = ListDirectoryTool
            .execute(json!({ "depth": 1 }), &workspace.context())
            .await
            .unwrap();

        let payload: Value = serde_json::from_str(&result.output).unwrap();
        let paths: Vec<_> = payload["entries"]
            .as_array()
            .unwrap()
            .iter()
            .map(|entry| entry["path"].as_str().unwrap())
            .collect();

        assert!(paths.contains(&"src"));
        assert!(!paths.contains(&"src/nested/deep.rs"));
    }

    #[tokio::test]
    async fn list_directory_skips_ignored_directories() {
        let workspace = TestWorkspace::new("list-ignore");
        workspace.create_dir(".git/hooks");
        workspace.write(".git/config", "ignored\n");
        workspace.write("src/main.rs", "fn main() {}\n");

        let result = ListDirectoryTool
            .execute(json!({}), &workspace.context())
            .await
            .unwrap();

        let payload: Value = serde_json::from_str(&result.output).unwrap();
        let paths: Vec<_> = payload["entries"]
            .as_array()
            .unwrap()
            .iter()
            .map(|entry| entry["path"].as_str().unwrap())
            .collect();

        assert!(!paths.iter().any(|path| path.starts_with(".git")));
        assert!(paths.contains(&"src/main.rs"));
    }
}
