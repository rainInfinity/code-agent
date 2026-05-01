use crate::llm::LlmClient;
use crate::models::*;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

const SETTINGS_FILE: &str = "settings.json";

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedSettings {
    api_key: String,
    api_endpoint: String,
    model: String,
}

/// Application state holding settings
pub struct AppState {
    pub api_key: Mutex<String>,
    pub api_endpoint: Mutex<String>,
    pub model: Mutex<String>,
}

impl AppState {
    pub fn new(app: &AppHandle) -> Self {
        let saved = read_settings(app).unwrap_or_default();

        Self {
            api_key: Mutex::new(saved.api_key),
            api_endpoint: Mutex::new(if saved.api_endpoint.trim().is_empty() {
                "https://api.anthropic.com".to_string()
            } else {
                saved.api_endpoint
            }),
            model: Mutex::new(if saved.model.trim().is_empty() {
                "claude-haiku-4-5-20251001".to_string()
            } else {
                saved.model
            }),
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
    let api_key = state.api_key.lock().unwrap().clone();
    let api_endpoint = state.api_endpoint.lock().unwrap().clone();
    let model = state.model.lock().unwrap().clone();

    if api_key.is_empty() {
        return Err("API key not configured. Please set your API key in Settings.".to_string());
    }

    let client = LlmClient::new(&api_key, &api_endpoint, &model);

    let conversation_id = payload.conversation_id.clone();
    let message_id = payload.assistant_message_id.clone();

    let conv_id = conversation_id.clone();
    let msg_id = message_id.clone();
    let app_clone = app.clone();
    let app_err = app.clone();
    let conv_id_err = conversation_id.clone();
    let msg_id_err = message_id.clone();

    let result = client
        .stream_chat(
            payload.messages,
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
        Ok(full_content) => {
            let _ = app.emit(
                "stream-end",
                StreamEndEvent {
                    conversation_id,
                    message_id,
                    full_content,
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
    if !settings.api_key.trim().is_empty() {
        *state.api_key.lock().unwrap() = settings.api_key;
    }
    *state.api_endpoint.lock().unwrap() = settings.api_endpoint;
    *state.model.lock().unwrap() = settings.model;

    write_settings(
        &app,
        &PersistedSettings {
            api_key: state.api_key.lock().unwrap().clone(),
            api_endpoint: state.api_endpoint.lock().unwrap().clone(),
            model: state.model.lock().unwrap().clone(),
        },
    )?;

    Ok(())
}

/// Load settings (without exposing API key)
#[tauri::command]
pub async fn load_settings(state: State<'_, AppState>) -> Result<SettingsResponse, String> {
    let api_key = state.api_key.lock().unwrap();
    let api_endpoint = state.api_endpoint.lock().unwrap();
    let model = state.model.lock().unwrap();

    Ok(SettingsResponse {
        api_endpoint: api_endpoint.clone(),
        model: model.clone(),
        has_api_key: !api_key.is_empty(),
    })
}

/// List models available with the current or provided API configuration.
#[tauri::command]
pub async fn list_models(
    state: State<'_, AppState>,
    payload: ListModelsPayload,
) -> Result<Vec<ModelInfo>, String> {
    let api_key = if payload.api_key.trim().is_empty() {
        state.api_key.lock().unwrap().clone()
    } else {
        payload.api_key
    };

    if api_key.trim().is_empty() {
        return Err("API key not configured. Please enter or save your API key first.".to_string());
    }

    let api_endpoint = if payload.api_endpoint.trim().is_empty() {
        state.api_endpoint.lock().unwrap().clone()
    } else {
        payload.api_endpoint
    };
    let model = state.model.lock().unwrap().clone();

    LlmClient::new(&api_key, &api_endpoint, &model)
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

    let contents = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read settings file: {}", e))?;
    serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse settings file: {}", e))
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
