## Context

当前 Agent 运行链路中，`agent-turn` 按轮次发出，但 `agent-complete` 只在整个 session 结束时发出，导致前端很难判断“某一轮已经结束，只是下一轮继续了”。这直接带来了 Trace 窗口里前几轮长期显示“运行中”的问题。

与此同时，工具调用追踪目前只暴露了 `tool-call` 和 `tool-result` 两个端点事件。前端只能知道“模型请求了什么工具”和“最终拿到了什么结果”，却不知道工具何时真正开始执行、在哪一步失败、是否属于并发批次，也无法稳定地为主窗口和 Trace 窗口生成一致的过程视图。

另一个结构性问题是前端存在两套相似但不完全一致的 Turn 更新逻辑：主窗口在 `useAgent.ts` 中维护一套，Trace 窗口在 `traceStore.ts` / `useTraceIpc.ts` 中维护另一套。它们分别处理 thinking flush、turn 收口和状态更新，已经出现了行为漂移。Prompt 视图的问题也与此类似：Trace 当前主要依赖顶层 `message.content`，但新的消息模型已经越来越依赖 `contentBlocks`，因此会出现“有结构、无纯文本”的空白条目。

## Goals / Non-Goals

**Goals:**

- 为工具调用建立统一的结构化追踪模型，覆盖请求、开始、完成、失败等关键阶段。
- 让每个 Turn 都能独立结束，并且让主窗口与 Trace 窗口看到一致的 Turn 状态。
- 让 Trace 窗口能够完整展示工具参数、状态变化和结果，并修复 Prompt 空白条目问题。
- 让主窗口聊天区提供紧凑的工具调用过程视图，便于在不打开 Trace 的情况下观察 Agent 行为。
- 收敛主窗口和 Trace 窗口的状态写入逻辑，减少重复实现和后续漂移。

**Non-Goals:**

- 不改变 Provider 侧的请求协议或已有 `thinking` / `tool_result` 兼容性修复目标。
- 不重新设计工具执行器的并发策略，只暴露已有批次和顺序信息。
- 不在这次变更中引入新的审批流 UI 或更复杂的权限交互。
- 不要求主窗口完全复刻 Trace 窗口的详细程度；主窗口只提供紧凑版过程视图。

## Decisions

### 1. 引入统一的 `ToolTraceEvent`，而不是继续堆叠零散事件

**选择：**新增一个结构化工具追踪事件，包含 `conversationId`、`sessionId`、`turn`、`messageId`、`toolCallId`、`name`、`input`、`phase`、`result`、`timestamps`，必要时附带批次/顺序元数据。`phase` 至少覆盖 `requested`、`started`、`completed`、`failed`。

**原因：**
- 当前 `tool-call` / `tool-result` 只描述两端状态，中间过程缺失。
- 单一事件模型更适合驱动多个 UI：Trace 用详细视图，主窗口用紧凑视图。
- 相比再增加多个独立事件名，单一事件更容易扩展字段，也更容易做状态归并。

**备选方案：**
- 继续保留 `tool-call`、新增 `tool-start`、`tool-finish` 等多个事件。
  问题是前端要自己做更多跨事件拼装，且未来扩展时更容易出现分支逻辑。

### 2. 为 Turn 增加显式的收口事件，而不是依赖前端猜测

**选择：**新增一个显式的 Turn 完成事件，由后端在以下时机发出：
- 开始下一轮前，先结束上一轮；
- session 最后一轮结束时；
- 发生取消、错误、最大轮次退出时。

**原因：**
- 目前前端只能在 `agent-complete` 时收最后一轮，其它轮次缺少合法结束信号。
- 让每个窗口自己根据“下一轮开始了”去推断上一轮结束，容易出现竞态和实现漂移。
- 显式事件更利于记录 `endTime`、状态和最终阶段。

**备选方案：**
- 仅在前端收到新的 `agent-turn` 时自动关闭上一轮。
  这个方案对“最后一轮结束但没有下一轮”的场景不干净，也会让主窗口和 Trace 窗口继续维护两套推断逻辑。

### 3. 以 `chatStore` 中的 conversation turns 作为规范化真相，`traceStore` 只保留窗口视图状态

**选择：**主窗口负责把 Turn/Tool 追踪状态写入 `chatStore` 的 `conversation.turns`，Trace 窗口只同步并消费这份数据；`traceStore` 仅保留当前 conversation、置顶、停靠等窗口局部状态。

