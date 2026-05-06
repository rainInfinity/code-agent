pub mod bash;
pub mod powershell;

use crate::models::ToolResult;
use crate::tools::{
    display_path, resolve_tool_path, PermissionResult, RiskLevel, ToolContext, ToolMeta,
};
use serde::Serialize;
use serde_json::Value;
use std::ffi::OsStr;
use std::path::PathBuf;
use std::process::Stdio;
use std::time::Duration;
use tokio::io::AsyncReadExt;
use tokio::process::Command;

pub const BASH_TOOL_NAME: &str = "bash";
pub const POWERSHELL_TOOL_NAME: &str = "powershell";
pub const DEFAULT_TIMEOUT_MS: u64 = 120_000;

#[derive(Clone, Copy)]
pub enum ShellSyntax {
    Bash,
    PowerShell,
}

#[derive(Serialize)]
struct ShellResponse {
    command: String,
    workdir: String,
    exit_code: Option<i32>,
    stdout: String,
    stderr: String,
}

pub fn shell_meta() -> ToolMeta {
    ToolMeta {
        risk_level: RiskLevel::Dangerous,
        needs_approval: true,
        timeout_ms: DEFAULT_TIMEOUT_MS,
        is_concurrency_safe: false,
        is_read_only: false,
        is_destructive: false,
        ..ToolMeta::default()
    }
}

pub fn validate_shell_input(params: &Value, ctx: &ToolContext) -> Result<(), String> {
    let command = params
        .get("command")
        .and_then(Value::as_str)
        .map(str::trim)
        .ok_or_else(|| "command must be a string".to_string())?;
    if command.is_empty() {
        return Err("command cannot be empty".to_string());
    }

    let workdir = resolve_tool_path(ctx, params.get("workdir").and_then(Value::as_str))?;
    if !workdir.is_dir() {
        return Err(format!("'{}' is not a directory", workdir.display()));
    }

    if let Some(timeout_ms) = params.get("timeout").and_then(Value::as_u64) {
        if timeout_ms == 0 {
            return Err("timeout must be greater than zero".to_string());
        }
    }

    Ok(())
}

pub fn shell_is_read_only(command: &str, syntax: ShellSyntax) -> bool {
    let normalized = command.trim().to_ascii_lowercase();
    if normalized.is_empty() || contains_write_redirection(&normalized) {
        return false;
    }

    match syntax {
        ShellSyntax::Bash => bash_is_read_only(&normalized),
        ShellSyntax::PowerShell => powershell_is_read_only(&normalized),
    }
}

pub fn shell_permission_result(command: &str, syntax: ShellSyntax) -> PermissionResult {
    if matches_dangerous_pattern(command, syntax) {
        return PermissionResult::Deny("Command matches a blocked dangerous pattern".to_string());
    }

    if shell_is_read_only(command, syntax) {
        PermissionResult::Allow
    } else {
        PermissionResult::AskUser {
            description: "This command may modify the workspace or system state.".to_string(),
        }
    }
}

