use crate::models::*;
use crate::providers::LlmProvider;

pub struct AnthropicProvider;

impl LlmProvider for AnthropicProvider {
    fn chat_path(&self) -> &str {
        "/v1/messages"
    }

    fn models_path(&self) -> &str {
        "/v1/models?limit=1000"
    }

    fn auth_header(&self, api_key: &str) -> (String, String) {
        ("x-api-key".to_string(), api_key.to_string())
    }

    fn extra_headers(&self) -> Vec<(String, String)> {
        vec![("anthropic-version".to_string(), "2023-06-01".to_string())]
    }

    fn build_chat_request(&self, model: &str, messages: &[ChatMessage]) -> serde_json::Value {
        serde_json::json!(AnthropicRequest {
            model: model.to_string(),
            max_tokens: 4096,
            messages: messages.to_vec(),
            stream: true,
        })
    }

    fn parse_stream_data(&self, data: &str) -> Result<Option<String>, String> {
        let event = serde_json::from_str::<StreamEvent>(data)
            .map_err(|e| format!("Failed to parse Anthropic stream event: {}", e))?;
        match event {
            StreamEvent::ContentBlockDelta { delta, .. } if delta.delta_type == "text_delta" => {
                Ok(Some(delta.text))
            }
            StreamEvent::Error { error } => Err(format!("{}: {}", error.error_type, error.message)),
            _ => Ok(None),
        }
    }

    fn parse_models_response(&self, body: &str) -> Result<Vec<ModelInfo>, String> {
        serde_json::from_str::<ModelsResponse>(body)
            .map(|response| response.data)
            .map_err(|e| format!("Failed to parse Anthropic models response: {}", e))
    }
}
