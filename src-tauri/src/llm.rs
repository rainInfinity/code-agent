use crate::models::*;
use crate::providers::{provider_from_id, ParseResult};
use futures_util::StreamExt;
use reqwest::Client;
use serde_json::Value;
use std::collections::HashMap;
use tokio_util::sync::CancellationToken;

/// Provider-aware LLM client.
pub struct LlmClient {
    client: Client,
    provider_id: String,
    api_key: String,
    api_endpoint: String,
    model: String,
}

#[derive(Debug, Clone)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub input: Value,
}

struct PendingToolUse {
    id: String,
    name: String,
    input_json: String,
}

impl LlmClient {
    pub fn new(provider_id: &str, api_key: &str, api_endpoint: &str, model: &str) -> Self {
        Self {
            client: Client::new(),
            provider_id: provider_id.to_string(),
            api_key: api_key.to_string(),
            api_endpoint: api_endpoint.to_string(),
            model: model.to_string(),
        }
    }

    /// List models available to the configured provider/API key.
    pub async fn list_models(&self) -> Result<Vec<ModelInfo>, String> {
        let provider = provider_from_id(&self.provider_id)?;
        let url = format!(
            "{}{}",
            self.api_endpoint.trim_end_matches('/'),
            provider.models_path()
        );
        let (auth_name, auth_value) = provider.auth_header(&self.api_key);

        let mut request = self.client.get(&url).header(auth_name, auth_value);
        for (name, value) in provider.extra_headers() {
            request = request.header(name, value);
        }

        let response = request
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("API error ({}): {}", status, body));
        }

        let body = response
            .text()
            .await
            .map_err(|e| format!("Failed to read models response: {}", e))?;

        provider.parse_models_response(&body)
    }

    /// Send a streaming request to the active provider.
    pub async fn stream_chat(
        &self,
        messages: Vec<ChatMessage>,
        mut on_delta: impl FnMut(String),
        mut on_thinking_delta: impl FnMut(String),
        mut on_error: impl FnMut(String),
    ) -> Result<String, String> {
        let provider = provider_from_id(&self.provider_id)?;
        let url = format!(
            "{}{}",
            self.api_endpoint.trim_end_matches('/'),
            provider.chat_path()
        );
        let request_body = provider.build_chat_request(&self.model, &messages);
        let (auth_name, auth_value) = provider.auth_header(&self.api_key);

        let mut request = self
            .client
            .post(&url)
            .header(auth_name, auth_value)
            .header("content-type", "application/json")
            .json(&request_body);
        for (name, value) in provider.extra_headers() {
            request = request.header(name, value);
        }

        let response = request
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("API error ({}): {}", status, body));
        }

        let mut full_content = String::new();
        let mut stream = response.bytes_stream();

        let mut buffer = String::new();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| format!("Stream error: {}", e))?;
            let text = String::from_utf8_lossy(&chunk);
            buffer.push_str(&text);

            // Process complete SSE lines
            while let Some(pos) = buffer.find("\n\n") {
                let event_text = buffer[..pos].to_string();
                buffer = buffer[pos + 2..].to_string();

                // Parse SSE event
                for line in event_text.lines() {
                    if let Some(data) = line.strip_prefix("data: ") {
                        match provider.parse_stream_data(data) {
                            Ok(Some(ParseResult::TextDelta(delta))) => {
                                full_content.push_str(&delta);
                                on_delta(delta);
                            }
                            Ok(Some(ParseResult::ThinkingDelta(delta))) => {
                                on_thinking_delta(delta);
                            }
                            Ok(Some(_)) => {}
                            Ok(None) => {
                                if data.trim() == "[DONE]" {
                                    return Ok(full_content);
                                }
                            }
                            Err(error) => {
                                on_error(error.clone());
                                return Err(error);
                            }
                        }
                    }
                }
            }
        }

        Ok(full_content)
    }

    pub async fn stream_chat_with_tools(
        &self,
        messages: Vec<ChatMessage>,
        tools: Vec<ToolDefinition>,
        cancel_token: CancellationToken,
        mut on_text_delta: impl FnMut(String),
        mut on_thinking_delta: impl FnMut(String),
        mut on_tool_call: impl FnMut(ToolCall),
        mut on_error: impl FnMut(String),
    ) -> Result<String, String> {
        let provider = provider_from_id(&self.provider_id)?;
        let url = format!(
            "{}{}",
            self.api_endpoint.trim_end_matches('/'),
            provider.chat_path()
        );
        let mut request_body = provider.build_chat_request(&self.model, &messages);
        if matches!(self.provider_id.as_str(), "anthropic" | "deepseek") && !tools.is_empty() {
            if let Some(object) = request_body.as_object_mut() {
                object.insert(
                    "tools".to_string(),
                    serde_json::to_value(tools)
                        .map_err(|e| format!("Failed to serialize tools: {}", e))?,
                );
            }
        }
        let (auth_name, auth_value) = provider.auth_header(&self.api_key);

        let mut request = self
            .client
            .post(&url)
            .header(auth_name, auth_value)
            .header("content-type", "application/json")
            .json(&request_body);
        for (name, value) in provider.extra_headers() {
            request = request.header(name, value);
        }

        let response = tokio::select! {
            response = request.send() => response.map_err(|e| format!("Network error: {}", e))?,
            _ = cancel_token.cancelled() => return Err("Cancelled".to_string()),
        };

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("API error ({}): {}", status, body));
        }

        let mut full_content = String::new();
        let mut stream = response.bytes_stream();
        let mut buffer = String::new();
        let mut pending_tools: HashMap<usize, PendingToolUse> = HashMap::new();

        loop {
            let chunk = tokio::select! {
                chunk = stream.next() => chunk,
                _ = cancel_token.cancelled() => return Err("Cancelled".to_string()),
            };

            let Some(chunk) = chunk else {
                break;
            };
            let chunk = chunk.map_err(|e| format!("Stream error: {}", e))?;
            let text = String::from_utf8_lossy(&chunk);
            buffer.push_str(&text);

            while let Some(pos) = buffer.find("\n\n") {
                let event_text = buffer[..pos].to_string();
                buffer = buffer[pos + 2..].to_string();

                for line in event_text.lines() {
                    if let Some(data) = line.strip_prefix("data: ") {
                        if data.trim() == "[DONE]" {
                            return Ok(full_content);
                        }

                        match provider.parse_stream_data(data) {
                            Ok(Some(ParseResult::TextDelta(delta))) => {
                                full_content.push_str(&delta);
                                on_text_delta(delta);
                            }
                            Ok(Some(ParseResult::ThinkingDelta(delta))) => {
                                on_thinking_delta(delta);
                            }
                            Ok(Some(ParseResult::ToolUseStart { index, id, name })) => {
                                pending_tools.insert(
                                    index,
                                    PendingToolUse {
                                        id,
                                        name,
                                        input_json: String::new(),
                                    },
                                );
                            }
                            Ok(Some(ParseResult::ToolUseDelta {
                                index,
                                input_json_delta,
                            })) => {
                                if let Some(tool) = pending_tools.get_mut(&index) {
                                    tool.input_json.push_str(&input_json_delta);
                                }
                            }
                            Ok(Some(ParseResult::ToolUseComplete { index })) => {
                                if let Some(tool) = pending_tools.remove(&index) {
                                    let input =
                                        serde_json::from_str(&tool.input_json).map_err(|e| {
                                            format!("Failed to parse tool input JSON: {}", e)
                                        })?;
                                    on_tool_call(ToolCall {
                                        id: tool.id,
                                        name: tool.name,
                                        input,
                                    });
                                }
                            }
                            Ok(None) => {}
                            Err(error) => {
                                on_error(error.clone());
                                return Err(error);
                            }
                        }
                    }
                }
            }
        }

        Ok(full_content)
    }
}
