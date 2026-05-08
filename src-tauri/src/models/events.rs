use serde::{Deserialize, Serialize};

use super::chat::ChatMessage;
use super::tools::{ToolDefinition, ToolResult};

// ─── Tauri Event Payloads ───────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamDeltaEvent {
    pub conversation_id: String,
    pub message_id: String,
    pub delta: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamThinkingEvent {
    pub conversation_id: String,
    pub message_id: String,
    pub delta: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamEndEvent {
    pub conversation_id: String,
    pub message_id: String,
    pub full_content: String,
    pub input_tokens: u32,
    pub output_tokens: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamErrorEvent {
    pub conversation_id: String,
    pub message_id: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentStatus {
    Idle,
    Running,
    Complete,
    Cancelled,
    MaxTurnsReached,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolTracePhase {
    Requested,
    Running,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCallEvent {
    pub conversation_id: String,
    pub message_id: String,
    pub tool_call_id: String,
    pub name: String,
    pub input: serde_json::Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolResultEvent {
    pub conversation_id: String,
    pub message_id: String,
    pub tool_call_id: String,
    pub result: ToolResult,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolTraceEvent {
    pub conversation_id: String,
    pub session_id: String,
    pub turn: usize,
    pub message_id: String,
    pub tool_call_id: String,
    pub name: String,
    pub input: serde_json::Value,
    pub phase: ToolTracePhase,
    pub logical_index: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub batch_id: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub batch_index: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_concurrent: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub result: Option<ToolResult>,
    pub timestamp_ms: u128,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentTurnEvent {
    pub conversation_id: String,
    pub session_id: String,
    pub turn_count: usize,
    pub assistant_message_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentTurnCompleteEvent {
    pub conversation_id: String,
    pub session_id: String,
    pub turn_count: usize,
    pub status: AgentStatus,
    pub reason: String,
    pub input_tokens: u32,
    pub output_tokens: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentCompleteEvent {
    pub conversation_id: String,
    pub session_id: String,
    pub message_id: String,
    pub status: AgentStatus,
    pub reason: String,
    pub input_tokens: u32,
    pub output_tokens: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TracePromptEvent {
    pub conversation_id: String,
    pub session_id: String,
    pub turn: usize,
    pub system_prompt: String,
    pub messages: Vec<ChatMessage>,
    pub tools: Vec<ToolDefinition>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TraceThinkingEvent {
    pub conversation_id: String,
    pub session_id: String,
    pub turn: usize,
}
