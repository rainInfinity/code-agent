mod edit_file;
mod read_file;
mod write_file;

pub use edit_file::EditFileTool;
pub use read_file::ReadFileTool;
pub use write_file::WriteFileTool;

use crate::tools::workspace_root;
use crate::tools::ToolContext;
use std::ffi::OsString;
use std::fs;
use std::path::{Component, Path, PathBuf};

pub const READ_FILE_TOOL_NAME: &str = "read_file";
pub const WRITE_FILE_TOOL_NAME: &str = "write_file";
pub const EDIT_FILE_TOOL_NAME: &str = "edit_file";

pub(super) fn resolve_file_path(ctx: &ToolContext, file_path: &str) -> Result<PathBuf, String> {
    let trimmed = file_path.trim();
    if trimmed.is_empty() {
        return Err("file_path is required".to_string());
    }

    let root = workspace_root(ctx)?;
    let candidate = {
        let path = PathBuf::from(trimmed);
        if path.is_absolute() {
            path
        } else {
            root.join(path)
        }
    };
    let normalized = canonicalize_candidate(&candidate)?;

    if path_allowed(ctx, &normalized, &root) {
        Ok(normalized)
    } else {
        Err(format!(
            "Path '{}' is outside the allowed workspace",
            candidate.display()
        ))
    }
}

pub(super) fn ensure_not_directory(path: &Path) -> Result<(), String> {
    if path.exists() && path.is_dir() {
        Err(format!("'{}' is a directory", path.display()))
    } else {
        Ok(())
    }
}

pub(super) fn file_name(path: &Path) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or("file")
        .to_string()
}

fn path_allowed(ctx: &ToolContext, candidate: &Path, root: &Path) -> bool {
    if candidate.starts_with(root) {
        return true;
    }

    ctx.allowed_paths
        .iter()
        .filter_map(|allowed| canonicalize_candidate(allowed).ok())
        .any(|allowed| candidate.starts_with(allowed))
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
