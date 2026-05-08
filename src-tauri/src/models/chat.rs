use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlock {
    Text {
        text: String,
    },
    Thinking {
        thinking: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        signature: Option<String>,
    },
    ToolUse {
        id: String,
        name: String,
        input: serde_json::Value,
    },
    ToolResult {
        tool_use_id: String,
        content: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        is_error: Option<bool>,
    },
}

/// A single message in the conversation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content_blocks: Option<Vec<ContentBlock>>,
}

/// Payload from frontend for sending messages
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendMessagePayload {
    pub provider_id: String,
    pub conversation_id: String,
    pub assistant_message_id: String,
    pub messages: Vec<ChatMessage>,
    #[serde(default)]
    pub agent_type: Option<String>,
    #[serde(default)]
    pub work_dir: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunAgentPayload {
    pub provider_id: String,
    pub conversation_id: String,
    pub assistant_message_id: String,
    pub messages: Vec<ChatMessage>,
    #[serde(default)]
    pub agent_type: Option<String>,
    #[serde(default)]
    pub work_dir: Option<String>,
    #[serde(default)]
    pub max_turns: Option<usize>,
}
