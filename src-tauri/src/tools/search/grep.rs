use super::{should_skip_dir, DEFAULT_HEAD_LIMIT, GREP_TOOL_NAME};
use crate::models::ToolResult;
use crate::tools::{display_path, resolve_tool_path, RiskLevel, Tool, ToolContext, ToolMeta};
use async_trait::async_trait;
use glob::Pattern;
use regex::RegexBuilder;
use serde::Serialize;
use serde_json::{json, Value};
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

pub struct GrepTool;

#[derive(Clone, Copy, PartialEq, Eq)]
enum OutputMode {
    Content,
    FilesWithMatches,
    Count,
}

#[derive(Serialize)]
struct GrepMatch {
    path: String,
    line: usize,
    text: String,
}

#[derive(Serialize)]
struct GrepResponse {
    output_mode: &'static str,
    count: usize,
    truncated: bool,
    files: Vec<String>,
    matches: Vec<GrepMatch>,
}

#[async_trait]
impl Tool for GrepTool {
    fn name(&self) -> String {
        GREP_TOOL_NAME.to_string()
    }

    fn description(&self) -> String {
        "Search file contents with ripgrep-style regex matching.".to_string()
    }

    fn parameters_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "Regular expression pattern to search for."
                },
                "path": {
                    "type": "string",
                    "description": "Optional search root. Defaults to the workspace root."
                },
                "glob": {
                    "type": "string",
                    "description": "Optional glob filter for matching file paths, for example \"**/*.rs\"."
                },
                "output_mode": {
                    "type": "string",
                    "enum": ["content", "files_with_matches", "count"],
                    "description": "Return full content matches, files with matches, or a match count."
                },
                "head_limit": {
                    "type": "integer",
                    "minimum": 1,
                    "description": "Maximum number of content matches or files to return. Defaults to 250."
                },
                "-i": {
                    "type": "boolean",
                    "description": "Enable case-insensitive matching."
                },
                "multiline": {
                    "type": "boolean",
                    "description": "Enable multiline regex mode."
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

        if let Some(path) = params.get("path").and_then(Value::as_str) {
            resolve_tool_path(ctx, Some(path))?;
        } else {
            resolve_tool_path(ctx, None)?;
        }

        if let Some(glob_pattern) = params.get("glob").and_then(Value::as_str) {
            Pattern::new(glob_pattern)
                .map_err(|error| format!("glob pattern is invalid: {}", error))?;
        }

        if let Some(output_mode) = params.get("output_mode").and_then(Value::as_str) {
            parse_output_mode(output_mode)?;
        }

        if let Some(limit) = params.get("head_limit").and_then(Value::as_u64) {
            if limit == 0 {
                return Err("head_limit must be greater than zero".to_string());
            }
        }

        Ok(())
    }

    fn search_hint(&self) -> &str {
        "search code for regex pattern with ripgrep semantics"
    }

    fn aliases(&self) -> &[&str] {
        &["search", "rg"]
    }

    async fn execute(&self, params: Value, ctx: &ToolContext) -> Result<ToolResult, String> {
        let pattern = params
            .get("pattern")
            .and_then(Value::as_str)
            .ok_or_else(|| "pattern must be a string".to_string())?;
        let search_root = resolve_tool_path(ctx, params.get("path").and_then(Value::as_str))?;
        let glob_pattern = params
            .get("glob")
            .and_then(Value::as_str)
            .map(Pattern::new)
            .transpose()
            .map_err(|error| format!("glob pattern is invalid: {}", error))?;
        let output_mode = params
            .get("output_mode")
            .and_then(Value::as_str)
            .map(parse_output_mode)
            .transpose()?
            .unwrap_or(OutputMode::FilesWithMatches);
        let head_limit = params
            .get("head_limit")
            .and_then(Value::as_u64)
            .map(|value| value as usize)
            .unwrap_or(DEFAULT_HEAD_LIMIT);
        let case_insensitive = params.get("-i").and_then(Value::as_bool).unwrap_or(false);
        let multiline = params
            .get("multiline")
            .and_then(Value::as_bool)
            .unwrap_or(false);

        let regex = RegexBuilder::new(pattern)
            .case_insensitive(case_insensitive)
            .multi_line(multiline)
            .dot_matches_new_line(multiline)
            .build()
            .map_err(|error| format!("invalid regular expression: {}", error))?;

        let mut files = Vec::new();
        let mut matches = Vec::new();
        let mut count = 0usize;
        let mut truncated = false;

        for entry in WalkDir::new(&search_root)
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

            if !path_matches_glob(&glob_pattern, entry.path(), ctx) {
                continue;
            }

            let contents = match fs::read(entry.path()) {
                Ok(bytes) => String::from_utf8_lossy(&bytes).into_owned(),
                Err(_) => continue,
            };

            if multiline {
                let file_match_count = regex.find_iter(&contents).count();
                if file_match_count == 0 {
                    continue;
                }

                count += file_match_count;
                handle_file_output(
                    output_mode,
                    &mut files,
                    &mut matches,
                    entry.path(),
                    ctx,
                    &contents,
                    &regex,
                    head_limit,
                    &mut truncated,
                );
            } else {
                let mut file_match_count = 0usize;
                for (index, line) in contents.lines().enumerate() {
                    if regex.is_match(line) {
                        file_match_count += 1;
                        if output_mode == OutputMode::Content && matches.len() < head_limit {
                            matches.push(GrepMatch {
                                path: display_path(entry.path(), ctx),
                                line: index + 1,
                                text: line.to_string(),
                            });
                        } else if output_mode == OutputMode::Content {
                            truncated = true;
                        }
                    }
                }

                if file_match_count == 0 {
                    continue;
                }

                count += file_match_count;

                if output_mode == OutputMode::FilesWithMatches {
                    if files.len() < head_limit {
                        files.push(display_path(entry.path(), ctx));
                    } else {
                        truncated = true;
                    }
                }
            }

            if output_mode != OutputMode::Count && truncated {
                break;
            }
        }

        let response = GrepResponse {
            output_mode: output_mode.as_str(),
            count,
            truncated,
            files,
            matches,
        };

        Ok(ToolResult {
            success: true,
            output: serde_json::to_string_pretty(&response)
                .map_err(|error| format!("failed to serialize grep results: {}", error))?,
            error: None,
        })
    }
}

