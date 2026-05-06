use crate::models::*;
use crate::providers::{LlmProvider, ParseResult};

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
            .map_err(|e| format!("Failed to parse Anthropic stream event: {}", e))?;
        match event {
            StreamEvent::MessageStart { message } => {
                let input_tokens = message
                    .get("usage")
                    .and_then(|usage| usage.get("input_tokens"))
                    .and_then(|value| value.as_u64())
                    .unwrap_or(0) as u32;
                Ok(Some(ParseResult::Usage {
                    input_tokens,
                    output_tokens: 0,
                }))
            }
            StreamEvent::ContentBlockDelta { delta, .. } if delta.delta_type == "text_delta" => {
                Ok(Some(ParseResult::TextDelta(delta.text)))
            }
            StreamEvent::ContentBlockDelta { delta, .. }
                if delta.delta_type == "thinking_delta" =>
            {
                Ok(Some(ParseResult::ThinkingDelta(delta.thinking)))
            }
            StreamEvent::ContentBlockDelta { delta, .. }
                if delta.delta_type == "signature_delta" =>
            {
                Ok(Some(ParseResult::ThinkingSignature(delta.signature)))
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
                    let input_json = content_block
                        .get("input")
                        .filter(|value| !value.is_null() && *value != &serde_json::json!({}))
                        .map(|value| value.to_string());
                    Ok(Some(ParseResult::ToolUseStart {
                        index,
                        id,
                        name,
                        input_json,
                    }))
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
            StreamEvent::MessageDelta { usage, .. } => {
                if let Some(usage) = usage {
                    let output_tokens = usage
                        .get("output_tokens")
                        .and_then(|value| value.as_u64())
                        .unwrap_or(0) as u32;
                    Ok(Some(ParseResult::Usage {
                        input_tokens: 0,
                        output_tokens,
                    }))
                } else {
                    Ok(None)
                }
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn includes_non_empty_system_prompt() {
        let request =
            AnthropicProvider.build_chat_request("claude-test", Some("system".into()), &[]);

        assert_eq!(
            request.get("system").and_then(|value| value.as_str()),
            Some("system")
        );
    }

    #[test]
    fn omits_empty_system_prompt() {
        let request = AnthropicProvider.build_chat_request("claude-test", Some("  ".into()), &[]);

        assert!(request.get("system").is_none());
    }

    #[test]
    fn serializes_thinking_content_blocks_in_messages() {
        let request = AnthropicProvider.build_chat_request(
            "claude-test",
            None,
            &[ChatMessage {
                role: "assistant".to_string(),
                content: "final answer".to_string(),
                content_blocks: Some(vec![
                    ContentBlock::Thinking {
                        thinking: "reasoning".to_string(),
                        signature: Some("sig-123".to_string()),
                    },
                    ContentBlock::Text {
                        text: "final answer".to_string(),
                    },
                ]),
            }],
        );

        assert_eq!(
            request["messages"][0]["content"],
            json!([
                {
                    "type": "thinking",
                    "thinking": "reasoning",
                    "signature": "sig-123",
                },
                {
                    "type": "text",
                    "text": "final answer",
                }
            ])
        );
    }

    #[test]
    fn parses_tool_use_start_with_inline_input() {
        let event = serde_json::json!({
            "type": "content_block_start",
            "index": 0,
            "content_block": {
                "type": "tool_use",
                "id": "toolu_123",
                "name": "read_file",
                "input": {
                    "file_path": "src/main.rs"
                }
            }
        });

        let result = AnthropicProvider
            .parse_stream_data(&event.to_string())
            .unwrap();

        assert!(matches!(
            result,
            Some(ParseResult::ToolUseStart { index, id, name, input_json })
                if index == 0
                    && id == "toolu_123"
                    && name == "read_file"
                    && input_json.as_deref() == Some("{\"file_path\":\"src/main.rs\"}")
        ));
    }

    #[test]
    fn parses_tool_use_partial_json_delta() {
        let event = serde_json::json!({
            "type": "content_block_delta",
            "index": 1,
            "delta": {
                "type": "input_json_delta",
                "partial_json": "{\"file_path\":\"main.py\"}"
            }
        });

        let result = AnthropicProvider
            .parse_stream_data(&event.to_string())
            .unwrap();

        assert!(matches!(
            result,
            Some(ParseResult::ToolUseDelta { index, input_json_delta })
                if index == 1 && input_json_delta == "{\"file_path\":\"main.py\"}"
        ));
    }
}
