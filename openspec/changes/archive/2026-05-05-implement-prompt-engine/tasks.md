## 1. 数据模型

- [x] 1.1 `models.rs` 中 `AnthropicRequest` 新增 `system` 可选字段
- [x] 1.2 `models.rs` 中新增 `TracePromptEvent` 结构体
- [x] 1.3 `models.rs` 中新增 `SessionContext` 结构体（OS/Shell/Arch/CWD/Git）
- [x] 1.4 `models.rs` 中新增 `ToolDefinition` 若未定义（确认现有定义可用）

## 2. Prompt 模板

- [x] 2.1 创建 `src-tauri/prompts/` 目录
- [x] 2.2 创建 `base_system.md`：角色定位 + 行为准则 + 代码规范 + 安全约束
- [x] 2.3 创建 `agent_code.md`：Code Agent 角色描述（工作目录感知、工具使用、文件操作规范）
- [x] 2.4 创建 `agent_chat.md`：Chat Agent 角色描述（通用对话助手）
- [x] 2.5 创建 `rules_tool_priority.md`：工具使用优先级指令
- [x] 2.6 创建 `runtime_context.md`：运行时上下文模板（OS/Shell/CWD/Git 占位符）

## 3. Prompt Engine 核心模块

- [x] 3.1 创建 `src-tauri/src/prompt/mod.rs`：模块入口，pub use 导出
- [x] 3.2 创建 `src-tauri/src/prompt/templates.rs`：定义 `PromptSection`（Static/Dynamic/Include）、`PromptTemplate`
- [x] 3.3 创建 `src-tauri/src/prompt/builtins.rs`：用 `include_str!` 加载模板文件，注册内置模板
- [x] 3.4 创建 `src-tauri/src/prompt/engine.rs`：实现 `PromptEngine` struct
  - `build(agent_type, messages, tools, session_ctx) → PromptBuildResult`
  - 组装 system prompt：Static sections → Boundary → Dynamic sections
  - 返回 system_prompt + 处理后的 messages + tools
- [x] 3.5 `PromptEngine::new()` 初始化模板注册表

## 4. Provider 适配

- [x] 4.1 修改 `AnthropicProvider::build_chat_request` 签名，接收 `system: Option<String>`
- [x] 4.2 修改 `DeepSeekProvider::build_chat_request` 签名，同步适配
- [x] 4.3 修改 `LlmProvider` trait 的 `build_chat_request` 签名（或新增 `build_chat_request_with_system` 方法）
- [x] 4.4 修改 `LlmClient::stream_chat` 和 `stream_chat_with_tools` 签名，接收 `system_prompt: Option<String>`

## 5. 集成

- [x] 5.1 在 `agent_loop` 中：
  - 构建 `SessionContext`（收集 OS/Shell/CWD/Git 信息）
  - 调用 `PromptEngine::build()` 替代直接传 messages
  - 在 LLM 调用前 emit `trace-prompt` 事件（含完整 prompt 数据）
- [x] 5.2 在 `send_message` 中同理接入 PromptEngine
- [x] 5.3 `TauriAgentEventEmitter` 新增 `emit_trace_prompt()` 方法
- [x] 5.4 `agent::session.rs` 的 `AgentEventEmitter` trait 新增 `emit_trace_prompt` 方法

## 6. 前端事件监听

- [x] 6.1 `useIpc.ts` 新增 `onTracePrompt` 监听函数
- [x] 6.2 `types/index.ts` 新增 `TracePromptEvent` 类型
- [x] 6.3 在 `useAgent.ts` 中注册 `onTracePrompt` 监听（预留，Trace 窗口提案中消费）

## 7. 验证

- [x] 7.1 验证 Anthropic API 调用包含 system prompt 且 LLM 行为符合角色定位
- [x] 7.2 验证 DeepSeek API 调用 system prompt 兼容
- [x] 7.3 验证模板变量替换正确（OS/Shell/CWD 等动态值）
- [x] 7.4 验证 `trace-prompt` 事件 emit 包含完整数据
- [x] 7.5 验证切换 Agent 模式（chat/code）时 system prompt 正确切换
