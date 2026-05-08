use serde::{Deserialize, Serialize};

use super::chat::ChatMessage;
use super::tools::ToolDefinition;

pub fn default_provider_id() -> String {
    "anthropic".to_string()
}

// ─── Anthropic API Types ────────────────────────────────────

/// Anthropic Messages API request body
#[derive(Debug, Serialize)]
pub struct AnthropicRequest {
    pub model: String,
    pub max_tokens: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,
    pub messages: Vec<serde_json::Value>,
    pub stream: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tools: Vec<ToolDefinition>,
}

/// Anthropic content block
#[derive(Debug, Deserialize)]
pub struct AnthropicContentBlock {
    #[serde(rename = "type")]
    pub block_type: String,
    #[serde(default)]
    pub text: String,
}

/// Anthropic non-streaming response
#[derive(Debug, Deserialize)]
pub struct AnthropicResponse {
    pub content: Vec<AnthropicContentBlock>,
    #[serde(default)]
    pub stop_reason: Option<String>,
}

/// Anthropic streaming event types
#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum StreamEvent {
    #[serde(rename = "message_start")]
    MessageStart { message: serde_json::Value },
    #[serde(rename = "content_block_start")]
    ContentBlockStart {
        index: usize,
        content_block: serde_json::Value,
    },
    #[serde(rename = "content_block_delta")]
    ContentBlockDelta { index: usize, delta: ContentDelta },
    #[serde(rename = "content_block_stop")]
    ContentBlockStop { index: usize },
    #[serde(rename = "message_delta")]
    MessageDelta {
        delta: serde_json::Value,
        usage: Option<serde_json::Value>,
    },
    #[serde(rename = "message_stop")]
    MessageStop,
    #[serde(rename = "ping")]
    Ping,
    #[serde(rename = "error")]
    Error { error: ApiError },
}

#[derive(Debug, Deserialize)]
pub struct ContentDelta {
    #[serde(rename = "type")]
    pub delta_type: String,
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub thinking: String,
    #[serde(default)]
    pub signature: String,
    #[serde(default, alias = "partial_json")]
    pub input_json_delta: String,
    #[serde(default)]
    pub tool_use: Option<ToolUseInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolUseInfo {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct ApiError {
    #[serde(rename = "type")]
    pub error_type: String,
    pub message: String,
}

/// A model returned by the Models API.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub id: String,
    #[serde(default)]
    pub display_name: String,
    #[serde(default)]
    pub created_at: String,
    #[serde(alias = "type", default)]
    pub model_type: String,
}

/// Models API response.
#[derive(Debug, Deserialize)]
pub struct ModelsResponse {
    pub data: Vec<ModelInfo>,
}

// ─── OpenAI API Types ──────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct OpenAiChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub stream: bool,
    pub stream_options: OpenAiStreamOptions,
}

#[derive(Debug, Serialize)]
pub struct OpenAiStreamOptions {
    pub include_usage: bool,
}

#[derive(Debug, Deserialize)]
pub struct OpenAiChatResponse {
    #[serde(default)]
    pub choices: Vec<OpenAiChoice>,
}

#[derive(Debug, Deserialize)]
pub struct OpenAiChoice {
    #[serde(default)]
    pub message: Option<OpenAiMessage>,
    #[serde(default)]
    pub delta: Option<OpenAiDelta>,
}

#[derive(Debug, Deserialize)]
pub struct OpenAiMessage {
    #[serde(default)]
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct OpenAiDelta {
    #[serde(default)]
    pub content: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct OpenAiStreamChunk {
    #[serde(default)]
    pub choices: Vec<OpenAiChoice>,
    #[serde(default)]
    pub usage: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct OpenAiModelInfo {
    pub id: String,
    #[serde(default)]
    pub created: Option<i64>,
    #[serde(default)]
    pub owned_by: String,
}

#[derive(Debug, Deserialize)]
pub struct OpenAiModelsResponse {
    pub data: Vec<OpenAiModelInfo>,
}
