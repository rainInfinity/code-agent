# tool-sandbox Specification

## ADDED Requirements

### Requirement: SandboxConfig — 沙箱配置

| 字段 | 类型 | 说明 |
|------|------|------|
| `allowed_prefixes` | `Vec<PathBuf>` | 允许的路径前缀（所有文件操作必须在此范围内） |
| `blocked_commands` | `Vec<String>` | 禁止的完整命令名或子串 |
| `blocked_patterns` | `Vec<String>` | 禁止的命令参数正则模式 |

默认配置：
```rust
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
                ":(){ :|:& };:".into(),  // fork bomb
            ],
            blocked_patterns: vec![
                r">\s*/dev/sd[a-z]".into(),
                r"format-\w+\s+/[a-z]".into(),
            ],
        }
    }
}
```

### Requirement: validate — 沙箱检查

```rust
fn validate(&self, tool_name: &str, params: &Value) -> Result<(), String>
```

按工具名分类：
- **read_file / write_file / edit_file / delete_file** → `check_path(path)`
- **bash / powershell** → `check_command(command)`
- **其他工具（grep, glob, list_directory, web_*）** → 跳过沙箱检查

### Requirement: check_path — 路径白名单检查

```rust
fn check_path(&self, path: &str) -> Result<(), String>
```

行为：
1. 解析路径为绝对路径（`canonicalize`）
2. 检查是否以任一 `allowed_prefixes` 为前缀
3. 不在白名单内 → 返回 `Err("Path '{path}' is outside allowed workspace")`
4. `allowed_prefixes` 为空 → 默认允许所有路径（沙箱未启用）

### Requirement: check_command — 命令黑名单检查

```rust
fn check_command(&self, command: &str) -> Result<(), String>
```

行为：
1. 遍历 `blocked_commands`，若命令中包含黑名单字符串 → 返回拒绝
2. 遍历 `blocked_patterns`，若正则匹配 → 返回拒绝
3. 全部通过 → 允许执行

错误信息：
- 黑名单命中：`"Command '{matched}' is blocked"`
- 模式匹配：`"Command matches blocked pattern: {pattern}"`
