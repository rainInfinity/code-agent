use crate::models::*;
use crate::providers::LlmProvider;

pub struct DeepSeekProvider;

impl LlmProvider for DeepSeekProvider {
    fn chat_path(&self) -> &str {
        "/v1/chat/completions"
    }

    fn models_path(&self) -> &str {
        "/v1/models"
    }

    fn auth_header(&self, api_key: &str) -> (String, String) {
        ("Authorization".to_string(), format!("Bearer {}", api_key))
    }

    fn extra_headers(&self) -> Vec<(String, String)> {
        Vec::new()
    }

    fn build_chat_request(&self, model: &str, messages: &[ChatMessage]) -> serde_json::Value {
        serde_json::json!(OpenAiChatRequest {
            model: model.to_string(),
            messages: messages.to_vec(),
            stream: true,
        })
    }

    fn parse_stream_data(&self, data: &str) -> Result<Option<String>, String> {
        if data.trim() == "[DONE]" {
            return Ok(None);
        }
        let chunk = serde_json::from_str::<OpenAiStreamChunk>(data)
            .map_err(|e| format!("Failed to parse DeepSeek stream event: {}", e))?;
        Ok(chunk
            .choices
            .first()
            .and_then(|choice| choice.delta.as_ref())
            .and_then(|delta| delta.content.clone()))
    }

    fn parse_models_response(&self, body: &str) -> Result<Vec<ModelInfo>, String> {
        match serde_json::from_str::<OpenAiModelsResponse>(body) {
            Ok(response) => Ok(response
                .data
                .into_iter()
                .map(|model| ModelInfo {
                    id: model.id.clone(),
                    display_name: model.id,
                    created_at: model.created.map(|v| v.to_string()).unwrap_or_default(),
                    model_type: model.owned_by,
                })
                .collect()),
            Err(_) => Ok(vec![
                ModelInfo {
                    id: "deepseek-chat".to_string(),
                    display_name: "DeepSeek Chat".to_string(),
                    created_at: String::new(),
                    model_type: "deepseek".to_string(),
                },
                ModelInfo {
                    id: "deepseek-reasoner".to_string(),
                    display_name: "DeepSeek Reasoner".to_string(),
                    created_at: String::new(),
                    model_type: "deepseek".to_string(),
                },
            ]),
        }
    }
}
