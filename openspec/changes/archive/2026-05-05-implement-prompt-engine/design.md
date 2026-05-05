## Context

当前 `LlmProvider::build_chat_request` 直接序列化 messages，不做任何 prompt 层面的加工。System prompt 概念在代码中不存在。架构设计文档 [prompt-system.md](../../docs/agent-architecture/prompt-system.md) 已定义了完整的 Prompt Engine 设计，本次将其落地实现，并做适当简化——Memory 注入、CLAUDE.md 前置、Context Manager 裁剪等属于后续提案范围。

当前数据流：
```
send_message / agent_loop
  → llm_client.stream_chat(messages)
    → provider.build_chat_request(model, messages) → {"model": "...", "messages": [...]}
```
注意：没有 system prompt。

目标数据流：
```
send_message / agent_loop
  → PromptEngine.build(agent_type, messages, tools, ctx)
    → system_prompt: String (Static + Boundary + Dynamic)
    → llm_client.stream_chat(system_prompt, messages, tools)
      → provider.build_chat_request(model, system, messages, tools)
        → {"model": "...", "system": "...", "messages": [...], "tools": [...]}
```

## Goals / Non-Goals

**Goals:**
- 实现 `PromptEngine` 结构体，支持从模板组装 system prompt
- 实现 Static/Dynamic section 分离，为未来 Prompt Cache 预留边界标记
- `AnthropicRequest` 增加 `system` 字段
- 模板文件化管理（`src-tauri/prompts/`），支持运行时变量替换
- `agent_loop` 和 `send_message` 两条路径统一使用 PromptEngine
- 新增 `trace-prompt` 事件，emit 每轮 LLM 调用的完整 prompt 数据

**Non-Goals:**
- 不实现 Prompt Cache API 集成（属于后续提案）
- 不实现 CLAUDE.md / Memory 的上下文注入（属于 Memory System + Context Manager 提案）
- 不修改前端代码
- 不修改 DeepSeek/OpenAI provider 的 system prompt 逻辑（仅适配 API 格式，不改变内容策略）

## Decisions

### 1. 模块结构：`src-tauri/src/prompt/`

**选择**：新建独立 prompt 模块，包含 engine、templates、builtins 三个子模块。

```
src-tauri/src/prompt/
├── mod.rs           # pub use 导出，PromptEngine struct
├── engine.rs        # PromptEngine::build() 核心逻辑
├── templates.rs     # PromptTemplate, PromptSection 定义 + 模板注册表
└── builtins.rs      # 内置 prompt 常量
```

**理由**：与架构文档一致，独立模块便于测试和后续扩展。不在 agent/ 目录下混合 prompt 逻辑。

### 2. System Prompt 结构：三段式

**选择**：实现文档中的三段式结构，但简化 dynamic 段为当前会话上下文（OS/Shell/Git 状态）。

```
┌─ 静态段 ─────────────────────────────┐
│ Base System Prompt（角色定位、行为准则）│
│ Agent Role Prompt（code/chat 区分）    │
│ Tool Priority Instructions          │
├─ Boundary ───────────────────────────┤
│ __CACHE_BOUNDARY__                   │
├─ 动态段 ─────────────────────────────┤
│ Runtime Context（OS, Shell, CWD, Git）│
│ Current Date                        │
└──────────────────────────────────────┘
```

**理由**：边界标记是 Anthropic Prompt Cache 的核心机制——静态段可跨用户全局缓存，动态段每会话重新计算。当前不接入 Cache API，但标记位置预留。

### 3. 模板系统：Markdown 文件 + 简单变量替换

**选择**：模板放在 `src-tauri/prompts/` 目录，Markdown 格式，支持 `{{variable}}` 占位符。

```
src-tauri/prompts/
├── base_system.md           # 基础系统提示
├── agent_code.md            # Code Agent 角色提示
├── agent_chat.md            # Chat Agent 角色提示
├── rules_tool_priority.md   # 工具使用优先级
└── runtime_context.md       # 运行时上下文模板
```

**理由**：
- Markdown 可读性好，方便迭代优化 prompt
- 编译时通过 `include_str!` 嵌入，零运行时文件读取开销（开发期可选热更新）
- 简单 `{{var}}` 替换足够，不需要 Handlebars/Tera 等模板引擎

**备选**：Rust 代码中硬编码字符串常量 → 放弃，修改 prompt 需要重新编译，不利于迭代。

### 4. System Prompt 的 API 格式

**选择**：Anthropic 使用 `"system"` 字段（string 或 content block 数组），DeepSeek 兼容格式使用 messages 数组前置 system role。

Anthropic 格式：
```json
{
  "model": "claude-sonnet-4-6",
  "system": "You are an AI coding assistant...",
  "messages": [...]
}
```

DeepSeek 兼容格式（因为 DeepSeek 的 `/anthropic` 端点兼容 Anthropic API，可直接使用 system 字段）：
```json
{
  "model": "deepseek-chat",
  "system": "You are an AI coding assistant...",
  "messages": [...]
}
```

**理由**：Anthropic 原生 `system` 字段独立于 messages，语义清晰且参与 cache 前缀匹配。DeepSeek 的 anthropic 兼容端点也支持此格式。

### 5. trace-prompt 事件设计

**选择**：在 `PromptEngine::build()` 完成后、LLM 调用前，emit `trace-prompt` 事件。

```rust
struct TracePromptEvent {
    conversation_id: String,
    session_id: String,
    turn: usize,
    system_prompt: String,
    messages: Vec<ChatMessage>,
    tools: Vec<ToolDefinition>,
}
```

**理由**：
- 这是 Trace 窗口（提案 2）的核心数据源
- emit 时机在 build 完成后，确保数据完整
- 包含 messages 的完整内容，供前端展示 prompt 组装过程

### 6. 运行时上下文获取

**选择**：在 `PromptEngine::build()` 时通过 `SessionContext` 参数传入，由调用方负责收集。

```rust
struct SessionContext {
    os: String,
    shell: String,
    arch: String,
    cwd: String,
    git_branch: Option<String>,
    git_status: Option<String>,
}
```

**理由**：PromptEngine 不应直接访问系统调用——保持纯计算，方便测试。上下文收集由 agent_loop / commands 完成。当前阶段 Git 状态用 `Option` 表示可选。

## Risks / Trade-offs

- **[低] 模板维护成本**：prompt 内容分散在多个 Markdown 文件中，修改时需注意一致性。→ 模板总数量有限（<10），可管理。
- **[低] DeepSeek 兼容性**：DeepSeek 的 anthropic 兼容端点可能不完全支持 `system` 字段。→ 如果遇到问题，降级为 messages 数组前置 system role。
- **[低] 编译时嵌入**：`include_str!` 嵌入模板意味着修改 prompt 需重新编译。→ 后续可加开发期热更新（监听文件变更），但不在本次范围。
