## Why

当前工具调用链路只暴露了模型请求工具和最终结果，Trace 窗口无法完整展示工具调用参数、执行中的状态变化和失败位置，主窗口也缺少类似 Claude Code 的紧凑过程视图。与此同时，Turn 状态目前与整个 session 的 `agent-complete` 绑定，导致中间轮次可能长期停留在“运行中”，而 Prompt 视图又只读取顶层 `content`，在消息仅包含 `contentBlocks` 时会出现空白条目。

## What Changes

- 新增统一的工具执行追踪能力，定义从“模型请求”到“执行中”再到“完成/失败”的结构化事件和前端共享数据模型。
- 调整 Trace 窗口的 Turn 生命周期，使每一轮能够独立收口，并在 Turn 中展示 Prompt、Thinking、Tool、Response 的完整过程。
- 调整 Trace 窗口的 Prompt 渲染逻辑，使其基于消息内容块而不是仅依赖顶层文本，避免出现空的 `user` / `assistant` 条目。
- 为主窗口聊天区增加紧凑的工具调用过程展示，呈现类似 Claude Code 的工具调用状态与结果摘要。
- 收敛主窗口与 Trace 窗口的 Turn/Tool 状态更新逻辑，减少两套前端实现的分叉。

## Capabilities

### New Capabilities

- `tool-execution-trace`: 定义工具执行全过程的结构化追踪事件、状态流转和共享展示数据。

### Modified Capabilities

- `agent-trace-window`: 调整 Turn 生命周期与 Trace 卡片内容，新增工具过程展示并修复 Prompt 空白条目问题。
- `agent-frontend`: 让前端 Agent 事件处理维护统一的 Turn/Tool 追踪状态，而不是仅维护松散的消息附属字段。
- `chat-message-rendering`: 在主窗口聊天消息中增加紧凑的工具调用过程展示。

## Impact

- `src-tauri/src/agent/runtime.rs`、`src-tauri/src/agent/session.rs`、`src-tauri/src/models.rs`、`src-tauri/src/tools/executor.rs`: 需要补充 Turn 收口与工具追踪事件。
- `src/hooks/useAgent.ts`、`src/stores/chatStore.ts`、`src/stores/traceStore.ts`、`src/types/index.ts`: 需要引入统一的 Turn/Tool 追踪模型并减少重复状态更新逻辑。
- `src/components/Trace/*`、`src/components/Chat/MessageList.tsx`: 需要分别实现完整工具过程视图和主窗口紧凑工具过程视图。
- 现有 Trace 与聊天相关测试需要扩展，覆盖多轮工具调用、并发工具调用、参数为空校验失败和 `contentBlocks`-only Prompt 渲染等场景。
