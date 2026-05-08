## 1. 基础设施：创建目录和模块骨架

- [x] 1.1 创建 `commands/`、`models/`、`window/` 目录结构，编写各 `mod.rs` 模块声明
- [x] 1.2 创建 `state.rs`，将 `AppState` 从 `commands.rs` 移入，`lib.rs` 中 `mod state;`
- [x] 1.3 创建 `events.rs`，定义 `event_names` 模块和所有事件名称常量
- [x] 1.4 在 `window/mod.rs` 中统一定义 Trace 窗口相关常量（`TRACE_WINDOW_LABEL`、`TRACE_DOCKING_*` 等）
- [x] 1.5 运行 `cargo check --lib` 验证骨架编译通过

## 2. 拆分 models.rs → models/

- [x] 2.1 创建 `models/chat.rs`，迁移 ChatMessage、ContentBlock 及其序列化实现
- [x] 2.2 创建 `models/api.rs`，迁移 AnthropicRequest、StreamEvent、OpenAiChatRequest、OpenAiChatResponse、OpenAiStreamChunk
- [x] 2.3 创建 `models/events.rs`，迁移全部 16 种事件负载类型（StreamDeltaEvent、ToolCallEvent、AgentCompleteEvent 等）
- [x] 2.4 创建 `models/settings.rs`，迁移 ProviderSettings、PersistedSettings、SettingsResponse、ListModelsPayload 等
- [x] 2.5 创建 `models/tools.rs`，迁移 ToolResult、ToolDefinition、SessionContext、ToolMeta 等
- [x] 2.6 重写 `models/mod.rs` 为统一导出桶，从子模块 re-export 所有类型
- [x] 2.7 更新 `lib.rs` 中的 `mod models;` 声明（从文件变为目录）
- [x] 2.8 运行 `cargo check --lib` 验证类型系统完整性

## 3. 提取 window/ 子系统

- [x] 3.1 创建 `window/state.rs`，从 `lib.rs` 迁移窗口状态持久化逻辑（WindowState、load/save/restore 函数）
- [x] 3.2 创建 `window/docking.rs`，从 `lib.rs` 迁移 Trace 停靠系统全部逻辑（TraceDockingState、停靠计算、bounds 计算、apply/exit 函数）
- [x] 3.3 创建 `window/lifecycle.rs`，从 `lib.rs` 迁移窗口事件监听和生命周期管理（setup_window_state、trace 窗口创建/关闭/恢复）
- [x] 3.4 编写 `window/mod.rs`，声明子模块、重新导出公共类型和函数、统一定义常量
- [x] 3.5 精简 `lib.rs`，移除已迁移代码，仅保留 `mod window;`、`run()` 和模块声明
- [x] 3.6 运行 `cargo check --lib` 验证窗口子系统编译通过

## 4. 拆分 commands.rs → commands/

- [x] 4.1 创建 `commands/chat.rs`，迁移 `send_message`、`stop_streaming` 命令
- [x] 4.2 创建 `commands/agent.rs`，迁移 `run_agent`、`stop_agent` 命令
- [x] 4.3 创建 `commands/trace.rs`，迁移 Trace 窗口命令（`open_trace_window`、`hide_trace_window`、`close_trace_window`、`is_trace_window_open`）
- [x] 4.4 创建 `commands/docking.rs`，迁移停靠相关命令（`set_trace_docking_mode`、`exit_trace_docking`、`sync_trace_docking_width`、`sync_trace_docking_to_main`、`hide_trace_for_main_minimize`、`set_trace_always_on_top`、`get_trace_docking_state`）
- [x] 4.5 创建 `commands/settings.rs`，迁移设置相关命令（`save_settings`、`load_settings`、`list_models`）+ 辅助函数移至 `settings_io.rs`
- [x] 4.6 编写 `commands/mod.rs` 作为统一导出桶
- [x] 4.7 删除原 `commands.rs` 文件
- [x] 4.8 运行 `cargo check --lib` 验证命令层编译通过

## 5. 事件名称常量化

- [x] 5.1 批量替换 `commands/` 目录下所有 `app.emit("stream-delta", ...)` 调用为 `app.emit(event_names::STREAM_DELTA, ...)`
- [x] 5.2 批量替换 `agent/session.rs` 中 `emitter.emit("tool-call", ...)` 为 `emitter.emit(event_names::TOOL_CALL, ...)`
- [x] 5.3 批量替换 `window/` 目录下事件字符串为常量引用（`TRACE_DOCKING_CHANGED`, `TRACE_WINDOW_CLOSED`）
- [x] 5.4 运行 `cargo check --lib` 验证事件名称替换无误

## 6. 清理与验证

- [x] 6.1 检查并删除已迁移的原文件（`commands.rs`、`models.rs`），确认无残留引用
- [x] 6.2 运行 `cargo check --lib` 零错误（19 个预存 warning，无新增）
- [x] 6.3 运行全量 Rust 测试：`cargo test --lib`，80/80 测试通过
- [ ] 6.4 手动验证开发环境启动：`cargo tauri dev`，确认主窗口和 Trace 窗口功能正常
- [ ] 6.5 手动验证停靠功能（左右吸附、解除停靠、主窗口移动跟随、最小化时隐藏）
- [ ] 6.6 手动验证 Agent 循环和 LLM 流式响应正常
