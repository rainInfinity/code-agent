## tauri-type-domain-split

Rust 数据类型按业务领域拆分规范：将单文件 `models.rs` 中的类型按使用场景拆分到 `models/` 目录下的独立模块。

### 模块结构

```
models/
├── mod.rs          # 统一导出桶，从子模块 re-export 所有类型
├── chat.rs         # 聊天消息类型
├── api.rs          # LLM API 协议类型
├── events.rs       # IPC 事件负载类型
├── settings.rs     # 设置和配置类型
└── tools.rs        # 工具系统类型
```

### models/chat.rs

SHALL 包含与聊天消息直接相关的类型：
- `ChatMessage`
- `ContentBlock` 枚举（Text, Thinking, ToolUse, ToolResult）

### models/api.rs

SHALL 包含与 LLM Provider API 交互的序列化类型：
- `AnthropicRequest`、`AnthropicMessage`、`AnthropicContent`
- `StreamEvent` 枚举（Anthropic/DeepSeek 流事件）
- `OpenAiChatRequest`、`OpenAiChatResponse`、`OpenAiStreamChunk`
- `ModelInfo`

### models/events.rs

SHALL 包含所有 Tauri IPC 事件负载类型：
- `StreamDeltaEvent`、`StreamThinkingEvent`、`StreamEndEvent`、`StreamErrorEvent`
- `ToolCallEvent`、`ToolResultEvent`、`ToolTraceEvent`
- `AgentTurnEvent`、`AgentTurnCompleteEvent`、`AgentCompleteEvent`
- `TracePromptEvent`、`TraceThinkingEvent`
- `SendMessagePayload`、`RunAgentPayload`、`SettingsPayload`、`ListModelsPayload`

### models/settings.rs

SHALL 包含设置和配置相关类型：
- `ProviderSettings`、`ProviderSettingsMap`
- `PersistedSettings`、`SettingsResponse`
- `SettingsPayload`

### models/tools.rs

SHALL 包含工具系统类型：
- `ToolResult`、`ToolDefinition`、`ToolMeta`
- `SessionContext`、`ToolCallContext`

### 导出规范

- `models/mod.rs` SHALL 通过 `pub use models::chat::*;` 等语句重新导出所有公开类型
- 外部模块 SHALL 可以通过 `use crate::models::*` 或 `use crate::models::chat::ChatMessage` 引用类型
- 如果子模块类型间存在引用关系（如 `events.rs` 的类型引用 `chat.rs` 的类型），`mod.rs` 中 SHALL 先声明被依赖的模块

### 约束

- 子模块文件 SHALL NOT 超过 200 行
- 每个子模块 SHALL 仅包含一个业务领域的类型
- `mod.rs` SHALL 仅为导出桶，不应包含类型定义
