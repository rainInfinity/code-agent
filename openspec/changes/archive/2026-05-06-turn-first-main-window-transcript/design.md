## Context

当前系统同时维护两套与 assistant 执行过程相关的数据视图：

- `conversation.messages`：主窗口使用的对话消息列表，当前会把一次 Agent 运行中的多轮 turn 压平到单条 assistant message。
- `conversation.turns`：Trace 窗口使用的 turn 级追踪数据，按 turn 独立记录 prompt、thinking、tools 和 response。

这两套视图目前不是同一语义层级。Trace 窗口按 turn 渲染，因此每个 thinking 都有独立生命周期；主窗口则把 `thinkingContent`、`contentBlocks`、`toolTraces`、`message.status` 混合使用，导致多轮 thinking 的内容边界、状态边界和 provider transcript 边界全部错位。

另外，后端 `AgentSession` 实际维护的是合法的 provider transcript：assistant `tool_use` 后面紧跟 user `tool_result`。但前端重新发起下一轮对话时，并未复用这份 transcript，而是从主窗口的 UI message 近似重建 prompt，导致工具轮次一多就会破坏 Anthropic/DeepSeek 的邻接约束。

这个变更是一个跨数据模型、渲染层和 prompt 组装层的重构，需要在不破坏现有 Trace 窗口和历史会话可读性的前提下完成。

## Goals / Non-Goals

**Goals:**

- 让主窗口和 Trace 窗口共享同一套 turn-first assistant 生命周期语义。
- 让每个主窗口 thinking 块拥有独立的状态、计时和完成态。
- 让 provider prompt 历史从 canonical transcript 派生，而不是从 UI `contentBlocks` 近似重建。
- 保持现有主窗口“用户消息 + 一条 assistant 回复气泡”的顶层聊天阅读体验，避免一次性重做整个对话列表交互。
- 为已有持久化会话提供兼容迁移路径。

**Non-Goals:**

- 不重做 Trace 窗口的视觉样式或折叠交互。
- 不修改 Anthropic / DeepSeek 的 provider 协议。
- 不在本次变更中移除全部 legacy 字段；清理冗余字段留给后续收尾变更。
- 不改变用户消息的顶层消息模型或 FoldDivider 的整体交互方式。

## Decisions

### 决策 1：以 `conversation.turns` 作为 assistant 生命周期的 canonical owner，并补齐主窗口所需关联信息

**选择：** 保留现有 `conversation.turns` 作为 canonical turn 数据源，但扩展 turn 记录，使其显式关联所属 `assistantMessageId`，并承载可用于重建 provider transcript 的 turn 级内容片段。

**原因：**

- Trace 窗口已经证明 turn-first 结构能正确表达 thinking / tool / response 的边界。
- 继续让 `message.contentBlocks` 充当 canonical source，会重复主窗口当前的压平错误。
- turn 级记录天然适合表达“第几轮 thinking 开始/结束”“本轮工具调用顺序”“本轮 response 何时开始”等状态。

**备选方案：**

- 让 `message.contentBlocks` 升级为 canonical transcript。放弃原因：它本质上仍是 UI 容器，难以表达跨 turn 的 assistant/user 交替关系。
- 新增一套独立于 `turns` 的 transcript store。放弃原因：会和现有 Trace turn 数据形成第三套真相来源。

### 决策 2：主窗口保留顶层 message 结构，但 assistant 气泡内部改为渲染 turn sections

**选择：** 不把一次 Agent 运行拆成多条顶层 assistant message；主窗口仍保留当前的消息列表结构，但 assistant message 的正文不再直接遍历扁平 `contentBlocks`，而是改为基于关联 turns 渲染多个 turn section。

每个 turn section 内部包含：

- thinking panel
- compact tool trace blocks
- response markdown / text

**原因：**

- 这条路径能最大化复用现有消息列表、折叠、复制、滚动等交互。
- 用户仍然看到一条连续 assistant 回复，但内部语义边界变为正确的 turn 级结构。
- 相比把每个 turn 变成独立 assistant message，这种方案对历史聊天外观和 fold 逻辑影响更小。

**备选方案：**

- 每个 turn 拆成一条新的 assistant message。放弃原因：会显著改变聊天阅读节奏、折叠边界和历史会话外观，迁移成本更高。

### 决策 3：provider-compatible transcript 从 canonical turns + user messages 派生，不再从 UI blocks 过滤拼接

**选择：** 下一轮调用 `runAgent` 时，前端发送的历史消息 SHALL 由专门的 transcript builder 生成。这个 builder 从：

- 顶层 user messages
- 与 assistant message 关联的 canonical turns

