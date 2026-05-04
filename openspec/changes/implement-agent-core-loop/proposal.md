## Why

当前 `commands::send_message` 仅做单轮 LLM 调用，无法支持 AI Agent 所需的多轮 Tool-Use 循环。已定义的 `ToolRegistry` 和 `Tool` trait 没有接入对话流程，`stop_streaming` 也是空实现。将对话引擎从单轮请求-响应改造为多轮 Think→Act→Observe 自主循环，是整个 Code Agent 系统的核心基础，后续所有 Agent 能力（多 Agent 调度、任务系统、规划模式等）都依赖此基础。

## What Changes

- **新增 AgentRuntime + AgentLoop**：在 Rust 后端实现多轮 Think→Act→Observe 循环，支持文本响应直接结束、工具调用自动循环、max_turns 上限防死循环
- **扩展 LlmClient 支持 tool_use 流式响应**：解析 Anthropic API 的 ContentBlockStart/ContentBlockDelta/ContentBlockStop 事件，区分 text 和 tool_use 两种内容块
- **扩展消息模型为 ContentBlock 格式**：ChatMessage 从纯文本扩展为支持 text / tool_use / tool_result 三种内容块，兼容 Anthropic ContentBlock 消息结构
- **实现 CancellationToken 停止机制**：替换当前空的 `stop_streaming`，通过 tokio CancellationToken 实现 Agent 循环的一键取消
- **前端从 useChat 迁移到 useAgent**：前端增加 agentStore 管理 Agent 运行时状态，useAgent hook 处理 tool-call、permission-request 等新事件类型

## Capabilities

### New Capabilities

- `agent-core-loop`: Rust 后端的多轮 Think→Act→Observe 自主循环，含 AgentSession 生命周期管理、max_turns 上限、CancellationToken 可取消机制
- `tool-use-streaming`: LlmClient 扩展为支持 Anthropic tool_use 事件流（ContentBlockStart/Delta/Stop），解包 text_delta 和 input_json_delta 并分别向前端推送
- `content-block-messages`: 消息数据模型从纯文本字符串升级为 ContentBlock 数组（text / tool_use / tool_result），前后端类型同步
- `agent-frontend`: 前端 Agent 状态管理（agentStore、useAgent hook），处理 stream-delta、tool-call、tool-result、agent-turn、agent-complete 事件，支持 stop 控制

### Modified Capabilities

<!-- Phase 1 是新能力构建，不修改现有 spec 级需求 -->

## Impact

### Rust 后端
- `src-tauri/src/commands.rs`: send_message 改为创建 AgentSession 并启动 AgentLoop；实现 stop_streaming 发送取消信号
- `src-tauri/src/models.rs`: ChatMessage 扩展 ContentBlock 字段
- `src-tauri/src/llm.rs`: LlmClient 扩展 tool_use 流式解析能力
- `src-tauri/src/providers/anthropic.rs`: 响应解析增加 ContentBlock 事件处理
- `src-tauri/src/tools/`: Tool trait / ToolRegistry / EchoTool 接入 AgentLoop

### 前端
- `src/hooks/useChat.ts`: 迁移为 useAgent，适配 Agent 事件模型
- `src/stores/chatStore.ts`: 配合 ContentBlock 消息结构调整
- `src/types/index.ts`: 新增 Agent 相关类型（ContentBlock、AgentStatus 等）

### 新增模块
- `src-tauri/src/agent/` (runtime / session / config)
