## 1. 模块骨架

- [x] 1.1 创建 `src-tauri/src/tools/file/mod.rs`，定义工具名称常量
- [x] 1.2 在 `tools/mod.rs` 中声明 `pub mod file;`

## 2. ReadFileTool

- [x] 2.1 创建 `read_file.rs`，实现 `ReadFileTool` 结构体
- [x] 2.2 实现 `Tool` trait 必需方法（name, description, parameters_schema, execute）
- [x] 2.3 覆盖 `meta()` 返回 Safe 配置（is_read_only=true, is_concurrency_safe=true）
- [x] 2.4 实现 `validate_input`：检查 file_path 非空 + 沙箱路径检查
- [x] 2.5 实现 `user_facing_name`：返回 "读取 {file_name}"
- [x] 2.6 实现 `search_hint` 和 `aliases`
- [x] 2.7 支持 offset/limit 行范围读取
- [x] 2.8 图片/PDF 文件检测（V1 返回文件信息 + 提示）

## 3. WriteFileTool

- [x] 3.1 创建 `write_file.rs`，实现 `WriteFileTool` 结构体
- [x] 3.2 实现 `Tool` trait 必需方法
- [x] 3.3 覆盖 `meta()` 返回 Dangerous 配置（needs_approval=true）
- [x] 3.4 实现 `validate_input`：检查 file_path 非空 + 权限 + 非目录
- [x] 3.5 自动创建父目录（`std::fs::create_dir_all`）
- [x] 3.6 实现 `user_facing_name`、`search_hint`、`aliases`

## 4. EditFileTool

- [x] 4.1 创建 `edit_file.rs`，实现 `EditFileTool` 结构体
- [x] 4.2 实现 `Tool` trait 必需方法
- [x] 4.3 覆盖 `meta()` 返回 Dangerous 配置（needs_approval=true）
- [x] 4.4 精确字符串匹配逻辑：计数匹配次数，0→错误，>1 且非 replace_all→错误
- [x] 4.5 支持 `replace_all` 参数
- [x] 4.6 实现 `validate_input`：检查所有必填参数 + 沙箱路径
- [x] 4.7 实现 `user_facing_name`、`search_hint`、`aliases`

## 5. 注册

- [x] 5.1 `with_defaults()` 中注册 ReadFileTool、WriteFileTool、EditFileTool
- [x] 5.2 更新 `defaults_do_not_expose_test_tools` 测试

## 6. 测试

- [x] 6.1 ReadFileTool：读取存在的文件、不存在的文件、行范围、空文件
- [x] 6.2 WriteFileTool：创建新文件、覆盖已有文件、权限不足场景
- [x] 6.3 EditFileTool：唯一匹配替换、无匹配报错、多匹配报错、replace_all 全部替换
- [x] 6.4 验证 with_defaults() 返回 3 个工具
- [x] 6.5 `cargo test` 全部通过