推导出合法的 provider transcript，包括：

- assistant message 中的 thinking / tool_use / final text
- 紧随 assistant tool_use 的 user tool_result message

**原因：**

- 这能直接满足 Anthropic/DeepSeek 的相邻块约束。
- UI block 过滤规则不再有机会误删 `tool_result`。
- transcript builder 的职责会与主窗口渲染职责解耦，避免“一份数据兼做 UI 和协议”的混用。

**备选方案：**

- 继续在 `sanitizeMessageContentBlocksForPrompt` 上修补过滤规则。放弃原因：即使补回 `tool_result`，扁平 assistant message 仍无法稳定恢复正确的 assistant/user 交错结构。

### 决策 4：thinking 状态改为 turn-scoped view model，而不是共享 message 级状态

**选择：** Thinking panel 的进行中/完成态、计时和光标显示改为读取所属 turn 的 thinking lifecycle，而不是读取外层 `message.status`、`message.content`、`message.thinkingStartedAt`。

需要为主窗口提供 turn-scoped 派生字段，例如：

- `thinkingStatus`
- `thinkingStartedAt`
- `thinkingEndedAt`
- `responseStarted`

这些值可以直接从 `turn.thinking` 和 `turn.response` 派生，无需继续挂在 message 根级别共享。

**原因：**

- 当前多个 thinking 面板共用同一 message 状态，是状态共享 bug 的直接根源。
- turn 生命周期已经在 Trace 路径中存在，主窗口只需要消费同一语义。

**备选方案：**

- 给 `ContentBlock.thinking` 增加独立状态字段。放弃原因：仍然会让 UI block 承担生命周期真相来源，重复数据且更难同步。

### 决策 5：采用增量迁移，先兼容 legacy conversations，再逐步移除旧字段

**选择：** 本次变更先以兼容方式引入 turn-first 所需字段和投影逻辑：

- 对新会话：实时写入 canonical turn 关联信息。
- 对旧会话：在 `normalizePersistedConversations` 中把已有数据尽量归并为单 turn 或多 turn 可消费结构。
- legacy `thinkingContent`、`toolCalls`、`toolResults`、`toolTraces` 暂时保留，只作为迁移输入与回退兜底。

**原因：**

- 现有 localStorage 历史不能一次性丢弃。
- 先增量迁移可以降低发布风险，并保留回滚空间。

**备选方案：**

- 强制清空旧会话。放弃原因：会破坏用户历史记录，不适合当前缺陷修复型变更。

## Risks / Trade-offs

- **[风险] 主窗口渲染路径从 message-first 转向 turn-first 后，滚动和折叠逻辑可能出现边界抖动** → **缓解：** 保持顶层 `messages[]` 不变，只替换 assistant message body 的内部投影；为 streaming、fold、copy 增加回归测试。
- **[风险] legacy 会话缺少显式 turn 边界，无法总是精准还原多轮 transcript** → **缓解：** 迁移时优先保证“可读”和“后续不再触发非法 prompt”；对无法还原的旧数据退化为单 assistant turn 视图。
- **[风险] canonical turn 与顶层 message 同时存在，短期内会有数据重复** → **缓解：** 明确 `turns` 为 assistant lifecycle 真相来源，`messages` 为阅读视图容器；后续单独收尾 legacy 字段。
- **[权衡] 保留单 assistant 气泡意味着主窗口不会完全等同于 provider transcript 结构** → **接受：** 用户阅读体验比协议层结构更重要，但内部渲染和发送历史必须从 canonical turns 正确派生。

## Migration Plan

1. 在共享 store 中为新 turn 数据补齐 assistant message 关联与 transcript 派生所需字段。
2. 将主窗口 assistant body 改为消费 turn sections，同时保留旧渲染回退路径用于历史未迁移数据。
3. 引入独立 transcript builder，替换现有从 `message.contentBlocks` 直接组 prompt 的路径。
4. 在 `normalizePersistedConversations` 中增加 legacy conversation 迁移逻辑，并为迁移结果补充测试。
5. 完成验证后，再评估移除 message 级共享 thinking 状态字段和 prompt 过滤兜底代码。

回滚策略：

- 保留 legacy message 字段与旧渲染回退路径；
- 如需回滚，可重新启用旧的 assistant body 渲染和旧 prompt 组装逻辑，而不会导致历史会话不可读。

## Open Questions

- 主窗口消息复制行为是否继续复制整条 assistant message 的最终文本，还是提供按 turn 复制的补充入口？
- 对于已持久化但只记录了扁平 blocks 的历史会话，是否需要在 UI 上标记为 legacy-rendered，以避免用户误解其 turn 精度？
