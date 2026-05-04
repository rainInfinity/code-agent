use crate::models::*;
use crate::providers::{LlmProvider, ParseResult};

pub struct OpenAiProvider;

impl LlmProvider for OpenAiProvider {
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

    fn build_chat_request(
        &self,
        model: &str,
        system: Option<String>,
        messages: &[ChatMessage],
    ) -> serde_json::Value {
        let mut messages = messages.to_vec();
        if let Some(system) = system.filter(|value| !value.trim().is_empty()) {
            messages.insert(
                0,
                ChatMessage {
                    role: "system".to_string(),
                    content: system.clone(),
                    content_blocks: Some(vec![ContentBlock::Text { text: system }]),
                },
            );
        }

        serde_json::json!(OpenAiChatRequest {
            model: model.to_string(),
            messages,
            stream: true,
            stream_options: OpenAiStreamOptions {
                include_usage: true,
            },
        })
    }

    fn parse_stream_data(&self, data: &str) -> Result<Option<ParseResult>, String> {
        if data.trim() == "[DONE]" {
            return Ok(None);
        }
        let chunk = serde_json::from_str::<OpenAiStreamChunk>(data)
            .map_err(|e| format!("Failed to parse OpenAI stream event: {}", e))?;
        if chunk.choices.is_empty() {
            if let Some(usage) = chunk.usage {
                return Ok(Some(ParseResult::Usage {
                    input_tokens: usage
                        .get("prompt_tokens")
                        .and_then(|value| value.as_u64())
                        .unwrap_or(0) as u32,
                    output_tokens: usage
                        .get("completion_tokens")
                        .and_then(|value| value.as_u64())
                        .unwrap_or(0) as u32,
                }));
            }
            return Ok(None);
        }
        Ok(chunk
            .choices
            .first()
            .and_then(|choice| choice.delta.as_ref())
            .and_then(|delta| delta.content.clone())
            .map(ParseResult::TextDelta))
    }

    fn parse_models_response(&self, body: &str) -> Result<Vec<ModelInfo>, String> {
        serde_json::from_str::<OpenAiModelsResponse>(body)
            .map(|response| {
                response
                    .data
                    .into_iter()
                    .map(|model| ModelInfo {
                        id: model.id.clone(),
                        display_name: model.id,
                        created_at: model.created.map(|v| v.to_string()).unwrap_or_default(),
                        model_type: model.owned_by,
                    })
                    .collect()
            })
            .map_err(|e| format!("Failed to parse OpenAI models response: {}", e))
    }
}
