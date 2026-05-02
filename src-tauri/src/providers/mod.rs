mod anthropic;
mod deepseek;
mod openai;

pub use anthropic::AnthropicProvider;
pub use deepseek::DeepSeekProvider;
pub use openai::OpenAiProvider;

use crate::models::{ChatMessage, ModelInfo};

pub trait LlmProvider: Send + Sync {
    fn chat_path(&self) -> &str;
    fn models_path(&self) -> &str;
    fn auth_header(&self, api_key: &str) -> (String, String);
    fn extra_headers(&self) -> Vec<(String, String)>;
    fn build_chat_request(&self, model: &str, messages: &[ChatMessage]) -> serde_json::Value;
    fn parse_stream_data(&self, data: &str) -> Result<Option<String>, String>;
    fn parse_models_response(&self, body: &str) -> Result<Vec<ModelInfo>, String>;
}

pub fn provider_from_id(id: &str) -> Result<Box<dyn LlmProvider>, String> {
    match id {
        "anthropic" => Ok(Box::new(AnthropicProvider)),
        "deepseek" => Ok(Box::new(DeepSeekProvider)),
        "openai" => Ok(Box::new(OpenAiProvider)),
        other => Err(format!("Unsupported provider: {}", other)),
    }
}

pub fn default_endpoint(id: &str) -> &'static str {
    match id {
        "deepseek" => "https://api.deepseek.com",
        "openai" => "https://api.openai.com",
        _ => "https://api.anthropic.com",
    }
}

pub fn default_model(id: &str) -> &'static str {
    match id {
        "deepseek" => "deepseek-chat",
        "openai" => "gpt-4.1-mini",
        _ => "claude-haiku-4-5-20251001",
    }
}

pub fn built_in_provider_ids() -> [&'static str; 3] {
    ["anthropic", "deepseek", "openai"]
}
