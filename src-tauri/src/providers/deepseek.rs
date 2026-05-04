use crate::models::*;
use crate::providers::{LlmProvider, ParseResult};

pub struct DeepSeekProvider;

impl LlmProvider for DeepSeekProvider {
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

    fn build_chat_request(
        &self,
        model: &str,
        system: Option<String>,
        messages: &[ChatMessage],
    ) -> serde_json::Value {
        let messages = messages
            .iter()
            .map(|message| {
                let content = message
                    .content_blocks
                    .as_ref()
                    .map(|blocks| {
                        serde_json::to_value(blocks)
                            .unwrap_or_else(|_| serde_json::json!(message.content))
                    })
                    .unwrap_or_else(|| serde_json::json!(message.content));
                serde_json::json!({
                    "role": message.role,
                    "content": content,
                })
            })
            .collect();

        serde_json::json!(AnthropicRequest {
            model: model.to_string(),
            max_tokens: 4096,
            system: system.filter(|value| !value.trim().is_empty()),
            messages,
            stream: true,
            tools: Vec::new(),
        })
    }

    fn parse_stream_data(&self, data: &str) -> Result<Option<ParseResult>, String> {
        let event = serde_json::from_str::<StreamEvent>(data)
            .map_err(|e| format!("Failed to parse DeepSeek stream event: {}", e))?;
        match event {
            StreamEvent::ContentBlockDelta { delta, .. } if delta.delta_type == "text_delta" => {
                Ok(Some(ParseResult::TextDelta(delta.text)))
            }
            StreamEvent::ContentBlockDelta { delta, .. }
                if delta.delta_type == "thinking_delta" =>
            {
                Ok(Some(ParseResult::ThinkingDelta(delta.thinking)))
            }
            StreamEvent::ContentBlockStart {
                index,
                content_block,
            } => {
                if content_block.get("type").and_then(|value| value.as_str()) == Some("tool_use") {
                    let id = content_block
                        .get("id")
                        .and_then(|value| value.as_str())
                        .unwrap_or_default()
                        .to_string();
                    let name = content_block
                        .get("name")
                        .and_then(|value| value.as_str())
                        .unwrap_or_default()
                        .to_string();
                    Ok(Some(ParseResult::ToolUseStart { index, id, name }))
                } else {
                    Ok(None)
                }
            }
            StreamEvent::ContentBlockDelta { index, delta }
                if delta.delta_type == "input_json_delta" =>
            {
                Ok(Some(ParseResult::ToolUseDelta {
                    index,
                    input_json_delta: delta.input_json_delta,
                }))
            }
            StreamEvent::ContentBlockStop { index } => {
                Ok(Some(ParseResult::ToolUseComplete { index }))
            }
            StreamEvent::Error { error } => Err(format!("{}: {}", error.error_type, error.message)),
            _ => Ok(None),
        }
    }

    fn parse_models_response(&self, body: &str) -> Result<Vec<ModelInfo>, String> {
        match serde_json::from_str::<ModelsResponse>(body) {
            Ok(response) => Ok(response.data),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn includes_non_empty_system_prompt() {
        let request =
            DeepSeekProvider.build_chat_request("deepseek-chat", Some("system".into()), &[]);

        assert_eq!(request.get("system").and_then(|value| value.as_str()), Some("system"));
    }
}
