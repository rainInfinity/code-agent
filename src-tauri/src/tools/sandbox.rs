use crate::tools::file::{EDIT_FILE_TOOL_NAME, READ_FILE_TOOL_NAME, WRITE_FILE_TOOL_NAME};
use crate::tools::shell::{BASH_TOOL_NAME, POWERSHELL_TOOL_NAME};
use regex::Regex;
use serde_json::Value;
use std::ffi::OsString;
use std::fs;
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SandboxConfig {
    pub allowed_prefixes: Vec<PathBuf>,
    pub blocked_commands: Vec<String>,
    pub blocked_patterns: Vec<String>,
}

impl Default for SandboxConfig {
    fn default() -> Self {
        Self {
            allowed_prefixes: vec![],
            blocked_commands: vec![
                "rm -rf /".into(),
                "chmod 777".into(),
                "sudo ".into(),
                "dd if=".into(),
                "mkfs.".into(),
                ":(){ :|:& };:".into(),
            ],
            blocked_patterns: vec![r">\s*/dev/sd[a-z]".into(), r"format-\w+\s+/[a-z]".into()],
        }
    }
}

impl SandboxConfig {
    pub fn validate(&self, tool_name: &str, params: &Value) -> Result<(), String> {
        match tool_name {
            READ_FILE_TOOL_NAME | WRITE_FILE_TOOL_NAME | EDIT_FILE_TOOL_NAME | "delete_file" => {
                let path = params
                    .get("file_path")
                    .and_then(Value::as_str)
                    .ok_or_else(|| "file_path must be a string".to_string())?;
                self.check_path(path)
            }
            BASH_TOOL_NAME | POWERSHELL_TOOL_NAME => {
                let command = params
                    .get("command")
                    .and_then(Value::as_str)
                    .ok_or_else(|| "command must be a string".to_string())?;
                self.check_command(command)
            }
            _ => Ok(()),
        }
    }

    pub fn check_path(&self, path: &str) -> Result<(), String> {
        if self.allowed_prefixes.is_empty() {
            return Ok(());
        }

        let candidate = canonicalize_candidate(Path::new(path))?;
        let allowed = self
            .allowed_prefixes
            .iter()
            .filter_map(|prefix| canonicalize_candidate(prefix).ok())
            .any(|prefix| candidate.starts_with(prefix));

        if allowed {
            Ok(())
        } else {
            Err(format!("Path '{}' is outside allowed workspace", path))
        }
    }

    pub fn check_command(&self, command: &str) -> Result<(), String> {
        let normalized = command.trim().to_ascii_lowercase();

        for blocked in &self.blocked_commands {
            if normalized.contains(&blocked.to_ascii_lowercase()) {
                return Err(format!("Command '{}' is blocked", blocked));
            }
        }

        for pattern in &self.blocked_patterns {
            let regex = Regex::new(pattern)
                .map_err(|error| format!("Invalid blocked pattern '{}': {}", pattern, error))?;
            if regex.is_match(&normalized) {
                return Err(format!("Command matches blocked pattern: {}", pattern));
            }
        }

        Ok(())
    }
}

fn canonicalize_candidate(path: &Path) -> Result<PathBuf, String> {
    if path.exists() {
        return fs::canonicalize(path)
            .map_err(|error| format!("Failed to resolve path '{}': {}", path.display(), error));
    }

    let mut suffix = Vec::<OsString>::new();
    let mut current = path;

    while !current.exists() {
        let Some(name) = current.file_name() else {
            return Err(format!("Failed to resolve path '{}'", path.display()));
        };
        suffix.push(name.to_os_string());
        current = current
            .parent()
            .ok_or_else(|| format!("Failed to resolve path '{}'", path.display()))?;
    }

    let mut resolved = fs::canonicalize(current)
        .map_err(|error| format!("Failed to resolve path '{}': {}", current.display(), error))?;
    for component in suffix.iter().rev() {
        resolved.push(component);
    }

    Ok(normalize_path(&resolved))
}

fn normalize_path(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();

    for component in path.components() {
        match component {
            Component::Prefix(prefix) => normalized.push(prefix.as_os_str()),
            Component::RootDir => normalized.push(component.as_os_str()),
            Component::CurDir => {}
            Component::ParentDir => {
                normalized.pop();
            }
            Component::Normal(value) => normalized.push(value),
        }
    }

    normalized
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::{AtomicU64, Ordering};

    static NEXT_ID: AtomicU64 = AtomicU64::new(0);

    struct TestWorkspace {
        root: PathBuf,
    }

    impl TestWorkspace {
        fn new(name: &str) -> Self {
            let root = std::env::temp_dir().join(format!(
                "code-agent-sandbox-{name}-{}",
                NEXT_ID.fetch_add(1, Ordering::Relaxed)
            ));
            if root.exists() {
                let _ = fs::remove_dir_all(&root);
            }
            fs::create_dir_all(&root).unwrap();
            Self { root }
        }

        fn write(&self, relative: &str) -> PathBuf {
            let path = self.root.join(relative);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).unwrap();
            }
            fs::write(&path, "content").unwrap();
            path
        }
    }

    impl Drop for TestWorkspace {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    #[test]
    fn check_path_allows_paths_within_prefix() {
        let workspace = TestWorkspace::new("inside");
        let file_path = workspace.write("src/demo.txt");
        let config = SandboxConfig {
            allowed_prefixes: vec![workspace.root.clone()],
            ..SandboxConfig::default()
        };

        assert_eq!(config.check_path(&file_path.to_string_lossy()), Ok(()));
    }

    #[test]
    fn check_path_rejects_paths_outside_prefix() {
        let workspace = TestWorkspace::new("outside");
        let outside = TestWorkspace::new("outside-target");
        let outside_path = outside.write("secret.txt");
        let config = SandboxConfig {
            allowed_prefixes: vec![workspace.root.clone()],
            ..SandboxConfig::default()
        };

        let error = config
            .check_path(&outside_path.to_string_lossy())
            .unwrap_err();

        assert!(error.contains("outside allowed workspace"));
    }

    #[test]
    fn check_command_blocks_blacklist_and_allows_safe_command() {
        let config = SandboxConfig::default();

        assert_eq!(
            config.check_command("rm -rf /").unwrap_err(),
            "Command 'rm -rf /' is blocked"
        );
        assert_eq!(config.check_command("echo hello"), Ok(()));
    }

    #[test]
    fn check_path_allows_everything_when_prefixes_are_empty() {
        let config = SandboxConfig::default();

        assert_eq!(config.check_path("C:/not/real/path.txt"), Ok(()));
    }

    #[test]
    fn check_command_blocks_regex_matches() {
        let config = SandboxConfig::default();
        let error = config.check_command("format-c /dev/sda1").unwrap_err();

        assert_eq!(
            error,
            "Command matches blocked pattern: format-\\w+\\s+/[a-z]"
        );
    }
}
