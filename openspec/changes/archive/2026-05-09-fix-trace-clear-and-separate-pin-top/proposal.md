## Why

Trace 窗口的清除历史数据按钮未能彻底清除 turns——因为 `normalizeConversationTurns` 会在持久化和回推同步过程中从 assistant messages 自动重建 fallback turns，导致清除后数据立即恢复。同时，当前"始终显示"和"置顶"功能被捆绑在 Trace 窗口的单一图钉按钮上，职责不清且无法在主窗口控制全局置顶。此外，主窗口的 Trace 按钮若继续按会话维度管理，会让"始终显示"在切换会话时隐式点亮新会话的 Trace 状态，行为不够直观。

## What Changes

- **修复清除按钮**：`normalizeConversationTurns` 不再从 messages 重建已被主动清除的 turns；移除主窗口清除后不必要的回推同步步骤
- **分离 Pin 和置顶**：Trace 窗口的图钉按钮只控制"始终显示"（切换对话时保持打开），不再联动 `alwaysOnTop`
- **Trace 按钮全局化**：主窗口 StatusBar 的 Trace 按钮改为全局窗口显示状态，而非会话级状态；只有在 `Trace=开` 且 `Pin=开` 时，切换对话才继续保持 Trace 窗口打开
- **主窗口置顶按钮**：在主窗口 TitleBar 新增置顶按钮，控制主窗口和 Trace 窗口双窗口置顶
- **贴靠模式 Z-order 保证**：贴靠模式下 Trace 窗口显示优先级始终大于主窗口

## Capabilities

### New Capabilities
- `main-window-always-on-top`: 主窗口全局置顶控制，同时应用于主窗口和 Trace 窗口。包含 IPC 命令、前端按钮状态管理和 dock 模式下的置顶协同。

### Modified Capabilities
- `trace-window-always-on-top`: 窗置顶按钮从 Trace 窗口标题栏移除，职责转移至主窗口。Trace 窗口的 `alwaysOnTop` 状态由主窗口全局置顶按钮控制。
- `trace-pin-window`: Pin 按钮不再联动 `alwaysOnTop`，仅控制 `isPinned`。只有在主窗口的全局 Trace 开关开启时，Pin 才会在切换对话时保持 Trace 窗口打开。标题栏按钮布局调整（移除置顶按钮的位置）。
- `trace-persistence`: 清除逻辑改为设置 `turnsCleared` 标记，`normalizeConversationTurns` 检查标记跳过 fallback 重建。主窗口清除后不再回推 sync。
- `trace-window-lifecycle`: 清除流程中移除主窗口回推 `trace-sync-conversations` 步骤；Trace 窗口显示状态由主窗口全局 `Trace` 按钮控制，不再随当前 conversation 单独持有开关。
- `trace-window-docking`: 贴靠模式与全局置顶的协同——两者同时置顶时 Trace Z-order > Main。置顶状态由主窗口全局控制，dock 模式下的强制置顶与全局置顶不冲突。

## Impact

- **前端组件**: TracePanel（图钉按钮逻辑简化）、TitleBar（新增置顶按钮）、StatusBar（移除清除回推同步，并将 Trace 按钮调整为全局开关）
- **前端 stores**: traceStore（setPinned 解耦）、chatStore（清除逻辑加 turnsCleared，并新增全局 Trace 打开状态）
- **前端 types**: Conversation 新增 `turnsCleared` 字段
- **前端 hooks**: useIpc 新增主窗口置顶 IPC
- **Rust 后端**: 新增 `set_main_always_on_top` command；docking 模块增加主窗口置顶与 Z-order 保证
- **i18n**: zh-CN 更新按钮文案
