# Permission System — 权限系统

> 返回 [总览](./agent-architecture-design.md) | 上一模块：[Task System](./task-system.md)

---

## 概述

Permission System 控制 Agent 的工具执行权限，确保危险操作（文件写入、命令执行、网络请求等）在用户知情和同意的前提下进行。它在 Agent 自主性和安全性之间取得平衡。

## 设计原则

1. **最小权限** — 每个 Agent 默认只能执行其定义中允许的工具
2. **分级控制** — Safe / Moderate / Dangerous 三级风险，对应不同批准策略
3. **记住选择** — 同类型操作可在本次会话中记住用户选择
4. **可覆盖** — 用户可在设置中自定义每个工具的权限级别

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                 Permission Manager                       │
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │              权限策略                            │     │
│  │                                                 │     │
│  │  AutoApprove  → 只读工具 (read_file, grep)      │     │
│  │  AskOnce      → 首次确认后本次会话记住           │     │
│  │  AskAlways    → 每次执行前确认 (bash, delete)   │     │
│  │  NeverAllow   → 完全禁止                        │     │
│  └────────────────────────────────────────────────┘     │
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │            确认流程（Rust ↔ 前端）               │     │
│  │                                                 │     │
│  │  Rust: 发起 permission-request 事件              │     │
│  │         │                                       │     │
│  │         ▼                                       │     │
│  │  前端: 显示确认弹窗                              │     │
│  │         │                                       │     │
│  │         ▼                                       │     │
│  │  Rust: respond_permission 命令                   │     │
│  │         │                                       │     │
│  │         ▼                                       │     │
│  │  继续执行 或 拒绝报错                            │     │
│  └────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

## 核心数据结构

### 权限策略

```rust
/// 权限策略（Agent 级别配置）
#[derive(Debug, Clone)]
enum PermissionPolicy {
    /// 所有安全工具自动批准，危险工具按默认策略
    AutoApprove,
    /// 所有危险操作都需要用户确认
    AskAll,
    /// 每种工具类型在本次会话中只问一次
    AskPerSession,
    /// 完全自定义策略
    Custom(HashMap<String, PermissionLevel>),
}

/// 单工具权限级别
#[derive(Debug, Clone, PartialEq, Eq)]
enum PermissionLevel {
    /// 始终允许，无需确认
    AlwaysAllow,
    /// 本次会话首问，后续记住选择
    AskOnce,
    /// 每次执行都需要确认
    AskAlways,
    /// 完全禁止执行
    NeverAllow,
}

#[derive(Debug, Clone)]
enum PermissionResult {
    /// 批准执行
    Allow,
    /// 拒绝执行（含原因）
    Deny(String),
}
```

### PermissionManager

