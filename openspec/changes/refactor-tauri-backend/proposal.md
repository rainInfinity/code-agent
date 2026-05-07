## Why

当前 Tauri Rust 后端在快速迭代中积累了架构债务：`lib.rs` 膨胀至 782 行，混合了应用入口、窗口状态管理、Trace 停靠子系统三个完全不相关的职责；`commands.rs` 将 20 个 `#[tauri::command]` 全部堆在单个文件；`models.rs` 作为"类型垃圾桶"容纳了 6 个不同领域的数据结构；事件名称散布各处为字符串字面量；常量在 `lib.rs` 和 `commands.rs` 中重复定义。

对照 understanding-tauri-architecture 的最佳实践——Core-Shell 分层、命令按域组织、State 集中管理——当前代码的可读性和维护性明显不足。本次重构在不改变任何功能行为的前提下，系统化地重新组织 Rust 后端代码结构。

## What Changes

- **拆分 `lib.rs`** — 将 Trace 停靠子系统（~300 行）和窗口状态管理（~250 行）提取到 `window/` 模块，`lib.rs` 缩减为 ~50 行的纯入口
- **拆分 `commands.rs`** — 按功能域拆分为 `commands/chat.rs`、`commands/agent.rs`、`commands/trace.rs`、`commands/docking.rs`、`commands/settings.rs`，每个文件 ≤200 行
- **拆分 `models.rs`** — 按领域拆分为 `models/chat.rs`、`models/api.rs`、`models/events.rs`、`models/settings.rs`、`models/tools.rs`
- **集中事件名称常量** — 创建 `events.rs`，将散布在各处的 `"stream-delta"`、`"tool-call"` 等字符串字面量统一定义为常量
- **提取 `AppState`** — 从 `commands.rs` 移到独立的 `state.rs`
- **消除重复常量** — 将 `TRACE_WINDOW_LABEL`、`TRACE_DOCKING_*` 等常量统一到单一位置

## Capabilities

### New Capabilities

- `tauri-command-organization`: 将 Tauri 命令按功能域拆分到独立模块文件，每个文件仅含同类命令
- `tauri-window-subsystem`: 将 Trace 停靠和窗口状态管理提取为独立的 `window/` 子系统模块
- `tauri-type-domain-split`: 将 Rust 数据类型按业务领域拆分，替换单文件 models.rs
- `tauri-event-constants`: 集中管理所有 IPC 事件名称字符串常量

### Modified Capabilities

<!-- 纯重构，不改变任何外部行为需求 -->

## Impact

- 受影响文件：`src-tauri/src/lib.rs`（大幅缩减）、`src-tauri/src/commands.rs`（删除，拆分为 5 个文件）、`src-tauri/src/models.rs`（删除，拆分为 5 个文件）
- 新增文件：`commands/` 目录（5 个文件）、`models/` 目录（5 个文件）、`window/` 目录（3 个文件）、`state.rs`、`events.rs`
- 零 **BREAKING** 变更 — 所有 `#[tauri::command]` 名称和参数签名不变，IPC 接口完全兼容
- 现有测试仅需更新 `use` 导入路径，断言不变
- Rust 编译验证：`cargo check --lib` 零错误
