## 1. 搜索模块骨架

- [x] 1.1 创建 `src-tauri/src/tools/search/mod.rs`，定义工具名称常量
- [x] 1.2 在 `tools/mod.rs` 中声明 `pub mod search;`

## 2. GrepTool

- [x] 2.1 创建 `search/grep.rs`，实现 `GrepTool`
- [x] 2.2 支持 `pattern`、`path`、`glob`、`output_mode`、`head_limit`、`-i` 参数
- [x] 2.3 使用 `regex` crate 和文件遍历实现内容搜索
- [x] 2.4 `output_mode` 支持 `content` / `files_with_matches` / `count`
- [x] 2.5 默认 `head_limit=250`
- [x] 2.6 覆盖 `meta()` 为 `Safe` 且可并发

## 3. GlobTool

- [x] 3.1 创建 `search/glob.rs`，实现 `GlobTool`
- [x] 3.2 使用 `glob` crate 实现文件名模式匹配
- [x] 3.3 结果按修改时间排序
- [x] 3.4 覆盖 `meta()` 为 `Safe` 且可并发

## 4. ListDirectoryTool

- [x] 4.1 创建 `search/list_dir.rs`，实现 `ListDirectoryTool`
- [x] 4.2 支持 `depth`、`offset`、`limit` 参数
- [x] 4.3 默认深度为 2，返回上限为 200
- [x] 4.4 自动跳过 `.git`、`node_modules`、`target`
- [x] 4.5 覆盖 `meta()` 为 `Safe` 且可并发

## 5. Shell 模块骨架

- [x] 5.1 创建 `src-tauri/src/tools/shell/mod.rs`，定义工具名称常量
- [x] 5.2 在 `tools/mod.rs` 中声明 `pub mod shell;`

## 6. BashTool

- [x] 6.1 创建 `shell/bash.rs`，实现 `BashTool`
- [x] 6.2 执行命令并捕获 stdout / stderr / exit code
- [x] 6.3 超时后强制终止子进程
- [x] 6.4 覆盖 `meta()` 为 `Dangerous + needs_approval`
- [x] 6.5 覆盖 `is_read_only(input)` 进行命令语义分析
- [x] 6.6 覆盖 `check_permissions` 拒绝危险命令模式

## 7. PowerShellTool

- [x] 7.1 创建 `shell/powershell.rs`，实现 `PowerShellTool`
- [x] 7.2 使用 `powershell.exe -NonInteractive -Command` 执行
- [x] 7.3 实现与 BashTool 类似的安全检查，并适配 PowerShell 语法
- [x] 7.4 覆盖 `meta()` 为 `Dangerous + needs_approval`

## 8. 注册

- [x] 8.1 在 `with_defaults()` 中注册全部 5 个工具
- [x] 8.2 更新 `defaults_do_not_expose_test_tools` 测试

## 9. 测试

- [x] 9.1 GrepTool：基础搜索、glob 过滤、count 模式、无匹配
- [x] 9.2 GlobTool：模式匹配、结果排序
- [x] 9.3 ListDirectoryTool：树结构、深度限制、忽略目录
- [x] 9.4 BashTool：简单命令、超时、错误命令
- [x] 9.5 PowerShellTool：基础 cmdlet 执行（仅 Windows）
- [x] 9.6 验证 `with_defaults()` 包含全部工具
- [x] 9.7 `cargo test` 全部通过