```rust
struct PermissionManager {
    /// Agent 级别的权限策略
    policy: PermissionPolicy,
    /// 工具级别的覆盖配置
    overrides: HashMap<String, PermissionLevel>,
    /// 本次会话的批准决定缓存
    session_decisions: HashMap<String, bool>,
    /// 事件发射器（通知前端）
    emitter: Arc<dyn PermissionEventEmitter>,
}

impl PermissionManager {
    /// 检查工具执行是否需要用户确认
    async fn check(
        &mut self,
        tool_name: &str,
        params: &Value,
        tool_meta: &ToolMeta,
    ) -> Result<PermissionResult, String> {
        let level = self.effective_level(tool_name, tool_meta);

        match level {
            PermissionLevel::AlwaysAllow => {
                Ok(PermissionResult::Allow)
            }

            PermissionLevel::NeverAllow => {
                Ok(PermissionResult::Deny(
                    format!("Tool '{}' is blocked by policy", tool_name)
                ))
            }

            PermissionLevel::AskOnce => {
                // 检查是否已经做过决定
                if let Some(&approved) = self.session_decisions.get(tool_name) {
                    return if approved {
                        Ok(PermissionResult::Allow)
                    } else {
                        Ok(PermissionResult::Deny("Previously denied by user".into()))
                    };
                }
                // 首次使用 → 询问用户
                self.request_user_approval(tool_name, params, tool_meta).await
            }

            PermissionLevel::AskAlways => {
                // 每次都询问（不检查缓存）
                self.request_user_approval(tool_name, params, tool_meta).await
            }
        }
    }

    /// 计算工具的有效权限级别
    fn effective_level(&self, tool_name: &str, meta: &ToolMeta) -> PermissionLevel {
        // 1. 先查工具级别的覆盖配置
        if let Some(level) = self.overrides.get(tool_name) {
            return level.clone();
        }

        // 2. 根据 Agent 策略 + 工具风险等级决定
        match &self.policy {
            PermissionPolicy::AutoApprove => {
                match meta.risk_level {
                    RiskLevel::Safe => PermissionLevel::AlwaysAllow,
                    RiskLevel::Moderate => PermissionLevel::AskOnce,
                    RiskLevel::Dangerous => PermissionLevel::AskAlways,
                }
            }
            PermissionPolicy::AskAll => PermissionLevel::AskAlways,
            PermissionPolicy::AskPerSession => PermissionLevel::AskOnce,
            PermissionPolicy::Custom(defaults) => {
                defaults.get(tool_name)
                    .cloned()
                    .unwrap_or(PermissionLevel::AskAlways)
            }
        }
    }
}
```

## 用户确认交互流程

```
┌──────────────────────────────────────────────────────────┐
│         Rust Backend                  Frontend            │
│              │                            │               │
│              │  permission-request        │               │
│              │──────────────────────────→│               │
│              │                            │               │
│              │  {                         │               │
│              │    request_id: "req_01",   │               │
│              │    tool: "bash",           │               │
│              │    params: {               │               │
│              │      command: "npm i -D    │               │
│              │        react-router-dom"   │               │
│              │    },                      │               │
│              │    risk: "Dangerous",      │               │
│              │    reason: "安装npm包"     │               │
│              │  }                         │               │
│              │                            │               │
│              │                    ┌───────┴────────┐     │
│              │                    │ ⚠️ 权限请求     │     │
│              │                    │                │     │
│              │                    │ Bash:          │     │
│              │                    │ npm i -D       │     │
│              │                    │ react-router   │     │
│              │                    │                │     │
│              │                    │ 风险: ⚠️ 危险  │     │
│              │                    │                │     │
│              │                    │ [允许] [拒绝]  │     │
│              │                    │ ☐ 记住此选择   │     │
│              │                    └───────┬────────┘     │
│              │                            │               │
│              │  respond_permission       │               │
│              │←──────────────────────────│               │
│              │                            │               │
│              │  {                         │               │
│              │    request_id: "req_01",   │               │
│              │    approved: true,         │               │
│              │    remember: true          │               │
│              │  }                         │               │
│              │                            │               │
│              ├─ 继续执行 npm install       │               │
│              │                            │               │
└──────────────────────────────────────────────────────────┘
```

### 超时处理

```rust
/// 权限确认超时
const PERMISSION_TIMEOUT_SECS: u64 = 120; // 2 分钟

impl PermissionManager {
    async fn request_user_approval(
        &mut self,
        tool_name: &str,
        params: &Value,
        meta: &ToolMeta,
    ) -> Result<PermissionResult, String> {
        let request_id = Uuid::new_v4().to_string();

        // 发送权限请求事件
        self.emitter.emit_permission_request(
            &request_id,
            tool_name,
            params,
            meta.risk_level.clone(),
        );

        // 等待用户响应（带超时）
        let result = tokio::time::timeout(
            Duration::from_secs(PERMISSION_TIMEOUT_SECS),
            self.wait_for_response(&request_id),
        ).await;

        match result {
            Ok(Ok(response)) => {
                if response.remember {
                    self.session_decisions.insert(
                        tool_name.to_string(),
                        response.approved,
                    );
                }
                Ok(if response.approved {
                    PermissionResult::Allow
                } else {
                    PermissionResult::Deny("User denied the request".into())
                })
            }
            Ok(Err(e)) => Err(e),
            Err(_) => Ok(PermissionResult::Deny(
                "Permission request timed out".into()
            )),
        }
    }
}
```

