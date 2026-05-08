use crate::agent::AgentRuntime;
use crate::models::ProviderSettings;
use crate::settings_io::{normalize_settings, read_settings};
use crate::tools::ToolRegistry;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::AppHandle;

/// Application state managed by Tauri
pub struct AppState {
    pub active_provider_id: Mutex<String>,
    pub provider_settings: Mutex<HashMap<String, ProviderSettings>>,
    pub agent_runtime: Arc<AgentRuntime>,
    pub tool_registry: Arc<ToolRegistry>,
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
