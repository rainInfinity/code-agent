pub mod chat;
pub mod api;
pub mod events;
pub mod settings;
pub mod tools;

// Re-export all public types from sub-modules
pub use chat::*;
pub use api::*;
pub use events::*;
pub use settings::*;
pub use tools::*;

#[cfg(test)]
mod tests {
    use super::chat::ContentBlock;
    use serde_json::json;

    #[test]
    fn content_block_thinking_serializes_with_expected_shape() {
        let block = ContentBlock::Thinking {
            thinking: "reasoning".to_string(),
            signature: Some("sig-123".to_string()),
        };

        assert_eq!(
            serde_json::to_value(block).unwrap(),
            json!({
                "type": "thinking",
                "thinking": "reasoning",
                "signature": "sig-123",
            })
        );
    }
}
