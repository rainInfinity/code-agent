## Context

当前 Rust 后端采用 Tauri v2，技术栈为 `tauri 2.x` + `tokio` + `reqwest` + `serde`。架构采用 Core-Shell 模式：Rust 后端通过 `#[tauri::command]` 暴露 IPC 接口，通过 `app.emit()` 推送事件到前端。代码组织上，`agent/`、`prompt/`、`providers/`、`tools/` 四个模块已实现良好的模块化，但 Tauri 胶水层（`lib.rs`、`commands.rs`、`models.rs`）仍是快速迭代期的单文件风格。

参照 understanding-tauri-architecture 的最佳实践——命令按模块组织、窗口管理独立子系统、事件集中管理——进行代码重组。

## Goals / Non-Goals

**Goals:**
- 将 `lib.rs` 缩减至 80 行以内，仅保留模块声明和 `run()` 入口
- 将 `commands.rs` 按功能域拆分为 5 个独立文件
- 将 `models.rs` 按领域拆分为 5 个独立类型模块
- 创建 `events.rs` 集中管理事件名称常量
- 创建 `window/` 独立子系统模块
- 创建 `state.rs` 独立管理 AppState
- 消除 `lib.rs` 和 `commands.rs` 之间的常量重复定义
- `cargo check --lib` 零错误，所有现有测试通过

**Non-Goals:**
- 不改变任何功能行为或 IPC 接口
- 不引入新的依赖 crate
- 不重构 `agent/`、`prompt/`、`providers/`、`tools/` 模块（已良好模块化）
- 不改变 `Cargo.toml` 依赖配置
- 不添加新功能
- 不修改前端代码

## Decisions

### 1. 命令拆分粒度：按功能域，5 个文件

选择按功能域拆分 `commands.rs` 为 5 个文件：

| 文件 | 内容 | 命令数 |
|------|------|--------|
| `commands/chat.rs` | `send_message`, `stop_streaming` | 2 |
| `commands/agent.rs` | `run_agent`, `stop_agent` | 2 |
| `commands/trace.rs` | `open_trace_window`, `hide_trace_window`, `close_trace_window`, `is_trace_window_open` | 4 |
| `commands/docking.rs` | `set_trace_docking_mode`, `exit_trace_docking`, `sync_trace_docking_width`, `sync_trace_docking_to_main`, `hide_trace_for_main_minimize`, `set_trace_always_on_top`, `get_trace_docking_state` | 7 |
| `commands/settings.rs` | `save_settings`, `load_settings`, `list_models` | 3 |

`commands/mod.rs` 作为统一导出桶，`lib.rs` 通过 `commands::all_commands()` 一次性注册。

**替代方案**：一个命令一个文件 → 被否决，20 个文件过于碎片化，同类命令放在一起更直观。

### 2. 窗口子系统结构：3 个模块

将 `lib.rs` 中的窗口相关代码提取到 `window/` 模块：

```
window/
├── mod.rs          # 重新导出 + 公共常量 + TraceDockingSide 等枚举
├── state.rs        # WindowState 序列化/反序列化/恢复（~150 行，从 lib.rs 提取）
├── docking.rs      # Trace 停靠计算和状态管理（~300 行，从 lib.rs 提取）
└── lifecycle.rs    # 窗口事件监听、创建/关闭/最小化处理（~150 行，从 lib.rs 提取）
```

`mod.rs` 提供 `pub use` 重新导出，使外部仅需 `use crate::window::*`。

**替代方案**：单文件 `window.rs` → 被否决，500+ 行同样会膨胀，3 个文件保持每个文件 ≤300 行。

### 3. 类型拆分原则：按数据使用场景

`models/` 按"谁使用这些类型"拆分为 5 个文件：

| 文件 | 内容 | 使用者 |
|------|------|--------|
| `models/chat.rs` | ChatMessage, ContentBlock 枚举 | commands, agent, prompt |
| `models/api.rs` | AnthropicRequest, StreamEvent, OpenAiChatRequest, OpenAiChatResponse | llm, providers |
| `models/events.rs` | StreamDeltaEvent, ToolCallEvent, AgentTurnEvent 等 16 种事件负载 | commands, agent |
| `models/settings.rs` | ProviderSettings, PersistedSettings, SettingsResponse | commands |
| `models/tools.rs` | ToolResult, ToolDefinition, SessionContext | tools, agent |

`models/mod.rs` 作为统一导出桶，保持 `use crate::models::*` 可用。

**替代方案**：保持单文件但分段 → 被否决，拆分为独立文件的好处是每个文件与使用它的模块一一对应。

### 4. 事件常量化策略：`&str` 常量 + 事件负载类型共置

创建 `events.rs`，将事件名称定义为 `pub const` 字符串常量：

```rust
// events.rs
pub mod event_names {
    pub const STREAM_DELTA: &str = "stream-delta";
    pub const STREAM_ERROR: &str = "stream-error";
    pub const STREAM_END: &str = "stream-end";
    pub const TOOL_CALL: &str = "tool-call";
    pub const TOOL_RESULT: &str = "tool-result";
    pub const TOOL_TRACE: &str = "tool-trace";
    pub const AGENT_TURN: &str = "agent-turn";
    pub const AGENT_COMPLETE: &str = "agent-complete";
    pub const TRACE_PROMPT: &str = "trace-prompt";
    pub const THINKING_DELTA: &str = "thinking-delta";
    pub const TRACE_THINKING_START: &str = "trace-thinking-start";
    pub const TRACE_THINKING_END: &str = "trace-thinking-end";
    pub const AGENT_TURN_COMPLETE: &str = "agent-turn-complete";
    pub const TRACE_DOCKING_CHANGED: &str = "trace-docking-changed";
    pub const TRACE_WINDOW_CLOSED: &str = "trace-window-closed";
}
```

事件负载类型保留在 `models/events.rs` 中，与 `events.rs` 的常量配合使用。

**替代方案**：使用 enum → 被否决，`app.emit()` 的 API 需要 `&str`，用 enum 需要在每个调用点做 `.as_str()` 转换，增加噪音。

### 5. 模块可见性：最小化 `pub` 暴露

遵循 Rust 模块可见性最佳实践：
- `window/` 内部函数保持 `pub(crate)`，仅被 `commands/` 调用的标记为 `pub`
- `commands/` 中的命令函数必须为 `pub`（被 `generate_handler![]` 引用）
- `models/` 中的类型必须为 `pub`（跨模块使用）
- `events.rs` 中的常量标记为 `pub`

### 6. 常量消除方案：单一来源

将与 Trace 窗口相关的常量（`TRACE_WINDOW_LABEL`、`TRACE_DOCKING_*` 等）统一定义在 `window/mod.rs` 中，`commands/` 通过 `use crate::window::*` 引用。

与设置相关的常量（`SETTINGS_FILE`）定义在 `commands/settings.rs` 中，因为仅被该模块使用。

## Risks / Trade-offs

- **导入路径变更** → 风险：可能遗漏某些 `use` 语句更新。缓解：`cargo check` 编译器会捕获所有缺失导入
- **模块间循环引用** → 风险：`commands/` 可能形成循环依赖。缓解：`commands/mod.rs` 是纯导出桶，`commands/` 子文件仅依赖 `window/`、`models/`、`events/`、`state.rs`，不互相依赖
- **重构范围大** → 风险：一次变更涉及 15+ 文件。缓解：严格按 task 顺序执行，每个 task 完成后 `cargo check` 验证
- **合并冲突** → 风险：若主分支有并行的 Tauri 端改动。缓解：重构仅移动代码不修改逻辑，冲突解决简单（接受两边变更）
