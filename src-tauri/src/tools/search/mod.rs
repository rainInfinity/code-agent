pub mod glob;
pub mod grep;
pub mod list_dir;

use walkdir::DirEntry;

pub const GREP_TOOL_NAME: &str = "grep";
pub const GLOB_TOOL_NAME: &str = "glob";
pub const LIST_DIRECTORY_TOOL_NAME: &str = "list_directory";
pub const DEFAULT_HEAD_LIMIT: usize = 250;
pub const DEFAULT_DIRECTORY_DEPTH: usize = 2;
pub const DEFAULT_DIRECTORY_LIMIT: usize = 200;

pub fn should_skip_dir(entry: &DirEntry) -> bool {
    entry.file_type().is_dir()
        && entry
            .file_name()
            .to_str()
            .map(is_ignored_directory)
            .unwrap_or(false)
}

fn is_ignored_directory(name: &str) -> bool {
    matches!(name, ".git" | "node_modules" | "target")
}
