## 设计决策

### 1. 渐进扩展：所有新方法带默认实现

当前只有一个 `Tool` trait 被 `AgentRuntime` 使用。为保持向后兼容，所有新增方法均提供合理的默认实现：

```rust
// 安全相关 — 默认保守策略
fn meta(&self) -> ToolMeta { ToolMeta::default() }        // fail-closed
fn is_read_only(&self, _params: &Value) -> bool { self.meta().is_read_only }
fn is_concurrency_safe(&self, _params: &Value) -> bool { self.meta().is_concurrency_safe }
fn is_destructive(&self, _params: &Value) -> bool { self.meta().is_destructive }
fn is_enabled(&self) -> bool { true }

// 校验/权限 — 默认放行（工具自行覆盖）
async fn validate_input(&self, _params: &Value, _ctx: &ToolContext) -> Result<(), String> { Ok(()) }
async fn check_permissions(&self, _params: &Value, _ctx: &ToolContext) -> PermissionResult { PermissionResult::Allow }

// 辅助方法 — 默认空/回退
fn search_hint(&self) -> &str { "" }
fn aliases(&self) -> &[&str] { &[] }
fn user_facing_name(&self, params: &Value) -> String { self.name() }
fn get_path(&self, _params: &Value) -> Option<String> { None }
fn max_result_size_chars(&self) -> usize { self.meta().max_output_bytes as usize }
```

**关键点:** `execute()` 签名不变——保持 `async fn execute(&self, params: Value) -> Result<ToolResult, String>`。`ToolContext` 在此阶段仅定义为类型，不强制传入 execute，等 Proposal 2 中 ToolExecutor 再负责注入 context。

**实际设计调整:** 对比设计文档，本次不会立即将 `execute` 签名改为 `execute(params, &ToolContext)`。原因：
- 当前 `agent_loop` 直接调用 `executor.execute(tool, input)` 
- `ToolContext` 的构建逻辑在 `agent_loop` 层级，目前没有足够的上下文信息
- 在 Proposal 1 中定义类型，在 Proposal 2 中由 `ToolExecutor::execute_one` 负责构造 `ToolContext` 并注入

### 2. ToolMeta::default() 的 fail-closed 原则

```rust
impl Default for ToolMeta {
    fn default() -> Self {
        Self {
            risk_level: RiskLevel::Dangerous,   // 默认最高风险
            needs_approval: true,               // 默认需要用户确认
            timeout_ms: 120_000,                // 默认 2 分钟超时
            max_output_bytes: 100_000,          // 默认 100KB 截断
            is_concurrency_safe: false,         // 默认不能并发
            is_read_only: false,                // 默认假设写入
            is_destructive: false,              // 默认非破坏性（需显式声明）
        }
    }
}
```

工具作者必须显式声明安全能力，忘记声明 = 最保守处理 = 安全。

### 3. RiskLevel 三档分级

| 等级 | 含义 | 示例 |
|------|------|------|
| `Safe` | 只读操作，无副作用 | read_file, grep, glob |
| `Moderate` | 网络请求，可能暴露信息 | web_search, web_fetch |
| `Dangerous` | 写入文件或执行命令 | write_file, bash |

### 4. ToolContext 暂不接入 execute

本提案只定义 `ToolContext` 类型及其字段，但**不修改 `execute()` 签名**。原因：
- 当前没有具体工具实现，改动签名为时过早
- `ToolContext` 的构造需要 `workspace_root`、沙箱配置等，这些信息当前分散在 `AgentSession` 各处
- 在 Proposal 2（并发执行框架）中，`ToolExecutor::execute_one` 内部构造 `ToolContext`，具体工具在 Proposal 4/5 实现时才开始消费它
