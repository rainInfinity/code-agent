#[derive(Debug, Clone)]
pub struct AgentConfig {
    pub max_turns: usize,
    pub tool_timeout_secs: u64,
    pub tool_output_max_chars: usize,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            max_turns: 30,
            tool_timeout_secs: 120,
            tool_output_max_chars: 8000,
        }
    }
}
