use super::builtins;
use super::templates::{PromptSection, PromptTemplate, TemplateRegistry};
use crate::models::{ChatMessage, SessionContext, ToolDefinition};
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone)]
pub struct PromptBuildResult {
    pub system_prompt: String,
    pub messages: Vec<ChatMessage>,
    pub tools: Vec<ToolDefinition>,
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
            messages: messages.to_vec(),
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
        let result = PromptEngine::new().build("code", &[], &[], &context());

        assert!(result.system_prompt.contains("You are Code Agent"));
        assert!(result.system_prompt.contains("operating in code mode"));
        assert!(result.system_prompt.contains("Tool priority rules"));
        assert!(result.system_prompt.contains(builtins::CACHE_BOUNDARY));
        assert!(result.system_prompt.contains("OS: Windows 11"));
        assert!(result.system_prompt.contains("Current working directory: /project"));
    }

    #[test]
    fn chat_prompt_omits_tool_rules() {
        let result = PromptEngine::new().build("chat", &[], &[], &context());

        assert!(result.system_prompt.contains("operating in chat mode"));
        assert!(!result.system_prompt.contains("Tool priority rules"));
    }
}
