use crate::agent::session::AgentSession;
use crate::llm::ToolCall;
use crate::models::{
    AgentCompleteEvent, AgentStatus, AgentTurnEvent, ContentBlock, StreamDeltaEvent,
    StreamThinkingEvent, ToolCallEvent, ToolContext, ToolResult, ToolResultEvent, TracePromptEvent,
    TraceThinkingEvent,
};
use crate::prompt::{collect_session_context, PromptBuildOptions, PromptEngine};
use crate::tools::executor::ToolExecutor;
use std::collections::HashMap;
use std::path::PathBuf;
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
    let prompt_engine = PromptEngine::new();

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
        let tools = if session.agent_type == "chat" {
            Vec::new()
        } else {
            session.tool_registry.definitions()
        };
        let session_context = collect_session_context(session.work_dir.as_deref());
        let prompt = prompt_engine.build(
            &session.agent_type,
            &session.messages,
            &tools,
            &session_context,
            PromptBuildOptions::default(),
        );
        emitter.emit_trace_prompt(TracePromptEvent {
            conversation_id: session.conversation_id.clone(),
            session_id: session.id.clone(),
            turn: session.turn_count,
            system_prompt: prompt.system_prompt.clone(),
            messages: prompt.messages.clone(),
            tools: prompt.tools.clone(),
        });
        emitter.emit_trace_thinking_start(TraceThinkingEvent {
            conversation_id: session.conversation_id.clone(),
            session_id: session.id.clone(),
            turn: session.turn_count,
        });
        let cancel_token = session.cancel_token.clone();

        let stream_result = match session
            .llm_client
            .stream_chat_with_tools(
                Some(prompt.system_prompt),
                prompt.messages,
                prompt.tools,
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
            Ok(result) => {
                emitter.emit_trace_thinking_end(TraceThinkingEvent {
                    conversation_id: session.conversation_id.clone(),
                    session_id: session.id.clone(),
                    turn: session.turn_count,
                });
                result
            }
            Err(error) => {
                emitter.emit_trace_thinking_end(TraceThinkingEvent {
                    conversation_id: session.conversation_id.clone(),
                    session_id: session.id.clone(),
                    turn: session.turn_count,
                });
                return complete(session, AgentStatus::Error, &error).await;
            }
        };
        session.input_token_usage = session
            .input_token_usage
            .saturating_add(stream_result.usage.input_tokens);
        session.output_token_usage = session
            .output_token_usage
            .saturating_add(stream_result.usage.output_tokens);
        session.token_usage += stream_result.usage.total();

        let tool_calls = tool_calls.lock().unwrap().clone();
        let tool_blocks = tool_calls
            .iter()
            .map(|tool_call| ContentBlock::ToolUse {
                id: tool_call.id.clone(),
                name: tool_call.name.clone(),
                input: tool_call.input.clone(),
            })
            .collect();
        session.add_assistant_message(
            stream_result.full_content,
            stream_result.thinking_content,
            stream_result.thinking_signature,
            tool_blocks,
        );

        if tool_calls.is_empty() {
            return complete(session, AgentStatus::Complete, "Complete").await;
        }

        let ctx = ToolContext {
            workspace_root: session
                .work_dir
                .as_ref()
                .map(PathBuf::from)
                .unwrap_or_default(),
            allowed_paths: Vec::new(),
            env_vars: HashMap::new(),
            cancellation: session.cancel_token.clone(),
        };
        let results = executor
            .execute_batch(session.tool_registry.as_ref(), &tool_calls, &ctx)
            .await;

        if let Some(reason) = detect_empty_argument_tool_loop(&tool_calls, &results) {
            for (tool_call, result) in tool_calls.iter().zip(results.iter()) {
                session.emitter.emit_tool_result(ToolResultEvent {
                    conversation_id: session.conversation_id.clone(),
                    message_id: session.assistant_message_id.clone(),
                    tool_call_id: tool_call.id.clone(),
                    result: result.clone(),
                });
            }
            session.add_tool_results_batch(
                tool_calls
                    .iter()
                    .zip(results.iter())
                    .map(|(tool_call, result)| (tool_call.id.clone(), result))
                    .collect(),
            );
            return complete(session, AgentStatus::Error, &reason).await;
        }

        let mut batch_results: Vec<(String, &ToolResult)> = Vec::with_capacity(tool_calls.len());
        for (tool_call, result) in tool_calls.iter().zip(results.iter()) {
            session.emitter.emit_tool_result(ToolResultEvent {
                conversation_id: session.conversation_id.clone(),
                message_id: session.assistant_message_id.clone(),
                tool_call_id: tool_call.id.clone(),
                result: result.clone(),
            });
            batch_results.push((tool_call.id.clone(), result));

            if session.cancel_token.is_cancelled() {
                return complete(session, AgentStatus::Cancelled, "Cancelled").await;
            }
        }
        session.add_tool_results_batch(batch_results);
    }

    session.add_assistant_message(
        "Agent stopped after reaching the maximum turn limit.".to_string(),
        String::new(),
        None,
        Vec::new(),
    );
    complete(
        session,
        AgentStatus::MaxTurnsReached,
        "Maximum turn limit reached",
    )
    .await
}

fn detect_empty_argument_tool_loop(
    tool_calls: &[ToolCall],
    results: &[ToolResult],
) -> Option<String> {
    if tool_calls.is_empty() || tool_calls.len() != results.len() {
        return None;
    }

    let all_empty_inputs = tool_calls.iter().all(
        |tool_call| matches!(&tool_call.input, serde_json::Value::Object(map) if map.is_empty()),
    );
    if !all_empty_inputs {
        return None;
    }

    let all_validation_errors = results.iter().all(|result| {
        result.error.as_deref().is_some_and(|error| {
            error.contains("Validation:")
                && (error.contains("is required") || error.contains("must be a string"))
        })
    });
    if !all_validation_errors {
        return None;
    }

    let tool_names = tool_calls
        .iter()
        .map(|tool_call| tool_call.name.as_str())
        .collect::<Vec<_>>()
        .join(", ");

    Some(format!(
        "Model emitted empty arguments for required-parameter tool calls ({tool_names}). Stopped to avoid an infinite retry loop."
    ))
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
        input_tokens: session.input_token_usage,
        output_tokens: session.output_token_usage,
    });
    Ok(status)
}