**原因：**
- 现在 Trace 和主窗口都在“重建同一条时间线”，这是状态漂移的根源。
- `chatStore` 已经是跨视图共享且可持久化的 store，天然适合作为规范化数据源。
- Trace 窗口更像一个专门的 viewer，而不是第二套状态引擎。

**备选方案：**
- 保留两套 Turn 写入逻辑，只尝试让它们更接近。
  这只能缓解重复，不会解决根因。

### 4. Prompt 渲染改为“内容块优先，纯文本兜底”

**选择：**Trace Prompt 视图优先渲染 `contentBlocks`，按 block 类型输出可读摘要；只有在缺少 `contentBlocks` 时才回退到顶层 `content`。

**原因：**
- 新的数据模型中，部分消息天然只有 `contentBlocks`，例如批量 `tool_result`。
- 继续只读 `content` 会稳定地产生空白 `user` / `assistant` 条目。
- 内容块渲染还能顺带把 `thinking`、`tool_use`、`tool_result` 明确展示出来。

**备选方案：**
- 在后端额外拼接 `content`，把所有结构重新压平为纯文本。
  这样会丢失结构语义，也不利于后续 richer trace。

### 5. 主窗口和 Trace 窗口共享同一套工具展示输入模型，但使用不同密度的组件

**选择：**两边都基于统一的 tool trace step 模型渲染；Trace 展示完整参数、阶段和结果，主窗口展示紧凑摘要并支持按需展开详情。

**原因：**
- 用户需要的是“一套真相，两种密度”，而不是两套彼此独立的功能。
- 共享输入模型可以降低 UI 漂移风险，同时保留各自的交互风格。

**备选方案：**
- 只在 Trace 做完整实现，主窗口继续保留简单 `toolCalls/toolResults`。
  这满足不了“主窗口像 Claude Code”这一目标。

### 6. 迁移期保留旧事件与旧消息字段，直到新视图完全接管

**选择：**迁移初期保留现有 `tool-call` / `tool-result` 以及消息上的 `toolCalls` / `toolResults`，新视图逐步切换到统一 tool trace 模型，待测试稳定后再决定是否收缩旧字段。

**原因：**
- 当前主窗口渲染和部分测试依赖旧字段，立即删除风险高。
- 这次变更跨 Rust IPC、store、Trace、聊天区多个模块，渐进迁移更稳妥。

## Risks / Trade-offs

- **[风险] 事件数量增加，前端处理链更复杂** → **缓解：**用统一 `ToolTraceEvent` 和共享 reducer/helper，避免在多个组件里散落事件拼装逻辑。
- **[风险] Turn 与 delta flush 的竞态导致结束时丢字** → **缓解：**在前端处理 Turn 完成事件前先 flush thinking/response 缓冲。
- **[风险] 并发工具调用的显示顺序不稳定** → **缓解：**事件中保留逻辑顺序号和批次信息，UI 按逻辑顺序渲染，而不是按到达时间盲排。
- **[风险] Trace 数据体积继续增长** → **缓解：**复用已有输出截断策略，主窗口默认显示摘要，Trace 再按需展开完整内容。
- **[风险] 迁移期双轨字段带来临时冗余** → **缓解：**限定迁移窗口，并用测试覆盖新旧字段共同存在的行为。

## Migration Plan

1. 后端先补充显式 Turn 收口事件和统一 `ToolTraceEvent`，并保留现有 `tool-call` / `tool-result`。
2. 前端引入共享的 Turn/Tool 归并逻辑，把 `chatStore` 变成唯一规范化数据源。
3. Trace 窗口切换到新的 Turn/Tool 数据结构，完成工具过程视图和 Prompt 内容块渲染。
4. 主窗口聊天区接入同一套工具追踪模型，提供紧凑过程视图。
5. 扩展自动化测试，确认多轮、并发、失败、`contentBlocks`-only Prompt 和取消场景都稳定后，再评估是否收缩旧字段。

## Open Questions

- Trace 中的工具参数是否默认显示为 pretty JSON，还是只显示摘要并按需展开？
- 主窗口紧凑工具卡片是否要默认只展开最新一条，还是全部折叠？
- 对于纯校验失败、权限拒绝这类“未真正启动进程”的工具调用，UI 是否统一显示为 `failed`，还是区分为单独的 `blocked` 状态？
