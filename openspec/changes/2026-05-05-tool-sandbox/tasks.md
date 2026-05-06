## 1. SandboxConfig

- [x] 1.1 创建 `src-tauri/src/tools/sandbox.rs`
- [x] 1.2 定义 `SandboxConfig` 结构体（allowed_prefixes, blocked_commands, blocked_patterns）
- [x] 1.3 实现 `Default` trait（预置常用危险命令黑名单）
- [x] 1.4 实现 `validate(&self, tool_name: &str, params: &Value) -> Result<(), String>`
- [x] 1.5 实现 `check_path(&self, path: &str) -> Result<(), String>`（canonicalize + 前缀检查）
- [x] 1.6 实现 `check_command(&self, command: &str) -> Result<(), String>`（黑名单 + 正则）

## 2. 模块注册

- [x] 2.1 在 `tools/mod.rs` 中声明 `pub mod sandbox;`

## 3. Executor 集成

- [x] 3.1 `ToolExecutor` 新增 `sandbox: Option<SandboxConfig>` 字段
- [x] 3.2 `execute_one` 中在 `validate_input` 之后、`execute` 之前调用 `sandbox.validate(tool_name, params)`
- [x] 3.3 `sandbox` 为 `None` 时跳过检查（开发/信任环境）

## 4. 文件工具集成

- [x] 4.1 确保 ReadFileTool/WriteFileTool/EditFileTool 的 `validate_input` 消费 `ctx.allowed_paths`

## 5. 测试

- [x] 5.1 测试 `check_path`：路径在白名单内 → 通过，路径在白名单外 → 拒绝
- [x] 5.2 测试 `check_command`：`rm -rf /` → 拒绝，`echo hello` → 通过
- [x] 5.3 测试 `allowed_prefixes` 为空时所有路径通过
- [x] 5.4 测试正则模式匹配：`format-c /dev/sda1` → 拒绝
- [x] 5.5 测试沙箱为 None 时跳过检查
- [x] 5.6 `cargo test` 全部通过
