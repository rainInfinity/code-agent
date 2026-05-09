## tauri-event-constants

IPC 事件名称常量化规范：将所有 Tauri 事件名称字符串字面量集中定义为 `&'static str` 常量，消除散布在代码中的魔法字符串。

### 常量定义

项目 SHALL 在 `events.rs` 中定义 `event_names` 模块，包含以下常量：

```rust
pub mod event_names {
    // 流式响应事件
    pub const STREAM_DELTA: &str = "stream-delta";
    pub const THINKING_DELTA: &str = "thinking-delta";
    pub const STREAM_ERROR: &str = "stream-error";
    pub const STREAM_END: &str = "stream-end";

    // 工具调用事件
    pub const TOOL_CALL: &str = "tool-call";
    pub const TOOL_RESULT: &str = "tool-result";
    pub const TOOL_TRACE: &str = "tool-trace";

    // Agent 生命周期事件
    pub const AGENT_TURN: &str = "agent-turn";
    pub const AGENT_TURN_COMPLETE: &str = "agent-turn-complete";
    pub const AGENT_COMPLETE: &str = "agent-complete";

    // Thinking 追踪事件
    pub const TRACE_PROMPT: &str = "trace-prompt";
    pub const TRACE_THINKING_START: &str = "trace-thinking-start";
    pub const TRACE_THINKING_END: &str = "trace-thinking-end";

    // 窗口事件
    pub const TRACE_DOCKING_CHANGED: &str = "trace-docking-changed";
    pub const TRACE_WINDOW_CLOSED: &str = "trace-window-closed";
}
```

### 使用规范

- 所有 `app.emit()` 和 `emitter.emit()` 调用 SHALL 使用常量而非字符串字面量
- 前端监听器中的事件名称 SHALL 同步更新（在各自的前端文件中）
- 新事件 SHALL 优先在 `event_names` 中添加常量，再在代码中使用

### 约束

- 常量 SHALL 使用 `pub const` 和 `&str` 类型，保持零运行时开销
- 事件负载类型 SHALL 保留在 `models/events.rs` 中，不在 `events.rs` 中重复定义
- `events.rs` SHALL NOT 依赖任何项目内部模块，仅依赖 `std`
