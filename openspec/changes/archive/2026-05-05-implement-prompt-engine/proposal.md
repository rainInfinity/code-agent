## Why

当前后端完全没有 System Prompt 拼装逻辑——`AnthropicRequest` 没有 `system` 字段，LLM 调用只能看到裸 messages 数组。这导致：

1. Agent 行为不可控 — 没有角色定位、代码规范、安全约束等基础指令
2. Prompt 无法观测 — Trace 窗口提案依赖结构化的 prompt 数据，但当前根本不存在
3. 缓存无法优化 — 没有静态/动态段分离，Anthropic Prompt Cache 无法有效利用
4. 与架构设计文档脱节 — [prompt-system.md](../../docs/agent-architecture/prompt-system.md) 已详细设计，需落到代码

本次实现 Prompt Engine，为 Agent 提供结构化的 System Prompt 拼装能力，同时作为 Trace 窗口的数据基础。

## What Changes

- 新建 `src-tauri/src/prompt/` 模块：`PromptEngine` + `PromptTemplate` + 内置 prompt 常量
- `AnthropicRequest` 新增 `system` 字段，支持 Anthropic 原生 system prompt
- `agent_loop` 和 `send_message` 两条路径统一接入 `PromptEngine.build()`
- 模板文件放在 `src-tauri/prompts/`，支持开发期热更新
- 新增 `trace-prompt` Tauri 事件，每轮 LLM 调用前 emit 完整的 prompt 数据

## Capabilities

### New Capabilities

- `prompt-engine`: 结构化 Prompt 拼装引擎，支持模板化 System Prompt、静态/动态段分离、缓存边界标记

### Modified Capabilities

- 无现有 capability 变更

## Impact

- `src-tauri/src/prompt/` — 新模块（engine, templates, builtins, cache）
- `src-tauri/src/models.rs` — `AnthropicRequest` 加 `system` 字段；新增 TracePromptEvent
- `src-tauri/src/agent/runtime.rs` — `agent_loop` 调用 PromptEngine
- `src-tauri/src/commands.rs` — `send_message` 调用 PromptEngine
- `src-tauri/src/providers/anthropic.rs` — `build_chat_request` 支持 system prompt
- `src-tauri/src/providers/deepseek.rs` — 同步适配 system prompt
- `src-tauri/prompts/` — 新目录，存放 prompt 模板 Markdown 文件
