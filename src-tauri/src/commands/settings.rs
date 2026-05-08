use crate::models::*;
use crate::providers::built_in_provider_ids;
use crate::settings_io::{self, default_provider_settings};
use crate::state::AppState;
use tauri::{AppHandle, State};

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

    settings_io::write_settings(&app, &persisted)?;

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

    crate::llm::LlmClient::new(&provider_id, &api_key, &api_endpoint, &model)
        .list_models()
        .await
}
