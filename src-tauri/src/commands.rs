use crate::agent::{AgentConfig, AgentRuntime, AgentSession, TauriAgentEventEmitter};
use crate::llm::LlmClient;
use crate::models::*;
use crate::prompt::{collect_session_context, PromptBuildOptions, PromptEngine};
use crate::providers::{built_in_provider_ids, default_endpoint, default_model};
use crate::tools::ToolRegistry;
use crate::{TraceDockingSide, TraceDockingSnapshot};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use tokio_util::sync::CancellationToken;

const SETTINGS_FILE: &str = "settings.json";
const TRACE_WINDOW_LABEL: &str = "trace";
const TRACE_WINDOW_WIDTH: f64 = 600.0;
const TRACE_WINDOW_MIN_WIDTH: f64 = 580.0;
const TRACE_WINDOW_MIN_HEIGHT: f64 = 400.0;

/// Application state holding settings
pub struct AppState {
    pub active_provider_id: Mutex<String>,
    pub provider_settings: Mutex<HashMap<String, ProviderSettings>>,
    pub agent_runtime: Arc<AgentRuntime>,
    pub tool_registry: Arc<ToolRegistry>,
}

#[tauri::command]
pub async fn open_trace_window(
    app: AppHandle,
    conversation_id: Option<String>,
) -> Result<(), String> {
    let mut docking = crate::load_trace_docking_state(&app);
    if docking.hidden_while_docked {
        docking.hidden_while_docked = false;
        crate::save_trace_docking_state(&app, docking);
    }

    if let Some(trace) = app.get_webview_window(TRACE_WINDOW_LABEL) {
        trace.show().map_err(|e| e.to_string())?;
        crate::apply_trace_docking(&app)?;
        trace.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let url_path = if let Some(ref id) = conversation_id {
        format!("index.html?window=trace&conversationId={}", id)
    } else {
        "index.html?window=trace".to_string()
    };

    #[cfg(debug_assertions)]
    let url = WebviewUrl::External(
        format!("http://localhost:1420/{}", url_path)
            .parse()
            .unwrap(),
    );
    #[cfg(not(debug_assertions))]
    let url = WebviewUrl::App(url_path.into());

    let builder = WebviewWindowBuilder::new(&app, TRACE_WINDOW_LABEL, url)
        .title("Agent Trace")
        .inner_size(TRACE_WINDOW_WIDTH, 600.0)
        .min_inner_size(TRACE_WINDOW_MIN_WIDTH, TRACE_WINDOW_MIN_HEIGHT)
        .resizable(true)
        .decorations(false)
        .visible(true);

    // Restore persisted state if available, otherwise center
    let trace = builder.build().map_err(|e| e.to_string())?;
    let had_state = crate::restore_trace_window_state(&app, &trace);
    if !had_state {
        let _ = trace.center();
    }

    crate::setup_trace_window_state(&app, &trace);
    crate::apply_trace_docking(&app)?;

    Ok(())
}

#[tauri::command]
pub fn hide_trace_window(app: AppHandle) -> Result<(), String> {
    if let Some(trace) = app.get_webview_window(TRACE_WINDOW_LABEL) {
        crate::save_trace_window_state(&app);

        let mut docking = crate::load_trace_docking_state(&app);
        if docking.side.is_some() {
            docking.hidden_while_docked = true;
            crate::save_trace_docking_state(&app, docking);
        }

        trace.hide().map_err(|e| e.to_string())?;
        let _ = app.emit("trace-window-closed", ());
    }
    Ok(())
}

#[tauri::command]
pub fn set_trace_always_on_top(app: AppHandle, always_on_top: bool) -> Result<(), String> {
    if let Some(trace) = app.get_webview_window(TRACE_WINDOW_LABEL) {
        let snapshot = crate::set_trace_always_on_top_state(&app, always_on_top);
        if snapshot.always_on_top_forced && !always_on_top {
            return Ok(());
        }
        trace
            .set_always_on_top(always_on_top)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_trace_docking_state(app: AppHandle) -> TraceDockingSnapshot {
    crate::trace_docking_state(&app)
}

#[tauri::command]
pub fn set_trace_docking_mode(
    app: AppHandle,
    side: Option<TraceDockingSide>,
) -> Result<TraceDockingSnapshot, String> {
    crate::set_trace_docking_side(&app, side)
}

#[tauri::command]
pub fn exit_trace_docking(app: AppHandle) -> Result<TraceDockingSnapshot, String> {
    crate::exit_trace_docking(&app)?;
    Ok(crate::trace_docking_state(&app))
}

#[tauri::command]
pub fn sync_trace_docking_width(
    app: AppHandle,
    width: Option<f64>,
) -> Result<TraceDockingSnapshot, String> {
    crate::sync_trace_docking_width(&app, width)
}

#[tauri::command]
pub fn sync_trace_docking_to_main(app: AppHandle) -> Result<TraceDockingSnapshot, String> {
    crate::apply_trace_docking(&app)?;
    Ok(crate::trace_docking_state(&app))
}

#[tauri::command]
pub fn hide_trace_for_main_minimize(app: AppHandle) -> Result<(), String> {
    crate::hide_trace_for_main_minimize(&app)
}

#[tauri::command]
pub fn close_trace_window(app: AppHandle) -> Result<(), String> {
    if let Some(trace) = app.get_webview_window(TRACE_WINDOW_LABEL) {
        trace.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn is_trace_window_open(app: AppHandle) -> bool {
    app.get_webview_window(TRACE_WINDOW_LABEL)
        .and_then(|trace| trace.is_visible().ok())
        .unwrap_or(false)
}

impl AppState {
    pub fn new(app: &AppHandle) -> Self {
        let mut saved = read_settings(app).unwrap_or_default();
        normalize_settings(&mut saved);

        Self {
            active_provider_id: Mutex::new(saved.active_provider_id),
            provider_settings: Mutex::new(saved.providers),
            agent_runtime: Arc::new(AgentRuntime::new()),
            tool_registry: Arc::new(ToolRegistry::with_defaults()),
        }
    }
}

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
        "trace-prompt",
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
                    "stream-delta",
                    StreamDeltaEvent {
                        conversation_id: conv_id.clone(),
                        message_id: msg_id.clone(),
                        delta,
                    },
                );
            },
            move |delta| {
                let _ = app_thinking.emit(
                    "thinking-delta",
                    StreamThinkingEvent {
                        conversation_id: conv_id_thinking.clone(),
                        message_id: msg_id_thinking.clone(),
                        delta,
                    },
                );
            },
            move |error| {
                let _ = app_err.emit(
                    "stream-error",
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
                "stream-end",
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
                "stream-error",
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

/// Stop streaming (placeholder - requires CancellationToken in production)
#[tauri::command]
pub async fn stop_streaming(_conversation_id: String) -> Result<(), String> {
    // In a production implementation, this would cancel the HTTP request
    // via a CancellationToken stored in AppState
    Ok(())
}

/// Save settings
#[tauri::command]
pub async fn save_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: SettingsPayload,
) -> Result<(), String> {
    let provider_id = settings.provider_id.clone();
    *state.active_provider_id.lock().unwrap() = provider_id.clone();

    let mut provider_settings = state.provider_settings.lock().unwrap();
    let existing = provider_settings
        .get(&provider_id)
        .cloned()
        .unwrap_or_else(|| default_provider_settings(&provider_id));
    let next = ProviderSettings {
        api_key: if settings.api_key.trim().is_empty() {
            existing.api_key
        } else {
            settings.api_key
        },
        api_endpoint: settings.api_endpoint,
        model: settings.model,
    };
    provider_settings.insert(provider_id.clone(), next);

    let persisted = PersistedSettings {
        active_provider_id: provider_id,
        providers: provider_settings.clone(),
    };
    drop(provider_settings);

    write_settings(&app, &persisted)?;

    Ok(())
}

/// Load settings (without exposing API keys)
#[tauri::command]
pub async fn load_settings(state: State<'_, AppState>) -> Result<SettingsResponse, String> {
    let active_provider_id = state.active_provider_id.lock().unwrap().clone();
    let provider_settings = state.provider_settings.lock().unwrap();
    let providers = built_in_provider_ids()
        .into_iter()
        .map(|id| {
            let settings = provider_settings
                .get(id)
                .cloned()
                .unwrap_or_else(|| default_provider_settings(id));
            (
                id.to_string(),
                ProviderSettingsSummary {
                    api_endpoint: settings.api_endpoint,
                    model: settings.model,
                    has_api_key: !settings.api_key.is_empty(),
                },
            )
        })
        .collect();

    Ok(SettingsResponse {
        active_provider_id,
        providers,
    })
}

/// List models available with the current or provided API configuration.
#[tauri::command]
pub async fn list_models(
    state: State<'_, AppState>,
    payload: ListModelsPayload,
) -> Result<Vec<ModelInfo>, String> {
    let provider_id = if payload.provider_id.trim().is_empty() {
        state.active_provider_id.lock().unwrap().clone()
    } else {
        payload.provider_id
    };
    let saved = state
        .provider_settings
        .lock()
        .unwrap()
        .get(&provider_id)
        .cloned()
        .unwrap_or_else(|| default_provider_settings(&provider_id));

    let api_key = if payload.api_key.trim().is_empty() {
        saved.api_key
    } else {
        payload.api_key
    };

    if api_key.trim().is_empty() {
        return Err("API key not configured. Please enter or save your API key first.".to_string());
    }

    let api_endpoint = if payload.api_endpoint.trim().is_empty() {
        saved.api_endpoint
    } else {
        payload.api_endpoint
    };
    let model = saved.model;

    LlmClient::new(&provider_id, &api_key, &api_endpoint, &model)
        .list_models()
        .await
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to locate app config directory: {}", e))?;
    Ok(dir.join(SETTINGS_FILE))
}

fn read_settings(app: &AppHandle) -> Result<PersistedSettings, String> {
    let path = settings_path(app)?;
    if !path.exists() {
        return Ok(PersistedSettings::default());
    }

    let contents =
        fs::read_to_string(&path).map_err(|e| format!("Failed to read settings file: {}", e))?;
    serde_json::from_str(&contents).map_err(|e| format!("Failed to parse settings file: {}", e))
}

fn write_settings(app: &AppHandle, settings: &PersistedSettings) -> Result<(), String> {
    let path = settings_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create settings directory: {}", e))?;
    }

    let contents = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(&path, contents).map_err(|e| format!("Failed to write settings file: {}", e))
}

fn default_provider_settings(id: &str) -> ProviderSettings {
    ProviderSettings {
        api_key: String::new(),
        api_endpoint: default_endpoint(id).to_string(),
        model: default_model(id).to_string(),
    }
}

fn normalize_settings(settings: &mut PersistedSettings) {
    if settings.active_provider_id.trim().is_empty()
        || !built_in_provider_ids().contains(&settings.active_provider_id.as_str())
    {
        settings.active_provider_id = "anthropic".to_string();
    }
    for id in built_in_provider_ids() {
        let entry = settings
            .providers
            .entry(id.to_string())
            .or_insert_with(|| default_provider_settings(id));
        if entry.api_endpoint.trim().is_empty() {
            entry.api_endpoint = default_endpoint(id).to_string();
        }
        if entry.model.trim().is_empty() {
            entry.model = default_model(id).to_string();
        }
    }
}
