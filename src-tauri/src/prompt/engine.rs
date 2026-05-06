use super::builtins;
use super::templates::{PromptSection, PromptTemplate, TemplateRegistry};
use crate::models::{ChatMessage, ContentBlock, SessionContext, ToolDefinition};
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone)]
pub struct PromptBuildResult {
    pub system_prompt: String,
    pub messages: Vec<ChatMessage>,
    pub tools: Vec<ToolDefinition>,
}

#[derive(Debug, Clone, Copy, Default)]
pub struct PromptBuildOptions {
    pub preserve_thinking_blocks: bool,
}

pub fn collect_session_context(cwd: Option<&str>) -> SessionContext {
    let cwd = cwd
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| {
            std::env::current_dir()
                .ok()
                .map(|path| path.display().to_string())
        })
        .unwrap_or_default();

    SessionContext {
        os: std::env::consts::OS.to_string(),
        shell: shell_name(),
        arch: std::env::consts::ARCH.to_string(),
        git_branch: git_output(&cwd, ["rev-parse", "--abbrev-ref", "HEAD"]),
        git_status: git_output(&cwd, ["status", "--short"]),
        cwd,
    }
}

pub struct PromptEngine {
    templates: TemplateRegistry,
}

fn sanitize_prompt_message(message: &ChatMessage, options: PromptBuildOptions) -> ChatMessage {
    let is_assistant = message.role == "assistant";
    let preserve_thinking_blocks = options.preserve_thinking_blocks
        || is_assistant
            && message
                .content_blocks
                .as_ref()
                .map(|blocks| {
                    blocks
                        .iter()
                        .any(|block| matches!(block, ContentBlock::ToolUse { .. }))
                })
                .unwrap_or(false);

    let content_blocks = message.content_blocks.as_ref().map(|blocks| {
        blocks
            .iter()
            .filter(|block| {
                (preserve_thinking_blocks || !matches!(block, ContentBlock::Thinking { .. }))
                    && !(is_assistant && matches!(block, ContentBlock::ToolResult { .. }))
            })
            .cloned()
            .collect::<Vec<_>>()
    });

    ChatMessage {
        role: message.role.clone(),
        content: message.content.clone(),
        content_blocks: content_blocks.filter(|blocks| !blocks.is_empty()),
    }
}

impl PromptEngine {
    pub fn new() -> Self {
        Self {
            templates: builtins::registry(),
        }
    }

    pub fn build(
        &self,
        agent_type: &str,
        messages: &[ChatMessage],
        tools: &[ToolDefinition],
        session_ctx: &SessionContext,
        options: PromptBuildOptions,
    ) -> PromptBuildResult {
        let template = self.template_for(agent_type);
        let system_prompt = template
            .sections
            .iter()
            .map(|section| match section {
                PromptSection::Static(content) | PromptSection::Include(content) => {
                    content.trim().to_string()
                }
                PromptSection::Dynamic(content) => render_runtime_context(content, session_ctx),
            })
            .filter(|section| !section.is_empty())
            .collect::<Vec<_>>()
            .join("\n\n");

        PromptBuildResult {
            system_prompt,
            messages: messages
                .iter()
                .map(|message| sanitize_prompt_message(message, options))
                .collect(),
            tools: tools.to_vec(),
        }
    }

    fn template_for(&self, agent_type: &str) -> &PromptTemplate {
        let key = if agent_type == "chat" { "chat" } else { "code" };
        self.templates
            .get(key)
            .expect("built-in prompt template is registered")
    }
}

impl Default for PromptEngine {
    fn default() -> Self {
        Self::new()
    }
}

fn render_runtime_context(template: &str, ctx: &SessionContext) -> String {
    template
        .replace("{{os}}", &ctx.os)
        .replace("{{shell}}", &ctx.shell)
        .replace("{{arch}}", &ctx.arch)
        .replace("{{cwd}}", &ctx.cwd)
        .replace(
            "{{git_branch}}",
            ctx.git_branch.as_deref().unwrap_or("unavailable"),
        )
        .replace(
            "{{git_status}}",
            ctx.git_status.as_deref().unwrap_or("unavailable"),
        )
        .trim()
        .to_string()
}

fn shell_name() -> String {
    std::env::var("SHELL")
        .or_else(|_| std::env::var("ComSpec"))
        .ok()
        .and_then(|value| {
            Path::new(&value)
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
        })
        .unwrap_or_else(|| "unknown".to_string())
}

