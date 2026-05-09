## tauri-command-organization

Tauri 命令组织规范：将 `#[tauri::command]` 函数按功能域拆分到独立的模块文件中，通过 `commands/mod.rs` 统一导出。

### 命令文件划分

项目 SHALL 按以下功能域组织命令文件：

| 文件 | 功能域 | 命令列表 |
|------|--------|----------|
| `commands/chat.rs` | LLM 聊天 | `send_message`, `stop_streaming` |
| `commands/agent.rs` | Agent 控制 | `run_agent`, `stop_agent` |
| `commands/trace.rs` | Trace 窗口 | `open_trace_window`, `hide_trace_window`, `close_trace_window`, `is_trace_window_open` |
| `commands/docking.rs` | Trace 停靠 | `set_trace_docking_mode`, `exit_trace_docking`, `sync_trace_docking_width`, `sync_trace_docking_to_main`, `hide_trace_for_main_minimize`, `set_trace_always_on_top`, `get_trace_docking_state` |
| `commands/settings.rs` | 设置管理 | `save_settings`, `load_settings`, `list_models` |

### 导出规范

- `commands/mod.rs` SHALL 通过 `pub use` 重新导出所有命令函数，供 `lib.rs` 的 `generate_handler![]` 注册
- `commands/mod.rs` SHALL 提供 `pub fn all_commands() -> Vec<tauri::Command>` 或直接通过 `generate_handler![]` 引用

### 约束

- 每个命令文件 SHALL NOT 超过 200 行
- 命令函数 SHALL 仅负责参数适配和调用下层模块，不应包含业务逻辑
- 命令文件之间 SHALL NOT 互相引用
