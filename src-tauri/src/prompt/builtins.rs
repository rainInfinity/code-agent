use super::templates::{PromptSection, PromptTemplate, TemplateRegistry};

pub const CACHE_BOUNDARY: &str = "__CACHE_BOUNDARY__";

const BASE_SYSTEM: &str = include_str!("../../prompts/base_system.md");
const AGENT_CODE: &str = include_str!("../../prompts/agent_code.md");
const AGENT_CHAT: &str = include_str!("../../prompts/agent_chat.md");
const RULES_TOOL_PRIORITY: &str = include_str!("../../prompts/rules_tool_priority.md");
const RUNTIME_CONTEXT: &str = include_str!("../../prompts/runtime_context.md");

pub fn registry() -> TemplateRegistry {
    [
        (
            "code",
            PromptTemplate::new(
                vec![
                    PromptSection::Static(BASE_SYSTEM),
                    PromptSection::Static(AGENT_CODE),
                    PromptSection::Static(RULES_TOOL_PRIORITY),
                    PromptSection::Include(CACHE_BOUNDARY),
                    PromptSection::Dynamic(RUNTIME_CONTEXT),
                ],
            ),
        ),
        (
            "chat",
            PromptTemplate::new(
                vec![
                    PromptSection::Static(BASE_SYSTEM),
                    PromptSection::Static(AGENT_CHAT),
                    PromptSection::Include(CACHE_BOUNDARY),
                    PromptSection::Dynamic(RUNTIME_CONTEXT),
                ],
            ),
        ),
    ]
    .into_iter()
    .collect()
}
