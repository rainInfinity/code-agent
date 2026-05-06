use super::{should_skip_dir, GLOB_TOOL_NAME};
use crate::models::ToolResult;
use crate::tools::{display_path, resolve_tool_path, RiskLevel, Tool, ToolContext, ToolMeta};
use async_trait::async_trait;
use glob::Pattern;
use serde::Serialize;
use serde_json::{json, Value};
use std::fs;
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

pub struct GlobTool;

#[derive(Serialize)]
struct GlobResponse {
    pattern: String,
    root: String,
    paths: Vec<String>,
}

#[async_trait]
impl Tool for GlobTool {
    fn name(&self) -> String {
        GLOB_TOOL_NAME.to_string()
    }

    fn description(&self) -> String {
        "Find files whose paths match a glob pattern.".to_string()
    }

    fn parameters_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "Glob pattern, for example \"**/*.rs\"."
                },
                "path": {
                    "type": "string",
                    "description": "Optional search root. Defaults to the workspace root."
                }
            },
            "required": ["pattern"],
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
        let pattern = params
            .get("pattern")
            .and_then(Value::as_str)
            .map(str::trim)
            .ok_or_else(|| "pattern must be a string".to_string())?;
        if pattern.is_empty() {
            return Err("pattern cannot be empty".to_string());
        }

        Pattern::new(pattern).map_err(|error| format!("pattern is invalid: {}", error))?;

        if let Some(path) = params.get("path").and_then(Value::as_str) {
            resolve_tool_path(ctx, Some(path))?;
        }

        Ok(())
    }

    fn search_hint(&self) -> &str {
        "find files matching glob pattern by name"
    }

    fn aliases(&self) -> &[&str] {
        &["find"]
    }

    async fn execute(&self, params: Value, ctx: &ToolContext) -> Result<ToolResult, String> {
        let pattern = params
            .get("pattern")
            .and_then(Value::as_str)
            .ok_or_else(|| "pattern must be a string".to_string())?;
        let matcher =
            Pattern::new(pattern).map_err(|error| format!("pattern is invalid: {}", error))?;
        let root = resolve_tool_path(ctx, params.get("path").and_then(Value::as_str))?;

        let mut matches = Vec::new();

        for entry in WalkDir::new(&root)
            .sort_by_file_name()
            .into_iter()
            .filter_entry(|entry| !should_skip_dir(entry))
        {
            let entry = match entry {
                Ok(entry) => entry,
                Err(_) => continue,
            };

            if !entry.file_type().is_file() {
                continue;
            }

            let display = display_path(entry.path(), ctx);
            if !matcher.matches(&display) {
                continue;
            }

            let modified = fs::metadata(entry.path())
                .and_then(|metadata| metadata.modified())
                .ok()
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_millis())
                .unwrap_or(0);

            matches.push((modified, display));
        }

        matches.sort_by(|left, right| right.cmp(left));

        let response = GlobResponse {
            pattern: pattern.to_string(),
            root: display_path(&root, ctx),
            paths: matches.into_iter().map(|(_, path)| path).collect(),
        };

        Ok(ToolResult {
            success: true,
            output: serde_json::to_string_pretty(&response)
                .map_err(|error| format!("failed to serialize glob results: {}", error))?,
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
    use std::thread;
    use std::time::Duration;
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
    async fn glob_matches_pattern() {
        let workspace = TestWorkspace::new("glob-match");
        workspace.write("src/main.rs", "fn main() {}\n");
        workspace.write("src/lib.ts", "export {};\n");

        let result = GlobTool
            .execute(json!({ "pattern": "**/*.rs" }), &workspace.context())
            .await
            .unwrap();

        let payload: Value = serde_json::from_str(&result.output).unwrap();
        assert_eq!(payload["paths"].as_array().unwrap().len(), 1);
        assert_eq!(payload["paths"][0], "src/main.rs");
    }

    #[tokio::test]
    async fn glob_sorts_newest_first() {
        let workspace = TestWorkspace::new("glob-sort");
        workspace.write("src/older.rs", "old\n");
        thread::sleep(Duration::from_millis(20));
        workspace.write("src/newer.rs", "new\n");

        let result = GlobTool
            .execute(json!({ "pattern": "**/*.rs" }), &workspace.context())
            .await
            .unwrap();

        let payload: Value = serde_json::from_str(&result.output).unwrap();
        let paths: Vec<_> = payload["paths"]
            .as_array()
            .unwrap()
            .iter()
            .map(|value| value.as_str().unwrap())
            .collect();

        assert_eq!(paths, vec!["src/newer.rs", "src/older.rs"]);
    }
}
