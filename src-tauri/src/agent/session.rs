use crate::agent::config::AgentConfig;
use crate::llm::LlmClient;
use crate::models::{
    AgentCompleteEvent, AgentStatus, AgentTurnEvent, ChatMessage, ContentBlock, StreamDeltaEvent,
    StreamThinkingEvent, ToolCallEvent, ToolResult, ToolResultEvent, TracePromptEvent,
    TraceThinkingEvent,
};
use crate::tools::ToolRegistry;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use tokio_util::sync::CancellationToken;

pub trait AgentEventEmitter: Send + Sync {
    fn emit_text_delta(&self, payload: StreamDeltaEvent);
    fn emit_thinking_delta(&self, payload: StreamThinkingEvent);
    fn emit_tool_call(&self, payload: ToolCallEvent);
    fn emit_tool_result(&self, payload: ToolResultEvent);
    fn emit_turn(&self, payload: AgentTurnEvent);
    fn emit_trace_prompt(&self, payload: TracePromptEvent);
    fn emit_trace_thinking_start(&self, payload: TraceThinkingEvent);
    fn emit_trace_thinking_end(&self, payload: TraceThinkingEvent);
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

    fn emit_thinking_delta(&self, payload: StreamThinkingEvent) {
        let _ = self.app.emit("thinking-delta", payload);
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

    fn emit_trace_prompt(&self, payload: TracePromptEvent) {
        let _ = self.app.emit("trace-prompt", payload);
    }

    fn emit_trace_thinking_start(&self, payload: TraceThinkingEvent) {
        let _ = self.app.emit("trace-thinking-start", payload);
    }

    fn emit_trace_thinking_end(&self, payload: TraceThinkingEvent) {
        let _ = self.app.emit("trace-thinking-end", payload);
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
    pub work_dir: Option<String>,
    pub messages: Vec<ChatMessage>,
    pub turn_count: usize,
    pub token_usage: usize,
    pub input_token_usage: u32,
    pub output_token_usage: u32,
    pub status: AgentStatus,
    pub llm_client: LlmClient,
    pub tool_registry: Arc<ToolRegistry>,
    pub emitter: Arc<dyn AgentEventEmitter>,
    pub cancel_token: CancellationToken,
    pub created_at: u128,
}

fn build_assistant_content_blocks(
    content: &str,
    thinking_content: &str,
    thinking_signature: Option<String>,
    mut tool_calls: Vec<ContentBlock>,
) -> Vec<ContentBlock> {
    let mut content_blocks = Vec::with_capacity(tool_calls.len() + 2);
    if !thinking_content.is_empty() {
        content_blocks.push(ContentBlock::Thinking {
            thinking: thinking_content.to_string(),
            signature: thinking_signature,
        });
    }
    if !content.is_empty() {
        content_blocks.push(ContentBlock::Text {
            text: content.to_string(),
        });
    }
    content_blocks.append(&mut tool_calls);
    content_blocks
}

impl AgentSession {
    pub fn new(
        conversation_id: String,
        assistant_message_id: String,
        messages: Vec<ChatMessage>,
        agent_type: String,
        work_dir: Option<String>,
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
            agent_type,
            config,
            conversation_id,
            assistant_message_id,
            work_dir,
            messages,
            turn_count: 0,
            token_usage: 0,
            input_token_usage: 0,
            output_token_usage: 0,
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

    pub fn add_assistant_message(
        &mut self,
        content: String,
        thinking_content: String,
        thinking_signature: Option<String>,
        tool_calls: Vec<ContentBlock>,
    ) {
        let content_blocks = build_assistant_content_blocks(
            &content,
            &thinking_content,
            thinking_signature,
            tool_calls,
        );

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

    /// 将所有 tool_result 放在**单条** user 消息中。
    ///
    /// Anthropic/DeepSeek API 要求 assistant 消息中的每个 `tool_use` 块都在
    /// **紧接的下一条** user 消息中有对应的 `tool_result` 块。
    /// 如果拆成多条 user 消息，后续 `tool_use` 会在错误的偏移处查找，
    /// 导致 400 错误。
    pub fn add_tool_results_batch(&mut self, results: Vec<(String, &ToolResult)>) {
        if results.is_empty() {
            return;
        }
        let blocks: Vec<ContentBlock> = results
            .into_iter()
            .map(|(tool_use_id, result)| {
                let content = result
                    .error
                    .clone()
                    .unwrap_or_else(|| result.output.clone());
                ContentBlock::ToolResult {
                    tool_use_id,
                    content,
                    is_error: Some(!result.success),
                }
            })
            .collect();
        self.messages.push(ChatMessage {
            role: "user".to_string(),
            content: String::new(),
            content_blocks: Some(blocks),
        });
    }

    pub fn set_status(&mut self, status: AgentStatus) {
        self.status = status;
    }
}

#[cfg(test)]
mod tests {
    use super::build_assistant_content_blocks;
    use crate::models::ContentBlock;
    use serde_json::json;

    #[test]
    fn assistant_content_blocks_place_thinking_before_text_and_tools() {
        let blocks = build_assistant_content_blocks(
            "final answer",
            "reasoning",
            Some("sig-123".to_string()),
            vec![ContentBlock::ToolUse {
                id: "tool-1".to_string(),
                name: "shell".to_string(),
                input: json!({ "command": "pwd" }),
            }],
        );

        assert!(matches!(
            &blocks[0],
            ContentBlock::Thinking { thinking, signature } if thinking == "reasoning" && signature.as_deref() == Some("sig-123")
        ));
        assert!(matches!(
            &blocks[1],
            ContentBlock::Text { text } if text == "final answer"
        ));
        assert!(matches!(
            &blocks[2],
            ContentBlock::ToolUse { id, name, .. } if id == "tool-1" && name == "shell"
        ));
    }

    #[test]
    fn assistant_content_blocks_omit_empty_thinking() {
        let blocks = build_assistant_content_blocks("final answer", "", None, Vec::new());

        assert_eq!(blocks.len(), 1);
        assert!(matches!(
            &blocks[0],
            ContentBlock::Text { text } if text == "final answer"
        ));
    }
}
