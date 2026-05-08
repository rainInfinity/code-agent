use crate::events::event_names;
use crate::llm::LlmClient;
use crate::models::*;
use crate::prompt::{collect_session_context, PromptBuildOptions, PromptEngine};
use crate::settings_io::default_provider_settings;
use crate::state::AppState;
use tauri::{AppHandle, Emitter, State};

/// Send a message to the LLM and stream the response back via events
#[tauri::command]
pub async fn send_message(
    app: AppHandle,
    state: State<'_, AppState>,
    payload: SendMessagePayload,
) -> Result<(), String> {
    let provider_id = if payload.provider_id.trim().is_empty() {
        state.active_provider_id.lock().unwrap().clone()
    } else {
        payload.provider_id.clone()
    };
    let settings = {
        let provider_settings = state.provider_settings.lock().unwrap();
        provider_settings
            .get(&provider_id)
            .cloned()
            .unwrap_or_else(|| default_provider_settings(&provider_id))
    };

    if settings.api_key.is_empty() {
        return Err("API key not configured. Please set your API key in Settings.".to_string());
    }

    let client = LlmClient::new(
        &provider_id,
        &settings.api_key,
        &settings.api_endpoint,
        &settings.model,
    );

    let conversation_id = payload.conversation_id.clone();
    let message_id = payload.assistant_message_id.clone();
    let session_id = format!("chat-{}", message_id);
    let agent_type = payload
        .agent_type
        .as_deref()
        .filter(|value| *value == "chat" || *value == "code")
        .unwrap_or("chat");
    let session_context = collect_session_context(payload.work_dir.as_deref());
    let prompt = PromptEngine::new().build(
        agent_type,
        &payload.messages,
        &[],
        &session_context,
        PromptBuildOptions::default(),
    );
    let _ = app.emit(
        event_names::TRACE_PROMPT,
        TracePromptEvent {
            conversation_id: conversation_id.clone(),
            session_id,
            turn: 1,
            system_prompt: prompt.system_prompt.clone(),
            messages: prompt.messages.clone(),
            tools: prompt.tools.clone(),
        },
    );

    let conv_id = conversation_id.clone();
    let msg_id = message_id.clone();
    let app_clone = app.clone();
    let app_thinking = app.clone();
    let app_err = app.clone();
    let conv_id_err = conversation_id.clone();
    let msg_id_err = message_id.clone();
    let conv_id_thinking = conversation_id.clone();
    let msg_id_thinking = message_id.clone();

    let result = client
        .stream_chat(
            Some(prompt.system_prompt),
            prompt.messages,
            move |delta| {
                let _ = app_clone.emit(
                    event_names::STREAM_DELTA,
                    StreamDeltaEvent {
                        conversation_id: conv_id.clone(),
                        message_id: msg_id.clone(),
                        delta,
                    },
                );
            },
            move |delta| {
                let _ = app_thinking.emit(
                    event_names::THINKING_DELTA,
                    StreamThinkingEvent {
                        conversation_id: conv_id_thinking.clone(),
                        message_id: msg_id_thinking.clone(),
                        delta,
                    },
                );
            },
            move |error| {
                let _ = app_err.emit(
                    event_names::STREAM_ERROR,
                    StreamErrorEvent {
                        conversation_id: conv_id_err.clone(),
                        message_id: msg_id_err.clone(),
                        error,
                    },
                );
            },
        )
        .await;

    match result {
        Ok(result) => {
            let _ = app.emit(
                event_names::STREAM_END,
                StreamEndEvent {
                    conversation_id,
                    message_id,
                    full_content: result.full_content,
                    input_tokens: result.usage.input_tokens,
                    output_tokens: result.usage.output_tokens,
                },
            );
            Ok(())
        }
        Err(e) => {
            let _ = app.emit(
                event_names::STREAM_ERROR,
                StreamErrorEvent {
                    conversation_id,
                    message_id,
                    error: e.clone(),
                },
            );
            Err(e)
        }
    }
}

/// Stop streaming (placeholder - requires CancellationToken in production)
#[tauri::command]
pub async fn stop_streaming(_conversation_id: String) -> Result<(), String> {
    Ok(())
}
