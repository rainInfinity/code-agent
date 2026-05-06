## 1. Deny Rules 机制

- [x] 1.1 在 `tools/mod.rs` 中定义 `DenyRule` 结构体（`tool_pattern`、`reason`）
- [x] 1.2 `ToolRegistry` 新增 `deny_rules: Vec<DenyRule>` 字段
- [x] 1.3 实现 `set_deny_rules(&mut self, rules: Vec<DenyRule>)` 方法
- [x] 1.4 实现 `apply_deny_rules(&self, tool: &Arc<dyn Tool>) -> bool` 通配符匹配

## 2. 三层过滤

- [x] 2.1 实现 `get_enabled_tools(&self) -> Vec<Arc<dyn Tool>>`
- [x] 2.2 集成 `tool.is_enabled()` 第三层运行时过滤
- [x] 2.3 集成 deny rules 过滤

## 3. 工具池组装

- [x] 3.1 实现 `assemble_tool_pool(built_in, mcp_tools) -> Vec<Arc<dyn Tool>>` 静态方法
- [x] 3.2 确保 built-in 在前、MCP 在后，各自内部按 `name` 排序

## 4. definitions() 更新

- [x] 4.1 在 `definitions()` 内部改为调用 `get_enabled_tools()`，而非直接遍历 `self.tools`

## 5. 测试

- [x] 5.1 测试 `get_enabled_tools` 尊重 `is_enabled()` 返回值
- [x] 5.2 测试 deny rules 通配符匹配正确过滤
- [x] 5.3 测试 deny rules 清空后所有工具恢复可用
- [x] 5.4 测试 `assemble_tool_pool` 排序正确（built-in 在前，各自按名字母序）
- [x] 5.5 测试 `definitions()` 返回过滤后的结果
- [x] 5.6 `cargo test` 全部通过