pub async fn execute_shell(
    params: Value,
    ctx: &ToolContext,
    syntax: ShellSyntax,
) -> Result<ToolResult, String> {
    let command = params
        .get("command")
        .and_then(Value::as_str)
        .ok_or_else(|| "command must be a string".to_string())?
        .to_string();
    let workdir = resolve_tool_path(ctx, params.get("workdir").and_then(Value::as_str))?;
    let timeout_ms = params
        .get("timeout")
        .and_then(Value::as_u64)
        .unwrap_or(DEFAULT_TIMEOUT_MS);

    let (program, args) = shell_invocation(&command, syntax)?;
    let mut process = Command::new(&program);
    process
        .args(args)
        .current_dir(&workdir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    for (key, value) in &ctx.env_vars {
        process.env(key, value);
    }

    let mut child = process.spawn().map_err(|error| {
        format!(
            "Failed to start {} command '{}': {}",
            program.to_string_lossy(),
            command,
            error
        )
    })?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture command stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to capture command stderr".to_string())?;

    let stdout_task = tokio::spawn(async move {
        let mut reader = tokio::io::BufReader::new(stdout);
        let mut buffer = Vec::new();
        reader.read_to_end(&mut buffer).await?;
        Ok::<Vec<u8>, std::io::Error>(buffer)
    });
    let stderr_task = tokio::spawn(async move {
        let mut reader = tokio::io::BufReader::new(stderr);
        let mut buffer = Vec::new();
        reader.read_to_end(&mut buffer).await?;
        Ok::<Vec<u8>, std::io::Error>(buffer)
    });

    let wait_result = tokio::select! {
        _ = ctx.cancellation.cancelled() => {
            let _ = child.kill().await;
            let _ = child.wait().await;
            return Err("Command execution was cancelled".to_string());
        }
        status = tokio::time::timeout(Duration::from_millis(timeout_ms), child.wait()) => status
    };

    let status = match wait_result {
        Ok(result) => result.map_err(|error| format!("Failed to wait for command: {}", error))?,
        Err(_) => {
            let _ = child.kill().await;
            let _ = child.wait().await;
            return Err(format!("Command timed out after {}ms", timeout_ms));
        }
    };

    let stdout = task_output(stdout_task, "stdout").await?;
    let stderr = task_output(stderr_task, "stderr").await?;
    let response = ShellResponse {
        command: command.clone(),
        workdir: display_path(&workdir, ctx),
        exit_code: status.code(),
        stdout,
        stderr,
    };
    let output = serde_json::to_string_pretty(&response)
        .map_err(|error| format!("Failed to serialize shell result: {}", error))?;

    Ok(ToolResult {
        success: status.success(),
        output,
        error: if status.success() {
            None
        } else {
            Some(match status.code() {
                Some(code) => format!("Command exited with code {}", code),
                None => "Command terminated without an exit code".to_string(),
            })
        },
    })
}

pub fn shell_invocation(
    command: &str,
    syntax: ShellSyntax,
) -> Result<(PathBuf, Vec<String>), String> {
    match syntax {
        ShellSyntax::Bash => {
            let program = find_program(["bash", "C:\\Program Files\\Git\\bin\\bash.exe"])
                .ok_or_else(|| "bash executable was not found on this system".to_string())?;
            Ok((program, vec!["-lc".to_string(), command.to_string()]))
        }
        ShellSyntax::PowerShell => {
            #[cfg(windows)]
            {
                Ok((
                    PathBuf::from("powershell.exe"),
                    vec![
                        "-NonInteractive".to_string(),
                        "-Command".to_string(),
                        command.to_string(),
                    ],
                ))
            }
            #[cfg(not(windows))]
            {
                let _ = command;
                Err("PowerShell is only supported on Windows".to_string())
            }
        }
    }
}

#[cfg(test)]
pub fn shell_available(syntax: ShellSyntax) -> bool {
    match syntax {
        ShellSyntax::Bash => {
            find_program(["bash", "C:\\Program Files\\Git\\bin\\bash.exe"]).is_some()
        }
        ShellSyntax::PowerShell => cfg!(windows),
    }
}

async fn task_output(
    handle: tokio::task::JoinHandle<Result<Vec<u8>, std::io::Error>>,
    stream_name: &str,
) -> Result<String, String> {
    let bytes = handle
        .await
        .map_err(|error| format!("Failed to join {stream_name} reader: {}", error))?
        .map_err(|error| format!("Failed to read {stream_name}: {}", error))?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

fn contains_write_redirection(command: &str) -> bool {
    command.contains(" >")
        || command.contains(">>")
        || command.contains("out-file")
        || command.contains("set-content")
        || command.contains("add-content")
        || command.contains("tee-object")
}

fn bash_is_read_only(command: &str) -> bool {
    if command.contains("&&") || command.contains("||") || command.contains(';') {
        return false;
    }

    command
        .split('|')
        .map(str::trim)
        .filter(|segment| !segment.is_empty())
        .all(is_bash_segment_read_only)
}

fn powershell_is_read_only(command: &str) -> bool {
    if command.contains(';') {
        return false;
    }

    command
        .split('|')
        .map(str::trim)
        .filter(|segment| !segment.is_empty())
        .all(is_powershell_segment_read_only)
}

fn is_bash_segment_read_only(segment: &str) -> bool {
    let tokens: Vec<_> = segment.split_whitespace().collect();
    let Some(command) = tokens.first().copied() else {
        return false;
    };

    if command == "sed"
        && tokens
            .iter()
            .any(|token| *token == "-i" || token.starts_with("-i"))
    {
        return false;
    }

    if command == "git" {
        return tokens
            .get(1)
            .map(|subcommand| {
                matches!(
                    *subcommand,
                    "status" | "diff" | "show" | "log" | "branch" | "rev-parse"
                )
            })
            .unwrap_or(false);
    }

    matches!(
        command,
        "cat"
            | "echo"
            | "find"
            | "grep"
            | "head"
            | "ls"
            | "pwd"
            | "rg"
            | "sed"
            | "sort"
            | "tail"
            | "uniq"
            | "wc"
            | "awk"
            | "cut"
    )
}

fn is_powershell_segment_read_only(segment: &str) -> bool {
    let tokens: Vec<_> = segment.split_whitespace().collect();
    let Some(command) = tokens.first().copied() else {
        return false;
    };

    if command == "git" {
        return tokens
            .get(1)
            .map(|subcommand| {
                matches!(
                    *subcommand,
                    "status" | "diff" | "show" | "log" | "branch" | "rev-parse"
                )
            })
            .unwrap_or(false);
    }

    matches!(
        command,
        "get-childitem"
            | "get-content"
            | "get-item"
            | "get-location"
            | "measure-object"
            | "select-object"
            | "select-string"
            | "sort-object"
            | "test-path"
            | "where-object"
            | "write-output"
            | "cat"
            | "dir"
            | "echo"
            | "ls"
            | "pwd"
    )
}

fn matches_dangerous_pattern(command: &str, syntax: ShellSyntax) -> bool {
    let normalized = command.to_ascii_lowercase();
    match syntax {
        ShellSyntax::Bash => [
            "rm -rf /",
            "sudo rm -rf /",
            "chmod 777",
            "mkfs",
            "dd if=",
            "shutdown",
            "reboot",
            "| sh",
            "| bash",
            ":(){:|:&};:",
        ]
        .iter()
        .any(|pattern| normalized.contains(pattern)),
        ShellSyntax::PowerShell => [
            "remove-item",
            "format-volume",
            "clear-disk",
            "stop-computer",
            "restart-computer",
            "invoke-expression",
            "start-process",
            "stop-process",
        ]
        .iter()
        .any(|pattern| normalized.contains(pattern)),
    }
}

fn find_program<I, S>(candidates: I) -> Option<PathBuf>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    candidates.into_iter().find_map(|candidate| {
        let path = PathBuf::from(candidate.as_ref());
        if path.is_absolute() {
            path.exists().then_some(path)
        } else {
            which_in_path(&path)
        }
    })
}

fn which_in_path(command: &PathBuf) -> Option<PathBuf> {
    if command.exists() {
        return Some(command.clone());
    }

    std::env::var_os("PATH").and_then(|paths| {
        std::env::split_paths(&paths).find_map(|path| {
            let candidate = path.join(command);
            if candidate.exists() {
                Some(candidate)
            } else if cfg!(windows) && command.extension().is_none() {
                let exe_candidate = path.join(format!("{}.exe", command.to_string_lossy()));
                exe_candidate.exists().then_some(exe_candidate)
            } else {
                None
            }
        })
    })
}
