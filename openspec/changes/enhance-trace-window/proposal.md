## Why

Trace 窗口是 Agent 调试的核心工具，但当前实现存在 3 个关键缺陷：Trace 数据在切换对话时被清空且无持久化、切换对话时 Trace 窗口保持打开但不跟踪新对话、各模块缺少复制按钮和时间/Token 信息导致调试效率低下。

当前 `traceStore` 是纯内存 Store，无持久化。切换对话时 `reset()` 清空所有 turns。用户期望 Trace 数据绑定到每个对话，下次打开同一对话时恢复历史记录。同时，切换对话时 Trace 窗口应自动关闭（除非用户主动置顶），避免残留上一个对话的 trace 数据。

## What Changes

- **Trace 数据持久化**：在 `Conversation` 类型上新增 `turns: TurnTrace[]` 字段，随 chatStore 持久化到 localStorage，按对话 ID 绑定
- **对话切换行为**：`activeConversationId` 变化时自动 hide Trace 窗口，置顶（pin）按钮允许用户保持 Trace 窗口跨对话打开
- **Trace 窗口置顶按钮**：在 Trace 窗口自定义标题栏的最小化按钮旁新增 pin 按钮，激活时 Trace 窗口不跟随对话切换关闭
- **模块复制按钮**：PromptView、ThinkingView、ResponseView 各新增复制按钮，一键复制对应模块的完整文本内容
- **Turn 时间信息**：TurnCard 头部展示每个 Turn 的开始时间、结束时间、总耗时（利用 TurnTrace 已有的 startTime/endTime 字段）
- **清除操作交给用户**：TracePanel 新增"清除 Trace"按钮，仅在用户主动操作时清空当前对话的 turns

## Capabilities

### New Capabilities

- `trace-persistence`: Trace 数据按对话 ID 持久化到 Conversation.turns，随 chatStore 的 localStorage 持久化一同存储
- `trace-pin-window`: Trace 窗口置顶功能，允许跨对话保持打开
- `trace-copy-modules`: Trace 各模块（Prompt/Thinking/Response）的复制功能
- `trace-turn-timing`: Turn 的时间信息展示（开始/结束/耗时）

### Modified Capabilities

- `trace-window-lifecycle`: 对话切换时自动关闭 Trace 窗口（非置顶模式），新增 pin 状态管理
- `agent-frontend`: Conversation 类型新增 turns 字段，chatStore 的 persist partialize 逻辑相应更新

## Impact

- **前端类型**: `src/types/index.ts` — Conversation 新增 `turns?: TurnTrace[]` 字段
- **前端 Store**: `src/stores/chatStore.ts` — persist partialize 适配新字段，新增 trace 相关 actions
- **前端 Store**: `src/stores/traceStore.ts` — 重构为从 chatStore 读写当前对话的 turns
- **前端组件**: `src/components/Trace/TracePanel.tsx` — 新增 pin 按钮、清除按钮
- **前端组件**: `src/components/Trace/TurnCard.tsx` — 头部新增时间信息
- **前端组件**: `src/components/Trace/PromptView.tsx` — 新增复制按钮
- **前端组件**: `src/components/Trace/ThinkingView.tsx` — 新增复制按钮
- **前端组件**: `src/components/Trace/ResponseView.tsx` — 新增复制按钮
- **前端组件**: `src/components/Layout/StatusBar.tsx` — 对话切换时自动 hide trace（非 pin 模式）
- **前端 IPC**: `src/hooks/useIpc.ts` — 可能需要新增 `emitTracePinChanged` 等事件
- **i18n**: `src/i18n/zh-CN.ts` — 新增 trace 复制、pin、清除、时间等文案
