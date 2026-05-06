## 1. 基础类型定义

- [x] 1.1 在 `tools/mod.rs` 中定义 `RiskLevel` 枚举（Safe / Moderate / Dangerous），派生 `Debug`、`Clone`、`PartialEq`、`Eq`
- [x] 1.2 在 `tools/mod.rs` 中定义 `ToolMeta` 结构体（7 个字段），实现 `Default`，采用 fail-closed 配置
- [x] 1.3 在 `tools/mod.rs` 中定义 `ToolContext` 结构体（`workspace_root`、`allowed_paths`、`env_vars`、`cancellation`）
- [x] 1.4 在 `tools/mod.rs` 中定义 `PermissionResult` 枚举（`Allow` / `Deny(String)` / `AskUser { description: String }`）

## 2. 扩展 Tool trait

- [x] 2.1 新增 `fn meta(&self) -> ToolMeta` 默认方法
- [x] 2.2 新增 `fn is_read_only(&self, params: &Value) -> bool` 默认方法
- [x] 2.3 新增 `fn is_concurrency_safe(&self, params: &Value) -> bool` 默认方法
- [x] 2.4 新增 `fn is_destructive(&self, params: &Value) -> bool` 默认方法
- [x] 2.5 新增 `fn is_enabled(&self) -> bool` 默认方法
- [x] 2.6 新增 `async fn validate_input(&self, params: &Value, ctx: &ToolContext) -> Result<(), String>` 默认方法
- [x] 2.7 新增 `async fn check_permissions(&self, params: &Value, ctx: &ToolContext) -> PermissionResult` 默认方法
- [x] 2.8 新增 `fn search_hint(&self) -> &str` 默认方法
- [x] 2.9 新增 `fn aliases(&self) -> &[&str]` 默认方法
- [x] 2.10 新增 `fn user_facing_name(&self, params: &Value) -> String` 默认方法
- [x] 2.11 新增 `fn get_path(&self, params: &Value) -> Option<String>` 默认方法
- [x] 2.12 新增 `fn max_result_size_chars(&self) -> usize` 默认方法

## 3. 模型导出

- [x] 3.1 在 `models.rs` 中重新导出或引用 `RiskLevel`、`ToolMeta`、`ToolContext`、`PermissionResult`（如前端需要）

## 4. 测试

- [x] 4.1 验证 `ToolMeta::default()` 所有字段值与设计文档一致
- [x] 4.2 验证新增 trait 方法在最小实现（仅实现 5 个必需方法）的 `Tool` 上可正常调用
- [x] 4.3 验证 `with_defaults()` 测试不受影响（仍返回空注册表）
