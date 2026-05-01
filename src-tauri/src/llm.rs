use crate::models::*;
use futures_util::StreamExt;
use reqwest::Client;

/// LLM client for Anthropic Messages API
pub struct LlmClient {
    client: Client,
    api_key: String,
    api_endpoint: String,
    model: String,
}

impl LlmClient {
    pub fn new(api_key: &str, api_endpoint: &str, model: &str) -> Self {
        Self {
            client: Client::new(),
            api_key: api_key.to_string(),
            api_endpoint: api_endpoint.to_string(),
            model: model.to_string(),
        }
    }

    /// List models available to the configured Anthropic API key.
    pub async fn list_models(&self) -> Result<Vec<ModelInfo>, String> {
        let url = format!("{}/v1/models?limit=1000", self.api_endpoint.trim_end_matches('/'));

        let response = self
            .client
            .get(&url)
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("API error ({}): {}", status, body));
        }

        let models = response
            .json::<ModelsResponse>()
            .await
            .map_err(|e| format!("Failed to parse models response: {}", e))?;

        Ok(models.data)
    }

    /// Send a streaming request to Anthropic Messages API
    pub async fn stream_chat(
        &self,
        messages: Vec<ChatMessage>,
        mut on_delta: impl FnMut(String),
        mut on_error: impl FnMut(String),
    ) -> Result<String, String> {
        let url = format!("{}/v1/messages", self.api_endpoint);

        let request_body = AnthropicRequest {
            model: self.model.clone(),
            max_tokens: 4096,
            messages,
            stream: true,
        };

        let response = self
            .client
            .post(&url)
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&request_body)
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
                        if let Ok(event) = serde_json::from_str::<StreamEvent>(data) {
                            match event {
                                StreamEvent::ContentBlockDelta { delta, .. } => {
                                    if delta.delta_type == "text_delta" {
                                        full_content.push_str(&delta.text);
                                        on_delta(delta.text);
                                    }
                                }
                                StreamEvent::Error { error } => {
                                    on_error(format!("{}: {}", error.error_type, error.message));
                                    return Err(error.message);
                                }
                                StreamEvent::MessageStop => {
                                    return Ok(full_content);
                                }
                                _ => {}
                            }
                        }
                    }
                }
            }
        }

        Ok(full_content)
    }
}
