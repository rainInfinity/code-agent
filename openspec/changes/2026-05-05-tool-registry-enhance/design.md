## 设计决策

### 1. 三层条件注册

```
编译期 cfg(feature = "...")  →  模块级 DCE，不编译进二进制
模块加载时 env var 检查      →  内部版/外部版区分
运行时 isEnabled()           →  动态 feature flag / 模型兼容性
       ↓
  deny rules 过滤            →  权限配置中禁用的工具
```

| 层级 | 时机 | 机制 | 适用场景 |
|------|------|------|---------|
| 编译期 | `#[cfg(feature)]` | Rust 条件编译 | 内部版 vs 外部版构建 |
| 加载期 | 模块初始化 | `env::var()` 检查 | 企业内网 vs 社区版 |
| 运行时 | `is_enabled()` | trait 方法调用 | GrowthBook flag / 模型兼容 |
| deny rules | 过滤时 | 配置匹配 | 用户显式禁用工具 |

### 2. get_enabled_tools 实现

```rust
pub fn get_enabled_tools(&self) -> Vec<Arc<dyn Tool>> {
    self.tools.values()
        .filter(|t| t.is_enabled())              // 第三层: 运行时
        .filter(|t| self.apply_deny_rules(t))    // deny rules
        .cloned()
        .collect()
}
```

编译期和加载期过滤已在 `register()` 时完成（不注册就不在 `tools` map 中）。

### 3. Deny Rules

```rust
pub struct DenyRule {
    /// 工具名称匹配模式（支持通配符）
    pub tool_pattern: String,
    /// 原因说明
    pub reason: String,
}

impl ToolRegistry {
    pub fn set_deny_rules(&mut self, rules: Vec<DenyRule>) { ... }
    
    fn apply_deny_rules(&self, tool: &Arc<dyn Tool>) -> bool {
        for rule in &self.deny_rules {
            if fnmatch(&rule.tool_pattern, &tool.name()) {
                return false;
            }
        }
        true
    }
}
```

简洁设计：支持简单的通配符匹配（`*` / `?`），不引入正则依赖。后续扩展可替换为 regex。

### 4. assemble_tool_pool 排序约束

```rust
pub fn assemble_tool_pool(
    built_in: &[Arc<dyn Tool>],
    mcp_tools: &[Arc<dyn Tool>],
) -> Vec<Arc<dyn Tool>>
```

关键设计：built-in 工具在前、MCP 工具在后，各自内部按 name 排序。原因：
- Anthropic API 在最后一个内置工具位置设置了 cache breakpoint
- 如果 MCP 工具混入内置工具区间，会导致下游 cache key 全部失效

### 5. definitions() 改用 get_enabled_tools()

```rust
// Before:
pub fn definitions(&self) -> Vec<ToolDefinition> {
    self.tools.values().map(|tool| { ... }).collect()
}

// After:
pub fn definitions(&self) -> Vec<ToolDefinition> {
    self.get_enabled_tools().iter().map(|tool| { ... }).collect()
}
```

这样 Agent Loop 中 `session.tool_registry.definitions()` 自动获得过滤后的工具列表。
