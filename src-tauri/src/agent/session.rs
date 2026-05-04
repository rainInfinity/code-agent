use crate::agent::config::AgentConfig;
use crate::llm::LlmClient;
use crate::models::{
    AgentCompleteEvent, AgentStatus, AgentTurnEvent, ChatMessage, ContentBlock, StreamDeltaEvent,
    ToolCallEvent, ToolResult, ToolResultEvent,
};
use crate::tools::ToolRegistry;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use tokio_util::sync::CancellationToken;

pub trait AgentEventEmitter: Send + Sync {
    fn emit_text_delta(&self, payload: StreamDeltaEvent);
    fn emit_tool_call(&self, payload: ToolCallEvent);
    fn emit_tool_result(&self, payload: ToolResultEvent);
    fn emit_turn(&self, payload: AgentTurnEvent);
    fn emit_complete(&self, payload: AgentCompleteEvent);
}

pub struct TauriAgentEventEmitter {
    app: AppHandle,
}

impl TauriAgentEventEmitter {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }
}

impl AgentEventEmitter for TauriAgentEventEmitter {
    fn emit_text_delta(&self, payload: StreamDeltaEvent) {
        let _ = self.app.emit("stream-delta", payload);
    }

    fn emit_tool_call(&self, payload: ToolCallEvent) {
        let _ = self.app.emit("tool-call", payload);
    }

    fn emit_tool_result(&self, payload: ToolResultEvent) {
        let _ = self.app.emit("tool-result", payload);
    }

    fn emit_turn(&self, payload: AgentTurnEvent) {
        let _ = self.app.emit("agent-turn", payload);
    }

    fn emit_complete(&self, payload: AgentCompleteEvent) {
        let _ = self.app.emit("agent-complete", payload);
    }
}

pub struct AgentSession {
    pub id: String,
    pub agent_type: String,
    pub config: AgentConfig,
    pub conversation_id: String,
    pub assistant_message_id: String,
    pub messages: Vec<ChatMessage>,
    pub turn_count: usize,
    pub token_usage: usize,
    pub status: AgentStatus,
    pub llm_client: LlmClient,
    pub tool_registry: Arc<ToolRegistry>,
    pub emitter: Arc<dyn AgentEventEmitter>,
    pub cancel_token: CancellationToken,
    pub created_at: u128,
}

impl AgentSession {
    pub fn new(
        conversation_id: String,
        assistant_message_id: String,
        messages: Vec<ChatMessage>,
        config: AgentConfig,
        llm_client: LlmClient,
        tool_registry: Arc<ToolRegistry>,
        emitter: Arc<dyn AgentEventEmitter>,
        cancel_token: CancellationToken,
    ) -> Self {
        let created_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or_default();

        Self {
            id: format!("agent-{}", created_at),
            agent_type: "default".to_string(),
            config,
            conversation_id,
            assistant_message_id,
            messages,
            turn_count: 0,
            token_usage: 0,
            status: AgentStatus::Idle,
            llm_client,
            tool_registry,
            emitter,
            cancel_token,
            created_at,
        }
    }

    pub fn add_user_message(&mut self, content: String) {
        self.messages.push(ChatMessage {
            role: "user".to_string(),
            content: content.clone(),
            content_blocks: Some(vec![ContentBlock::Text { text: content }]),
        });
    }

    pub fn add_assistant_message(&mut self, content: String, tool_calls: Vec<ContentBlock>) {
        let mut content_blocks = Vec::new();
        if !content.is_empty() {
            content_blocks.push(ContentBlock::Text {
                text: content.clone(),
            });
        }
        content_blocks.extend(tool_calls);

        self.messages.push(ChatMessage {
            role: "assistant".to_string(),
            content,
            content_blocks: Some(content_blocks),
        });
    }

    pub fn add_tool_result(&mut self, tool_use_id: String, result: &ToolResult) {
        let content = result
            .error
            .clone()
            .unwrap_or_else(|| result.output.clone());
        self.messages.push(ChatMessage {
            role: "user".to_string(),
            content: content.clone(),
            content_blocks: Some(vec![ContentBlock::ToolResult {
                tool_use_id,
                content,
                is_error: Some(!result.success),
            }]),
        });
    }

    pub fn set_status(&mut self, status: AgentStatus) {
        self.status = status;
    }
}
