use crate::agent::session::AgentSession;
use crate::llm::ToolCall;
use crate::models::{
    AgentCompleteEvent, AgentStatus, AgentTurnEvent, ContentBlock, StreamDeltaEvent,
    StreamThinkingEvent, ToolCallEvent, ToolResult, ToolResultEvent,
};
use crate::tools::executor::ToolExecutor;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::task::JoinHandle;
use tokio_util::sync::CancellationToken;

pub struct AgentRuntime {
    cancel_tokens: Mutex<HashMap<String, CancellationToken>>,
    handles: Mutex<HashMap<String, JoinHandle<()>>>,
}

impl AgentRuntime {
    pub fn new() -> Self {
        Self {
            cancel_tokens: Mutex::new(HashMap::new()),
            handles: Mutex::new(HashMap::new()),
        }
    }

    pub fn start(&self, mut session: AgentSession) -> String {
        let session_id = session.id.clone();
        self.cancel_tokens
            .lock()
            .unwrap()
            .insert(session_id.clone(), session.cancel_token.clone());

        let handle = tokio::spawn(async move {
            let _ = agent_loop(&mut session).await;
        });
        self.handles
            .lock()
            .unwrap()
            .insert(session_id.clone(), handle);
        session_id
    }

    pub fn cancel(&self, session_id: &str) -> bool {
        if let Some(token) = self.cancel_tokens.lock().unwrap().get(session_id) {
            token.cancel();
            true
        } else {
            false
        }
    }
}

pub async fn agent_loop(session: &mut AgentSession) -> Result<AgentStatus, String> {
    session.set_status(AgentStatus::Running);
    let executor = ToolExecutor::new(
        session.config.tool_timeout_secs,
        session.config.tool_output_max_chars,
    );

    while session.turn_count < session.config.max_turns {
        if session.cancel_token.is_cancelled() {
            return complete(session, AgentStatus::Cancelled, "Cancelled").await;
        }

        session.turn_count += 1;
        session.emitter.emit_turn(AgentTurnEvent {
            conversation_id: session.conversation_id.clone(),
            session_id: session.id.clone(),
            turn_count: session.turn_count,
        });

        let tool_calls = Arc::new(Mutex::new(Vec::<ToolCall>::new()));
        let conversation_id = session.conversation_id.clone();
        let message_id = session.assistant_message_id.clone();
        let emitter = session.emitter.clone();
        let tools = session.tool_registry.definitions();
        let cancel_token = session.cancel_token.clone();

        let full_content = match session
            .llm_client
            .stream_chat_with_tools(
                session.messages.clone(),
                tools,
                cancel_token,
                {
                    let conversation_id = conversation_id.clone();
                    let message_id = message_id.clone();
                    let emitter = emitter.clone();
                    move |delta| {
                        emitter.emit_text_delta(StreamDeltaEvent {
                            conversation_id: conversation_id.clone(),
                            message_id: message_id.clone(),
                            delta,
                        });
                    }
                },
                {
                    let conversation_id = conversation_id.clone();
                    let message_id = message_id.clone();
                    let emitter = emitter.clone();
                    move |delta| {
                        emitter.emit_thinking_delta(StreamThinkingEvent {
                            conversation_id: conversation_id.clone(),
                            message_id: message_id.clone(),
                            delta,
                        });
                    }
                },
                {
                    let conversation_id = conversation_id.clone();
                    let message_id = message_id.clone();
                    let emitter = emitter.clone();
                    let tool_calls = tool_calls.clone();
                    move |tool_call| {
                        emitter.emit_tool_call(ToolCallEvent {
                            conversation_id: conversation_id.clone(),
                            message_id: message_id.clone(),
                            tool_call_id: tool_call.id.clone(),
                            name: tool_call.name.clone(),
                            input: tool_call.input.clone(),
                        });
                        tool_calls.lock().unwrap().push(tool_call);
                    }
                },
                {
                    let emitter = emitter.clone();
                    move |error| {
                        let _ = &emitter;
                        eprintln!("Agent stream error: {}", error);
                    }
                },
            )
            .await
        {
            Ok(full_content) => full_content,
            Err(error) => return complete(session, AgentStatus::Error, &error).await,
        };

        let tool_calls = tool_calls.lock().unwrap().clone();
        let tool_blocks = tool_calls
            .iter()
            .map(|tool_call| ContentBlock::ToolUse {
                id: tool_call.id.clone(),
                name: tool_call.name.clone(),
                input: tool_call.input.clone(),
            })
            .collect();
        session.add_assistant_message(full_content, tool_blocks);

        if tool_calls.is_empty() {
            return complete(session, AgentStatus::Complete, "Complete").await;
        }

        for tool_call in tool_calls {
            let result = match session.tool_registry.get(&tool_call.name) {
                Some(tool) => executor.execute(tool, tool_call.input.clone()).await,
                None => ToolResult {
                    success: false,
                    output: String::new(),
                    error: Some(format!("Tool not found: {}", tool_call.name)),
                },
            };

            session.emitter.emit_tool_result(ToolResultEvent {
                conversation_id: session.conversation_id.clone(),
                message_id: session.assistant_message_id.clone(),
                tool_call_id: tool_call.id.clone(),
                result: result.clone(),
            });
            session.add_tool_result(tool_call.id, &result);

            if session.cancel_token.is_cancelled() {
                return complete(session, AgentStatus::Cancelled, "Cancelled").await;
            }
        }
    }

    session.add_assistant_message(
        "Agent stopped after reaching the maximum turn limit.".to_string(),
        Vec::new(),
    );
    complete(
        session,
        AgentStatus::MaxTurnsReached,
        "Maximum turn limit reached",
    )
    .await
}

async fn complete(
    session: &mut AgentSession,
    status: AgentStatus,
    reason: &str,
) -> Result<AgentStatus, String> {
    session.set_status(status.clone());
    session.emitter.emit_complete(AgentCompleteEvent {
        conversation_id: session.conversation_id.clone(),
        session_id: session.id.clone(),
        message_id: session.assistant_message_id.clone(),
        status: status.clone(),
        reason: reason.to_string(),
    });
    Ok(status)
}
