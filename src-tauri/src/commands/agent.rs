use crate::agent::{AgentConfig, AgentSession, TauriAgentEventEmitter};
use crate::llm::LlmClient;
use crate::models::*;
use crate::settings_io::default_provider_settings;
use crate::state::AppState;
use std::sync::Arc;
use tauri::{AppHandle, State};
use tokio_util::sync::CancellationToken;

#[tauri::command]
pub async fn run_agent(
    app: AppHandle,
    state: State<'_, AppState>,
    payload: RunAgentPayload,
) -> Result<String, String> {
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

    let llm_client = LlmClient::new(
        &provider_id,
        &settings.api_key,
        &settings.api_endpoint,
        &settings.model,
    );

    let config = AgentConfig {
        max_turns: payload.max_turns.unwrap_or(30),
        ..AgentConfig::default()
    };
    let cancel_token = CancellationToken::new();
    let emitter = Arc::new(TauriAgentEventEmitter::new(app));
    let session = AgentSession::new(
        payload.conversation_id,
        payload.assistant_message_id,
        payload.messages,
        payload.agent_type.unwrap_or_else(|| "code".to_string()),
        payload.work_dir,
        config,
        llm_client,
        state.tool_registry.clone(),
        emitter,
        cancel_token,
    );

    Ok(state.agent_runtime.start(session))
}

#[tauri::command]
pub async fn stop_agent(state: State<'_, AppState>, session_id: String) -> Result<(), String> {
    if state.agent_runtime.cancel(&session_id) {
        Ok(())
    } else {
        Err(format!("No active agent session: {}", session_id))
    }
}
