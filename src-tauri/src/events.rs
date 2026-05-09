/// Centralized IPC event name constants.
/// Use these instead of raw string literals in `app.emit()` and `emitter.emit()` calls.
pub mod event_names {
    // ─── Streaming events ────────────────────────────────────
    pub const STREAM_DELTA: &str = "stream-delta";
    pub const THINKING_DELTA: &str = "thinking-delta";
    pub const STREAM_ERROR: &str = "stream-error";
    pub const STREAM_END: &str = "stream-end";

    // ─── Tool events ────────────────────────────────────────
    pub const TOOL_CALL: &str = "tool-call";
    pub const TOOL_RESULT: &str = "tool-result";
    pub const TOOL_TRACE: &str = "tool-trace";

    // ─── Agent lifecycle events ──────────────────────────────
    pub const AGENT_TURN: &str = "agent-turn";
    pub const AGENT_TURN_COMPLETE: &str = "agent-turn-complete";
    pub const AGENT_COMPLETE: &str = "agent-complete";

    // ─── Trace / Thinking events ─────────────────────────────
    pub const TRACE_PROMPT: &str = "trace-prompt";
    pub const TRACE_THINKING_START: &str = "trace-thinking-start";
    pub const TRACE_THINKING_END: &str = "trace-thinking-end";

    // ─── Window events ───────────────────────────────────────
    pub const MAIN_ALWAYS_ON_TOP_CHANGED: &str = "main-always-on-top-changed";
    pub const TRACE_DOCKING_CHANGED: &str = "trace-docking-changed";
    pub const TRACE_WINDOW_CLOSED: &str = "trace-window-closed";
}
