## DenyRule — 工具禁用规则

### 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `tool_pattern` | `String` | 工具名称匹配模式，支持 `*`（任意字符）和 `?`（单字符）通配符 |
| `reason` | `String` | 禁用原因说明 |

### 示例

```rust
DenyRule { tool_pattern: "bash".to_string(), reason: "Shell 命令已禁用".into() }
DenyRule { tool_pattern: "web_*".to_string(), reason: "网络工具已禁用".into() }
```

---

## set_deny_rules — 设置禁用规则

### 签名

```rust
pub fn set_deny_rules(&mut self, rules: Vec<DenyRule>)
```

### 行为

- 替换现有的 deny rules 列表
- 传入空 Vec 表示清除所有 deny rules

---

## get_enabled_tools — 获取已启用的工具

### 签名

```rust
pub fn get_enabled_tools(&self) -> Vec<Arc<dyn Tool>>
```

### 过滤顺序

1. `tool.is_enabled()` — 运行时动态判断（如 GrowthBook flag、模型兼容性）
2. `apply_deny_rules(tool)` — deny rules 匹配过滤

### 约束

- 编译期和加载期过滤不在本方法中进行（依赖已在 `register()` 阶段排除）
- 返回的 Vec 按 name 字母序排列（通过 BTreeMap 或事后排序）

---

## assemble_tool_pool — 组装完整工具池

### 签名

```rust
pub fn assemble_tool_pool(
    built_in: &[Arc<dyn Tool>],
    mcp_tools: &[Arc<dyn Tool>],
) -> Vec<Arc<dyn Tool>>
```

### 行为

1. 对 built_in 工具按 name 排序
2. 对 mcp_tools 按 name 排序
3. 返回 `[sorted_builtin..., sorted_mcp...]` — built-in 在前，MCP 在后

### 约束

- **不混合排序：** built-in 和 MCP 工具各自独立排序后拼接，不混合
- 原因：API 在最后一个 built-in 工具位置设置了 cache breakpoint，MCP 混入会破坏缓存

---

## definitions() 行为变更

### 变更前

```rust
pub fn definitions(&self) -> Vec<ToolDefinition> {
    self.tools.values().map(|tool| { ... }).collect()
}
```

返回所有已注册工具的定义，不做过滤。

### 变更后

```rust
pub fn definitions(&self) -> Vec<ToolDefinition> {
    self.get_enabled_tools().iter().map(|tool| { ... }).collect()
}
```

返回经过 `is_enabled()` + deny rules 过滤后的工具定义。