## 默认风险等级分配

```rust
/// 内置工具的默认风险等级
fn default_risk_level(tool_name: &str) -> RiskLevel {
    match tool_name {
        // 只读操作 → Safe
        "read_file" | "grep" | "glob" | "list_directory"
        | "git_diff" | "git_log" | "git_status"
        | "read_lints" | "lsp_goto_def" | "lsp_references" => RiskLevel::Safe,

        // 网络操作 → Moderate
        "web_search" | "web_fetch" => RiskLevel::Moderate,

        // 写入/执行 → Dangerous
        "write_file" | "edit_file" | "delete_file"
        | "bash" | "powershell" | "run_tests"
        | "format_code" => RiskLevel::Dangerous,

        _ => RiskLevel::Dangerous, // 未知工具默认危险
    }
}
```

## 前端 Permission Dialog

```typescript
// src/permission/PermissionDialog.tsx
interface PermissionRequest {
  requestId: string;
  tool: string;
  params: Record<string, unknown>;
  risk: 'Safe' | 'Moderate' | 'Dangerous';
}

function PermissionDialog({ request, onRespond }: Props) {
  const [remember, setRemember] = useState(false);

  return (
    <Dialog>
      <DialogTitle>
        {getRiskIcon(request.risk)} 权限请求
      </DialogTitle>
      <DialogContent>
        <ToolName>{request.tool}</ToolName>
        <ParamPreview>
          {formatParams(request.params)}
        </ParamPreview>
        <RiskBadge level={request.risk}>
          风险等级: {request.risk}
        </RiskBadge>
      </DialogContent>
      <DialogActions>
        <Checkbox checked={remember} onChange={setRemember}>
          记住此选择（本次会话）
        </Checkbox>
        <Button variant="secondary" onClick={() => onRespond(false)}>
          拒绝
        </Button>
        <Button variant="primary" onClick={() => onRespond(true)}>
          允许
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

## 用户设置中的权限配置

```
┌────────────────────────────────────────────────┐
│  权限设置                                       │
│                                                │
│  默认策略: [每次询问 ▾]                         │
│                                                │
│  工具权限覆盖:                                   │
│  ┌──────────────────────────────────────────┐  │
│  │ 📖 read_file     [始终允许 ▾]            │  │
│  │ 🔍 grep           [始终允许 ▾]            │  │
│  │ ✏️ write_file     [每次询问 ▾]            │  │
│  │ ⚡ bash           [每次询问 ▾]            │  │
│  │ 🗑️ delete_file   [始终禁止 ▾]            │  │
│  │ 🌐 web_search    [首次询问 ▾]            │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  [恢复默认]                  [保存设置]         │
└────────────────────────────────────────────────┘
```

## 与 Agent Runtime 的集成

在 [Agent Runtime](./agent-runtime.md) 的 Agent Loop 中，每个工具调用前都经过权限检查：

```rust
// Agent Loop 中的调用点
for tc in &tool_calls {
    // 1. 权限检查（同步/异步）
    let approved = permission_manager
        .check(&tc.name, &tc.input, &tool.meta())
        .await?;

    match approved {
        PermissionResult::Allow => {
            // 2. 执行工具
            let result = tool_executor.execute(&tc.name, &tc.input).await;
            session.add_tool_result(tc.id.clone(), result);
        }
        PermissionResult::Deny(reason) => {
            // 3. 记录拒绝信息
            let result = ToolResult {
                success: false,
                output: String::new(),
                error: Some(reason),
            };
            session.add_tool_result(tc.id.clone(), result);
        }
    }
}
```

---

> 上一模块：[Task System](./task-system.md)
> 返回 [总览](./agent-architecture-design.md)
