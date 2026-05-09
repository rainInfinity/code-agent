## 1. 类型和数据层 — 清除逻辑修复

- [x] 1.1 `src/types/conversation.ts`: Conversation 接口新增 `turnsCleared?: boolean` 字段
- [x] 1.2 `src/stores/conversationActions.ts`: `clearConversationTurns` 设置 `turnsCleared: true`，`appendTurn` 重置 `turnsCleared: false`
- [x] 1.3 `src/utils/turns.ts`: `normalizeConversationTurns` 在 `turns.length === 0` 且 `turnsCleared` 为 true 时跳过 fallback 重建；接收 conversation 的 `turnsCleared` 参数
- [x] 1.4 `src/stores/persistenceUtils.ts`: `normalizePersistedConversations` 传递 `turnsCleared` 给 `normalizeConversationTurns`
- [x] 1.5 `src/stores/chatStore.ts`: `merge` 函数保留 `turnsCleared` 字段的恢复

## 2. 清除流程修复

- [x] 2.1 `src/components/Layout/StatusBar.tsx`: `onTraceClearConversation` 处理中移除 `emitTraceSyncConversations` 回推调用
- [x] 2.2 `src/components/Trace/TracePanel.tsx`: 清除按钮 tooltip 更新为"清除当前对话 Trace 历史"

## 3. Pin/置顶分离 — 前端 IPC 层

- [x] 3.1 `src/hooks/useIpc.ts`: 新增 `setMainAlwaysOnTop` command 封装，新增 `onMainAlwaysOnTopChanged` 事件监听
- [x] 3.2 `src/hooks/useIpc.ts`: 保留现有 `emitTracePinChanged`、`setTraceAlwaysOnTop`（`setTraceAlwaysOnTop` 不再从前端直接调用，仅保留由 Rust 侧触发）

## 4. Pin/置顶分离 — Store 层

- [x] 4.1 `src/stores/traceStore.ts`: `setPinned` 方法不再联动 `setAlwaysOnTop`，移除 `alwaysOnTop` 相关状态的直接 setter
- [x] 4.2 `src/stores/chatStore.ts`: 新增 `isAlwaysOnTop` 状态和 `setAlwaysOnTop` action（用于主窗口 TitleBar 按钮状态管理）

## 5. Pin/置顶分离 — Trace 窗口前端

- [x] 5.1 `src/components/Trace/TracePanel.tsx`: 图钉按钮重构——移除 `alwaysOnTop` 联动，`togglePin` 仅控制 `isPinned`
- [x] 5.2 `src/components/Trace/TracePanel.tsx`: 图钉按钮 tooltip 和 aria-label 更新为"保持打开"文案
- [x] 5.3 `src/components/Trace/TracePanel.tsx`: 移除 `pinAndTopActive` 组合状态及相关逻辑；图钉按钮的 active 状态仅反映 `isPinned`
- [x] 5.4 `src/components/Trace/TracePanel.tsx`: 贴靠模式下图钉按钮禁用（docking 已强制保持打开）
- [x] 5.5 `src/i18n/zh-CN.ts`: 更新 trace pin 相关文案，删除旧的组合按钮文案

## 6. 主窗口置顶按钮 — 前端

- [x] 6.1 `src/components/Layout/TitleBar.tsx`: 在最小化按钮左侧新增置顶按钮（使用 `FaThumbtack` 图标）
- [x] 6.2 `src/components/Layout/TitleBar.tsx`: 置顶按钮点击调用 `setMainAlwaysOnTop(!isAlwaysOnTop)`，并更新本地状态
- [x] 6.3 `src/components/Layout/TitleBar.tsx`: 置顶按钮的 active 状态从 chatStore 的 `isAlwaysOnTop` 读取
- [x] 6.4 `src/i18n/zh-CN.ts`: titleBar 新增 `alwaysOnTop` 和 `alwaysOnTopTooltip` 文案
- [x] 6.5 `src/i18n/zh-CN.ts`: titleBar 新增 `alwaysOnTopDisabledInDock` 文案（如有需要）

## 7. 主窗口置顶按钮 — Rust 后端

- [x] 7.1 `src-tauri/src/commands/docking.rs`: 新增 `set_main_always_on_top` command，设置主窗口 always-on-top，若 Trace 窗口存在且可见则同步设置
- [x] 7.2 `src-tauri/src/commands/docking.rs`: 贴靠模式下 `set_main_always_on_top(false)` 不取消 Trace 窗口的 always-on-top（由 dock 强制）
- [x] 7.3 `src-tauri/src/window/docking.rs`: `apply_trace_docking` 中确保每次同步时 `trace.set_always_on_top(true)` 并 `trace.set_focus()`，保证 Trace > Main Z-order
- [x] 7.4 `src-tauri/src/lib.rs`: 注册 `set_main_always_on_top` command

## 8. 集成验证

- [x] 8.1 清除按钮端到端验证：清除后 turns 消失、重启后不复原、折叠数据也一并清除
- [x] 8.2 Pin 按钮验证：独立控制 isPinned、不影响 alwaysOnTop、重启后保持持久化状态
- [x] 8.3 主窗口置顶按钮验证：同时控制主窗口和 Trace 窗口置顶、重启后默认关闭
- [x] 8.4 贴靠模式验证：Trace > Main Z-order、置顶按钮在 dock 模式下的行为正确
