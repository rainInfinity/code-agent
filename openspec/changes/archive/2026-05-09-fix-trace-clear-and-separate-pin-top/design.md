## Context

当前系统存在两个关联 Trace 窗口的缺陷：

1. **清除失效**：`normalizeConversationTurns`（turns.ts:268-276）在每次 normalize 时为没有 turn 的 assistant message 调用 `buildLegacyFallbackTurn()` 重建 turns。这个迁移逻辑原本用于从旧消息格式升级到 turn 系统，但在用户主动清除 turns 后也会触发，导致清除无效。清除流程中主窗口还会回推 `trace-sync-conversations`，经过 `mergeSyncedConversations` → `normalizeConversationTurns` 再次重建 turns。

2. **职责耦合**：TracePanel 的图钉按钮同时控制 `isPinned` 和 `alwaysOnTop`，两者被捆绑为 `togglePinAndAlwaysOnTop`。实际上它们应该独立——"始终显示"是 Trace 窗口的本地行为（切换对话时保持打开），"置顶"是系统级窗口属性（应能同时控制主窗口和 Trace 窗口）。

## Goals / Non-Goals

**Goals:**
- 清除按钮彻底清除 turns（包括已被折叠未渲染的数据），清除后不因 normalize 或 sync 恢复
- 图钉按钮只控制 `isPinned`（始终显示），不再联动 `alwaysOnTop`
- 主窗口 TitleBar 新增置顶按钮，控制主窗口和 Trace 窗口双窗口置顶
- 贴靠模式下 Trace 窗口 Z-order 始终大于主窗口

**Non-Goals:**
- 不改变贴靠模式的核心行为（force always-on-top、宽度限制、跟随主窗口等）
- 不改变 Pin 状态的持久化机制
- 不引入 per-window 独立的置顶控制（全局一个置顶按钮）

## Decisions

### Decision 1: 用 `turnsCleared` 标记区分清除与初始空状态

**选择**：在 `Conversation` 类型添加 `turnsCleared?: boolean` 字段。`clearConversationTurns` 设置 `turnsCleared: true`。`normalizeConversationTurns` 在 `turns.length === 0 && turnsCleared` 时跳过 fallback 重建。

**备选方案**：
- *直接移除 fallback 生成逻辑*：风险是旧数据（pre-turn 系统的消息）失去 turns——但由于迁移早已完成，此方案实际可行。保守起见选择标记方案。
- *用 `undefined` vs `[]` 区分*：`Conversation.turns` 类型为 `TurnTrace[]`，TypeScript 层面无法可靠区分 `undefined` 和 `[]`，且 persist 后的数据总是 `[]`。

**理由**：最小侵入性，不影响现有数据的正常迁移路径，仅阻止被主动清除的数据被重建。

### Decision 2: 清除后不执行回推同步

**选择**：StatusBar 收到 `trace-clear-conversation` 后调用本地 `clearConversationTurns`，但不再执行 `emitTraceSyncConversations` 回推。Trace 窗口已本地清除，主窗口清除后通过 persist 写入 localStorage，达到两端一致。

**备选方案**：
- *继续回推但跳过清除 conversation 的 normalize*：增加了 sync 流程的复杂性，且回推本身不必要。
- *完全移除清除事件改为纯本地操作*：会导致主窗口持久化层不被清除，重启后恢复。

**理由**：简化流程，消除 `normalizeConversationTurns` 在 sync 路径上的副作用风险。双向同步已在启动时通过 `trace-window-ready` 补充。

### Decision 3: 主窗口 TitleBar 承载置顶控制

**选择**：在 TitleBar 窗口控制按钮区（最小化按钮左侧）新增置顶按钮。按钮调用新 Rust command `set_main_always_on_top`，该 command 同时设置主窗口和 Trace 窗口（若打开）的 `set_always_on_top`。

**备选方案**：
- *置顶按钮放在 StatusBar*：位置不显著，与窗口控制按钮的视觉逻辑不一致。
- *主窗口和 Trace 各独立置顶*：违背用户"统一控制"的需求。

**理由**：TitleBar 是窗口控制的自然位置，与最小化/最大化/关闭按钮形成完整的窗口控制组。

### Decision 4: 贴靠模式下 Z-order 保证机制

**选择**：在 `apply_trace_docking` 中，每次同步时显式调用 `trace.set_always_on_top(true)` 并 `trace.set_focus()`，确保 Trace 在主窗口之上。主窗口置顶状态通过新 command 独立控制，不受 dock 模式的 force-ontop 影响。

**备选方案**：
- *设置 owner 窗口关系*：Tauri v2 的跨平台 owner 支持不稳定。
- *仅在 dock 进入时设置一次*：Z-order 可能在用户交互后漂移。

**理由**：每次 dock sync 时刷新 ontop + focus 是保证 Trace > Main 的最可靠方式，无额外平台依赖。

### Decision 5: Rust 侧新增 `set_main_always_on_top` command

**选择**：新增独立 command 而非复用 `set_trace_always_on_top`。新 command 接收 `always_on_top: bool`，设置主窗口 always-on-top，同时查询 Trace 窗口是否存在，若存在也应用（尊重 dock 模式的强制置顶约束）。

**备选方案**：
- *拆分为两个独立 command*：增加前端调用复杂度。
- *通过事件而非 command*：置顶是系统级操作，command 语义更清晰。

**理由**：一个 command 完成双窗口操作，前端只需一次调用。Trace 窗口的 docking 约束在 Rust 侧处理，前端无需关心。

## Risks / Trade-offs

- **[风险] `turnsCleared` 标记需持久化**：新增字段需在 `partialize` 中保留，否则重启后标记丢失。→ 已在 `normalizePersistedConversations` 中传递，zustand persist 自动保存。
- **[风险] 置顶状态不持久化**：按现有 `trace-window-always-on-top` spec 要求，置顶状态不应跨会话持久化。主窗口的全局置顶同理。→ 不持久化，重启默认关闭。
- **[权衡] 全局置顶是 all-or-nothing**：无法单独控制主窗口或 Trace 窗口的置顶。→ 符合当前用户需求，后续如有需要可扩展为 per-window 控制。
