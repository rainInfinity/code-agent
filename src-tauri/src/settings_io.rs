use crate::models::{PersistedSettings, ProviderSettings};
use crate::providers::{built_in_provider_ids, default_endpoint, default_model};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const SETTINGS_FILE: &str = "settings.json";

pub fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to locate app config directory: {}", e))?;
    Ok(dir.join(SETTINGS_FILE))
}

pub fn read_settings(app: &AppHandle) -> Result<PersistedSettings, String> {
    let path = settings_path(app)?;
    if !path.exists() {
        return Ok(PersistedSettings::default());
    }

    let contents =
        fs::read_to_string(&path).map_err(|e| format!("Failed to read settings file: {}", e))?;
    serde_json::from_str(&contents).map_err(|e| format!("Failed to parse settings file: {}", e))
}

pub fn write_settings(app: &AppHandle, settings: &PersistedSettings) -> Result<(), String> {
    let path = settings_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create settings directory: {}", e))?;
    }

    let contents = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(&path, contents).map_err(|e| format!("Failed to write settings file: {}", e))
}

pub fn default_provider_settings(id: &str) -> ProviderSettings {
    ProviderSettings {
        api_key: String::new(),
        api_endpoint: default_endpoint(id).to_string(),
        model: default_model(id).to_string(),
    }
}

pub fn normalize_settings(settings: &mut PersistedSettings) {
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