fn git_output<const N: usize>(cwd: &str, args: [&str; N]) -> Option<String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if value.is_empty() {
        Some("clean".to_string())
    } else {
        Some(value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ContentBlock;

    fn context() -> SessionContext {
        SessionContext {
            os: "Windows 11".to_string(),
            shell: "PowerShell".to_string(),
            arch: "x86_64".to_string(),
            cwd: "/project".to_string(),
            git_branch: Some("main".to_string()),
            git_status: Some("clean".to_string()),
        }
    }

    #[test]
    fn code_prompt_includes_tool_rules_and_runtime_context() {
        let result =
            PromptEngine::new().build("code", &[], &[], &context(), PromptBuildOptions::default());

        assert!(result.system_prompt.contains("You are Code Agent"));
        assert!(result.system_prompt.contains("operating in code mode"));
        assert!(result.system_prompt.contains("Tool priority rules"));
        assert!(result.system_prompt.contains(builtins::CACHE_BOUNDARY));
        assert!(result.system_prompt.contains("OS: Windows 11"));
        assert!(result
            .system_prompt
            .contains("Current working directory: /project"));
    }

    #[test]
    fn chat_prompt_omits_tool_rules() {
        let result =
            PromptEngine::new().build("chat", &[], &[], &context(), PromptBuildOptions::default());

        assert!(result.system_prompt.contains("operating in chat mode"));
        assert!(!result.system_prompt.contains("Tool priority rules"));
    }

    #[test]
    fn build_omits_assistant_thinking_blocks_from_prompt_messages_by_default() {
        let result = PromptEngine::new().build(
            "code",
            &[ChatMessage {
                role: "assistant".to_string(),
                content: "final answer".to_string(),
                content_blocks: Some(vec![
                    ContentBlock::Thinking {
                        thinking: "reasoning".to_string(),
                        signature: None,
                    },
                    ContentBlock::Text {
                        text: "final answer".to_string(),
                    },
                ]),
            }],
            &[],
            &context(),
            PromptBuildOptions::default(),
        );

        let blocks = result.messages[0].content_blocks.as_ref().unwrap();
        assert!(matches!(
            &blocks[0],
            ContentBlock::Text { text } if text == "final answer"
        ));
    }

    #[test]
    fn build_preserves_required_thinking_for_assistant_tool_use_messages() {
        let result = PromptEngine::new().build(
            "code",
            &[ChatMessage {
                role: "assistant".to_string(),
                content: String::new(),
                content_blocks: Some(vec![
                    ContentBlock::Thinking {
                        thinking: "reasoning".to_string(),
                        signature: None,
                    },
                    ContentBlock::ToolUse {
                        id: "tool-1".to_string(),
                        name: "read_file".to_string(),
                        input: serde_json::json!({ "file_path": "src/main.rs" }),
                    },
                ]),
            }],
            &[],
            &context(),
            PromptBuildOptions::default(),
        );

        let blocks = result.messages[0].content_blocks.as_ref().unwrap();
        assert_eq!(blocks.len(), 2);
        assert!(matches!(
            &blocks[0],
            ContentBlock::Thinking { thinking, .. } if thinking == "reasoning"
        ));
        assert!(matches!(
            &blocks[1],
            ContentBlock::ToolUse { id, name, .. } if id == "tool-1" && name == "read_file"
        ));
    }

    #[test]
    fn build_preserves_assistant_thinking_blocks_when_requested() {
        let result = PromptEngine::new().build(
            "code",
            &[ChatMessage {
                role: "assistant".to_string(),
                content: "final answer".to_string(),
                content_blocks: Some(vec![
                    ContentBlock::Thinking {
                        thinking: "reasoning".to_string(),
                        signature: None,
                    },
                    ContentBlock::Text {
                        text: "final answer".to_string(),
                    },
                ]),
            }],
            &[],
            &context(),
            PromptBuildOptions {
                preserve_thinking_blocks: true,
            },
        );

        let blocks = result.messages[0].content_blocks.as_ref().unwrap();
        assert_eq!(blocks.len(), 2);
        assert!(matches!(
            &blocks[0],
            ContentBlock::Thinking { thinking, .. } if thinking == "reasoning"
        ));
    }

    #[test]
    fn build_omits_assistant_tool_result_blocks_from_prompt_messages() {
        let result = PromptEngine::new().build(
            "code",
            &[ChatMessage {
                role: "assistant".to_string(),
                content: "final answer".to_string(),
                content_blocks: Some(vec![
                    ContentBlock::Thinking {
                        thinking: "reasoning".to_string(),
                        signature: None,
                    },
                    ContentBlock::ToolUse {
                        id: "tool-1".to_string(),
                        name: "read_file".to_string(),
                        input: serde_json::json!({ "file_path": "src/main.rs" }),
                    },
                    ContentBlock::ToolResult {
                        tool_use_id: "tool-1".to_string(),
                        content: "fn main() {}".to_string(),
                        is_error: Some(false),
                    },
                    ContentBlock::Text {
                        text: "final answer".to_string(),
                    },
                ]),
            }],
            &[],
            &context(),
            PromptBuildOptions::default(),
        );

        let blocks = result.messages[0].content_blocks.as_ref().unwrap();
        assert_eq!(blocks.len(), 3);
        assert!(matches!(
            &blocks[0],
            ContentBlock::Thinking { thinking, .. } if thinking == "reasoning"
        ));
        assert!(matches!(
            &blocks[1],
            ContentBlock::ToolUse { id, name, .. } if id == "tool-1" && name == "read_file"
        ));
        assert!(matches!(
            &blocks[2],
            ContentBlock::Text { text } if text == "final answer"
        ));
    }
}
