use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::api::default_provider_id;

/// Settings payload from frontend
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPayload {
    pub provider_id: String,
    pub api_key: String,
    pub api_endpoint: String,
    pub model: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderSettings {
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub api_endpoint: String,
    #[serde(default)]
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedSettings {
    #[serde(default = "default_provider_id")]
    pub active_provider_id: String,
    #[serde(default)]
    pub providers: HashMap<String, ProviderSettings>,
}

impl Default for PersistedSettings {
    fn default() -> Self {
        Self {
            active_provider_id: default_provider_id(),
            providers: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderSettingsSummary {
    pub api_endpoint: String,
    pub model: String,
    pub has_api_key: bool,
}

/// Settings response to frontend (without API key)
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsResponse {
    pub active_provider_id: String,
    pub providers: HashMap<String, ProviderSettingsSummary>,
}

/// Payload from frontend for listing available models.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListModelsPayload {
    pub provider_id: String,
    pub api_key: String,
    pub api_endpoint: String,
}
