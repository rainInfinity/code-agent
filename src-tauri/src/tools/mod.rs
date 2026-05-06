pub mod executor;
pub mod file;
pub mod sandbox;
pub mod search;
pub mod shell;

use crate::models::{ToolDefinition, ToolResult};
use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use std::sync::Arc;
use tokio_util::sync::CancellationToken;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RiskLevel {
    Safe,
    Moderate,
    Dangerous,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ToolMeta {
    pub risk_level: RiskLevel,
    pub needs_approval: bool,
    pub timeout_ms: u64,
    pub max_output_bytes: usize,
    pub is_concurrency_safe: bool,
    pub is_read_only: bool,
    pub is_destructive: bool,
}

impl Default for ToolMeta {
    fn default() -> Self {
        Self {
            risk_level: RiskLevel::Dangerous,
            needs_approval: true,
            timeout_ms: 120_000,
            max_output_bytes: 100_000,
            is_concurrency_safe: false,
            is_read_only: false,
            is_destructive: false,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ToolContext {
    pub workspace_root: PathBuf,
    pub allowed_paths: Vec<PathBuf>,
    pub env_vars: HashMap<String, String>,
    pub cancellation: CancellationToken,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PermissionResult {
    Allow,
    Deny(String),
    AskUser { description: String },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DenyRule {
    pub tool_pattern: String,
    pub reason: String,
}

#[async_trait]
pub trait Tool: Send + Sync {
    fn name(&self) -> String;
    fn description(&self) -> String;
    fn parameters_schema(&self) -> Value;
    fn meta(&self) -> ToolMeta {
        ToolMeta::default()
    }
    fn is_read_only(&self, _params: &Value) -> bool {
        self.meta().is_read_only
    }
    fn is_concurrency_safe(&self, _params: &Value) -> bool {
        self.meta().is_concurrency_safe
    }
    fn is_destructive(&self, _params: &Value) -> bool {
        self.meta().is_destructive
    }
    fn is_enabled(&self) -> bool {
        true
    }
    async fn validate_input(&self, _params: &Value, _ctx: &ToolContext) -> Result<(), String> {
        Ok(())
    }
    async fn check_permissions(&self, _params: &Value, _ctx: &ToolContext) -> PermissionResult {
        PermissionResult::Allow
    }
    fn search_hint(&self) -> &str {
        ""
    }
    fn aliases(&self) -> &[&str] {
        &[]
    }
    fn user_facing_name(&self, _params: &Value) -> String {
        self.name()
    }
    fn get_path(&self, _params: &Value) -> Option<String> {
        None
    }
    fn max_result_size_chars(&self) -> usize {
        self.meta().max_output_bytes
    }
    async fn execute(&self, params: Value, ctx: &ToolContext) -> Result<ToolResult, String>;
}

pub struct ToolRegistry {
    tools: HashMap<String, Arc<dyn Tool>>,
    deny_rules: Vec<DenyRule>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self {
            tools: HashMap::new(),
            deny_rules: Vec::new(),
        }
    }

    pub fn with_defaults() -> Self {
        let mut registry = Self::new();
        registry.register(Arc::new(file::EditFileTool));
        registry.register(Arc::new(file::ReadFileTool));
        registry.register(Arc::new(file::WriteFileTool));
        registry.register(Arc::new(search::grep::GrepTool));
        registry.register(Arc::new(search::glob::GlobTool));
        registry.register(Arc::new(search::list_dir::ListDirectoryTool));
        registry.register(Arc::new(shell::bash::BashTool));
        registry.register(Arc::new(shell::powershell::PowerShellTool));
        registry
    }

    pub fn register(&mut self, tool: Arc<dyn Tool>) {
        self.tools.insert(tool.name(), tool);
    }

    pub fn get(&self, name: &str) -> Option<Arc<dyn Tool>> {
        self.tools.get(name).cloned()
    }

    pub fn set_deny_rules(&mut self, rules: Vec<DenyRule>) {
        self.deny_rules = rules;
    }

    pub fn apply_deny_rules(&self, tool: &Arc<dyn Tool>) -> bool {
        !self
            .deny_rules
            .iter()
            .any(|rule| wildcard_match(&rule.tool_pattern, &tool.name()))
    }

    pub fn get_enabled_tools(&self) -> Vec<Arc<dyn Tool>> {
        let mut tools: Vec<_> = self
            .tools
            .values()
            .filter(|tool| tool.is_enabled())
            .filter(|tool| self.apply_deny_rules(tool))
            .cloned()
            .collect();
        tools.sort_by_key(|tool| tool.name());
        tools
    }

    pub fn assemble_tool_pool(
        built_in: &[Arc<dyn Tool>],
        mcp_tools: &[Arc<dyn Tool>],
    ) -> Vec<Arc<dyn Tool>> {
        let mut sorted_builtin = built_in.to_vec();
        sorted_builtin.sort_by_key(|tool| tool.name());

        let mut sorted_mcp = mcp_tools.to_vec();
        sorted_mcp.sort_by_key(|tool| tool.name());

        sorted_builtin.into_iter().chain(sorted_mcp).collect()
    }

    pub fn definitions(&self) -> Vec<ToolDefinition> {
        self.get_enabled_tools()
            .into_iter()
            .map(|tool| ToolDefinition {
                name: tool.name(),
                description: tool.description(),
                parameters: tool.parameters_schema(),
            })
            .collect()
    }
}

fn wildcard_match(pattern: &str, candidate: &str) -> bool {
    let pattern = pattern.as_bytes();
    let candidate = candidate.as_bytes();
    let (mut pattern_idx, mut candidate_idx) = (0usize, 0usize);
    let mut star_idx = None;
    let mut match_idx = 0usize;

    while candidate_idx < candidate.len() {
        if pattern_idx < pattern.len()
            && (pattern[pattern_idx] == b'?' || pattern[pattern_idx] == candidate[candidate_idx])
        {
            pattern_idx += 1;
            candidate_idx += 1;
        } else if pattern_idx < pattern.len() && pattern[pattern_idx] == b'*' {
            star_idx = Some(pattern_idx);
            match_idx = candidate_idx;
            pattern_idx += 1;
        } else if let Some(star) = star_idx {
            pattern_idx = star + 1;
            match_idx += 1;
            candidate_idx = match_idx;
        } else {
            return false;
        }
    }

    while pattern_idx < pattern.len() && pattern[pattern_idx] == b'*' {
        pattern_idx += 1;
    }

    pattern_idx == pattern.len()
}

pub(crate) fn workspace_root(ctx: &ToolContext) -> Result<PathBuf, String> {
    let root = if ctx.workspace_root.as_os_str().is_empty() {
        std::env::current_dir().map_err(|error| {
            format!(
                "Failed to resolve current working directory for tool execution: {}",
                error
            )
        })?
    } else {
        ctx.workspace_root.clone()
    };

    normalize_existing_path(&root)
}

pub(crate) fn resolve_tool_path(
    ctx: &ToolContext,
    requested: Option<&str>,
) -> Result<PathBuf, String> {
    let root = workspace_root(ctx)?;
    let candidate = match requested.map(str::trim).filter(|value| !value.is_empty()) {
        Some(path) => {
            let path = PathBuf::from(path);
            if path.is_absolute() {
                path
            } else {
                root.join(path)
            }
        }
        None => root.clone(),
    };

    let resolved = normalize_existing_path(&candidate)?;
    if path_allowed(ctx, &resolved, &root) {
        Ok(resolved)
    } else {
        Err(format!(
            "Path '{}' is outside the allowed workspace",
            candidate.display()
        ))
    }
}

pub(crate) fn display_path(path: &Path, ctx: &ToolContext) -> String {
    let display = match workspace_root(ctx) {
        Ok(root) => path
            .strip_prefix(&root)
            .map(normalize_path_display)
            .unwrap_or_else(|_| normalize_path_display(path)),
        Err(_) => normalize_path_display(path),
    };

    if display.is_empty() {
        ".".to_string()
    } else {
        display
    }
}

pub(crate) fn normalize_path_display(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn normalize_existing_path(path: &Path) -> Result<PathBuf, String> {
    fs::canonicalize(path)
        .map_err(|error| format!("Failed to resolve path '{}': {}", path.display(), error))
}

fn path_allowed(ctx: &ToolContext, candidate: &Path, root: &Path) -> bool {
    if candidate.starts_with(root) {
        return true;
    }

    ctx.allowed_paths.iter().any(|allowed| {
        normalize_existing_path(allowed)
            .map(|path| candidate.starts_with(path))
            .unwrap_or(false)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    struct MinimalTool;

    struct ConfigurableTool {
        name: &'static str,
        enabled: bool,
    }

    #[async_trait]
    impl Tool for MinimalTool {
        fn name(&self) -> String {
            "minimal".to_string()
        }

        fn description(&self) -> String {
            "Minimal test tool".to_string()
        }

        fn parameters_schema(&self) -> Value {
            json!({
                "type": "object",
                "properties": {}
            })
        }

        async fn execute(&self, _params: Value, _ctx: &ToolContext) -> Result<ToolResult, String> {
            Ok(ToolResult {
                success: true,
                output: "ok".to_string(),
                error: None,
            })
        }
    }

    #[async_trait]
    impl Tool for ConfigurableTool {
        fn name(&self) -> String {
            self.name.to_string()
        }

        fn description(&self) -> String {
            format!("{} tool", self.name)
        }

        fn parameters_schema(&self) -> Value {
            json!({
                "type": "object",
                "properties": {}
            })
        }

        fn is_enabled(&self) -> bool {
            self.enabled
        }

        async fn execute(&self, _params: Value, _ctx: &ToolContext) -> Result<ToolResult, String> {
            Ok(ToolResult {
                success: true,
                output: self.name.to_string(),
                error: None,
            })
        }
    }

    fn tool_names(tools: &[Arc<dyn Tool>]) -> Vec<String> {
        tools.iter().map(|tool| tool.name()).collect()
    }

    #[test]
    fn defaults_do_not_expose_test_tools() {
        let registry = ToolRegistry::with_defaults();

        let definition_names: Vec<_> = registry
            .definitions()
            .into_iter()
            .map(|tool| tool.name)
            .collect();

        assert_eq!(
            definition_names,
            vec![
                "bash",
                "edit_file",
                "glob",
                "grep",
                "list_directory",
                "powershell",
                "read_file",
                "write_file"
            ]
        );
        assert!(registry.get("echo").is_none());
    }

    #[test]
    fn tool_meta_default_is_fail_closed() {
        let meta = ToolMeta::default();

        assert_eq!(meta.risk_level, RiskLevel::Dangerous);
        assert!(meta.needs_approval);
        assert_eq!(meta.timeout_ms, 120_000);
        assert_eq!(meta.max_output_bytes, 100_000);
        assert!(!meta.is_concurrency_safe);
        assert!(!meta.is_read_only);
        assert!(!meta.is_destructive);
    }

    #[tokio::test]
    async fn default_trait_methods_work_for_minimal_tool() {
        let tool = MinimalTool;
        let params = json!({});
        let ctx = ToolContext {
            workspace_root: PathBuf::from("workspace"),
            allowed_paths: vec![PathBuf::from("workspace")],
            env_vars: HashMap::new(),
            cancellation: CancellationToken::new(),
        };

        assert_eq!(tool.meta(), ToolMeta::default());
        assert!(!tool.is_read_only(&params));
        assert!(!tool.is_concurrency_safe(&params));
        assert!(!tool.is_destructive(&params));
        assert!(tool.is_enabled());
        assert_eq!(tool.validate_input(&params, &ctx).await, Ok(()));
        assert_eq!(
            tool.check_permissions(&params, &ctx).await,
            PermissionResult::Allow
        );
        assert_eq!(tool.search_hint(), "");
        assert_eq!(tool.aliases(), &[] as &[&str]);
        assert_eq!(tool.user_facing_name(&params), "minimal");
        assert_eq!(tool.get_path(&params), None);
        assert_eq!(tool.max_result_size_chars(), 100_000);
    }

    #[test]
    fn get_enabled_tools_respects_is_enabled_and_sorts_results() {
        let mut registry = ToolRegistry::new();
        registry.register(Arc::new(ConfigurableTool {
            name: "zeta",
            enabled: true,
        }));
        registry.register(Arc::new(ConfigurableTool {
            name: "alpha",
            enabled: false,
        }));
        registry.register(Arc::new(ConfigurableTool {
            name: "beta",
            enabled: true,
        }));

        let enabled = registry.get_enabled_tools();

        assert_eq!(tool_names(&enabled), vec!["beta", "zeta"]);
    }

    #[test]
    fn deny_rules_filter_matching_tools() {
        let mut registry = ToolRegistry::new();
        let bash = Arc::new(ConfigurableTool {
            name: "bash",
            enabled: true,
        });
        let web_search = Arc::new(ConfigurableTool {
            name: "web_search",
            enabled: true,
        });
        let read_file = Arc::new(ConfigurableTool {
            name: "read_file",
            enabled: true,
        });

        registry.register(bash.clone());
        registry.register(web_search.clone());
        registry.register(read_file.clone());
        registry.set_deny_rules(vec![
            DenyRule {
                tool_pattern: "ba?h".to_string(),
                reason: "block shell".to_string(),
            },
            DenyRule {
                tool_pattern: "web_*".to_string(),
                reason: "block web".to_string(),
            },
        ]);

        assert!(!registry.apply_deny_rules(&(bash as Arc<dyn Tool>)));
        assert!(!registry.apply_deny_rules(&(web_search as Arc<dyn Tool>)));
        assert!(registry.apply_deny_rules(&(read_file.clone() as Arc<dyn Tool>)));
        assert_eq!(tool_names(&registry.get_enabled_tools()), vec!["read_file"]);
    }

    #[test]
    fn clearing_deny_rules_restores_tools() {
        let mut registry = ToolRegistry::new();
        registry.register(Arc::new(ConfigurableTool {
            name: "alpha",
            enabled: true,
        }));
        registry.register(Arc::new(ConfigurableTool {
            name: "beta",
            enabled: true,
        }));

        registry.set_deny_rules(vec![DenyRule {
            tool_pattern: "*".to_string(),
            reason: "block all".to_string(),
        }]);
        assert!(registry.get_enabled_tools().is_empty());

        registry.set_deny_rules(Vec::new());
        assert_eq!(
            tool_names(&registry.get_enabled_tools()),
            vec!["alpha", "beta"]
        );
    }

    #[test]
    fn assemble_tool_pool_keeps_built_in_before_mcp() {
        let built_in: Vec<Arc<dyn Tool>> = vec![
            Arc::new(ConfigurableTool {
                name: "zeta",
                enabled: true,
            }),
            Arc::new(ConfigurableTool {
                name: "alpha",
                enabled: true,
            }),
        ];
        let mcp_tools: Vec<Arc<dyn Tool>> = vec![
            Arc::new(ConfigurableTool {
                name: "tool_b",
                enabled: true,
            }),
            Arc::new(ConfigurableTool {
                name: "tool_a",
                enabled: true,
            }),
        ];

        let pool = ToolRegistry::assemble_tool_pool(&built_in, &mcp_tools);

        assert_eq!(tool_names(&pool), vec!["alpha", "zeta", "tool_a", "tool_b"]);
    }

    #[test]
    fn definitions_return_only_enabled_and_allowed_tools() {
        let mut registry = ToolRegistry::new();
        registry.register(Arc::new(ConfigurableTool {
            name: "visible",
            enabled: true,
        }));
        registry.register(Arc::new(ConfigurableTool {
            name: "disabled",
            enabled: false,
        }));
        registry.register(Arc::new(ConfigurableTool {
            name: "web_fetch",
            enabled: true,
        }));
        registry.set_deny_rules(vec![DenyRule {
            tool_pattern: "web_*".to_string(),
            reason: "blocked".to_string(),
        }]);

        let definitions = registry.definitions();
        let definition_names: Vec<_> = definitions.into_iter().map(|tool| tool.name).collect();

        assert_eq!(definition_names, vec!["visible"]);
    }
}
