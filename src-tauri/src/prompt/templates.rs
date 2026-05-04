use std::collections::HashMap;

#[derive(Debug, Clone)]
pub enum PromptSection {
    Static(&'static str),
    Dynamic(&'static str),
    Include(&'static str),
}

#[derive(Debug, Clone)]
pub struct PromptTemplate {
    pub sections: Vec<PromptSection>,
}

impl PromptTemplate {
    pub fn new(sections: Vec<PromptSection>) -> Self {
        Self { sections }
    }
}

pub type TemplateRegistry = HashMap<&'static str, PromptTemplate>;