fn parse_output_mode(value: &str) -> Result<OutputMode, String> {
    match value {
        "content" => Ok(OutputMode::Content),
        "files_with_matches" => Ok(OutputMode::FilesWithMatches),
        "count" => Ok(OutputMode::Count),
        _ => Err("output_mode must be one of: content, files_with_matches, count".to_string()),
    }
}

impl OutputMode {
    fn as_str(self) -> &'static str {
        match self {
            OutputMode::Content => "content",
            OutputMode::FilesWithMatches => "files_with_matches",
            OutputMode::Count => "count",
        }
    }
}

fn path_matches_glob(glob_pattern: &Option<Pattern>, path: &Path, ctx: &ToolContext) -> bool {
    glob_pattern
        .as_ref()
        .map(|pattern| pattern.matches(&display_path(path, ctx)))
        .unwrap_or(true)
}

fn handle_file_output(
    output_mode: OutputMode,
    files: &mut Vec<String>,
    matches: &mut Vec<GrepMatch>,
    path: &Path,
    ctx: &ToolContext,
    contents: &str,
    regex: &regex::Regex,
    head_limit: usize,
    truncated: &mut bool,
) {
    match output_mode {
        OutputMode::FilesWithMatches => {
            if files.len() < head_limit {
                files.push(display_path(path, ctx));
            } else {
                *truncated = true;
            }
        }
        OutputMode::Content => {
            for found in regex.find_iter(contents) {
                if matches.len() >= head_limit {
                    *truncated = true;
                    break;
                }

                matches.push(GrepMatch {
                    path: display_path(path, ctx),
                    line: line_number(contents, found.start()),
                    text: line_text(contents, found.start()).to_string(),
                });
            }
        }
        OutputMode::Count => {}
    }
}

fn line_number(contents: &str, byte_offset: usize) -> usize {
    contents[..byte_offset]
        .bytes()
        .filter(|byte| *byte == b'\n')
        .count()
        + 1
}

fn line_text(contents: &str, byte_offset: usize) -> &str {
    let start = contents[..byte_offset]
        .rfind('\n')
        .map(|index| index + 1)
        .unwrap_or(0);
    let end = contents[byte_offset..]
        .find('\n')
        .map(|index| byte_offset + index)
        .unwrap_or(contents.len());
    contents[start..end].trim_end_matches('\r')
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
    async fn grep_returns_content_matches_with_glob_filter() {
        let workspace = TestWorkspace::new("grep-content");
        workspace.write("src/main.rs", "fn main() {\n    println!(\"Hello\");\n}\n");
        workspace.write("README.md", "println! should be ignored\n");

        let result = GrepTool
            .execute(
                json!({
                    "pattern": "println!",
                    "glob": "**/*.rs",
                    "output_mode": "content"
                }),
                &workspace.context(),
            )
            .await
            .unwrap();

        let payload: Value = serde_json::from_str(&result.output).unwrap();
        assert_eq!(payload["count"], 1);
        assert_eq!(payload["matches"].as_array().unwrap().len(), 1);
        assert_eq!(payload["matches"][0]["path"], "src/main.rs");
        assert_eq!(payload["matches"][0]["line"], 2);
    }

    #[tokio::test]
    async fn grep_count_mode_counts_matches() {
        let workspace = TestWorkspace::new("grep-count");
        workspace.write("src/lib.rs", "alpha\nbeta\nalpha\n");

        let result = GrepTool
            .execute(
                json!({
                    "pattern": "alpha",
                    "output_mode": "count"
                }),
                &workspace.context(),
            )
            .await
            .unwrap();

        let payload: Value = serde_json::from_str(&result.output).unwrap();
        assert_eq!(payload["count"], 2);
        assert!(payload["files"].as_array().unwrap().is_empty());
        assert!(payload["matches"].as_array().unwrap().is_empty());
    }

    #[tokio::test]
    async fn grep_returns_empty_results_when_no_match_exists() {
        let workspace = TestWorkspace::new("grep-empty");
        workspace.write("src/lib.rs", "alpha\nbeta\n");

        let result = GrepTool
            .execute(json!({ "pattern": "gamma" }), &workspace.context())
            .await
            .unwrap();

        let payload: Value = serde_json::from_str(&result.output).unwrap();
        assert_eq!(payload["count"], 0);
        assert!(payload["files"].as_array().unwrap().is_empty());
    }
}
