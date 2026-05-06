## Context

这次修复横跨前端聊天滚动控制与后端 prompt/transcript 组装两条链路。当前 `MessageList` 同时维护按钮触发的平滑滚动保护期、流式输出期间的自动贴底循环，以及用户手动滚动意图窗口；三者的优先级没有被统一建模，导致用户在按钮滚动期间主动上滑后，界面仍会重新回到底部。

另一边，前端为了展示“思考 -> 工具 -> 文本”的阅读顺序，引入了基于 `contentBlocks` 和 turn projection 的新排序；但 provider transcript 仍需满足 Anthropic/DeepSeek 对 `tool_use` / `tool_result` 紧邻关系的约束。当前展示顺序与 provider 顺序耦合后，assistant 文本可能插入到 `tool_use` 与下一条 user `tool_result` 之间，触发 400。

## Goals / Non-Goals

**Goals:**

- 让用户手动滚动成为最高优先级信号，能够立即中断按钮触发的自动跟随和平滑滚动。
- 保持主窗口 UI 的阅读顺序不回退，同时恢复 provider transcript 的合法消息邻接关系。
- 为滚动打断、工具失败和 transcript 组装增加测试覆盖，防止同类回归再次出现。

**Non-Goals:**

- 不重写整套消息折叠、trace 投影或 turn-first 渲染架构。
- 不改变现有中文文案或 Tool 结果块的视觉样式。
- 不调整 provider 选择、工具执行权限或错误文案策略。

## Decisions

### 1. 用户滚动将显式取消按钮平滑滚动状态

在 `MessageList` 中新增“取消程序化平滑滚动”的处理：当按钮触发后，如果用户通过 `wheel`、`pointer`、`touch` 或键盘滚动产生真实交互，组件立即清空平滑滚动截止时间和定时器，并将 `autoFollow` 关闭。这样不再依赖短于按钮动画时长的“用户意图窗口”去间接打断跟随。

备选方案：
- 仅把 `USER_SCROLL_INTENT_MS` 调大到超过按钮动画时长。未采用，因为它仍然是时间竞争，无法保证不同设备与帧率下的一致性。
- 删除按钮平滑滚动，仅保留瞬时滚动。未采用，因为会损失已有的交互反馈。

### 2. `updateScrollAffordance` 不再在平滑滚动保护期内无条件恢复 auto-follow

滚动状态更新逻辑会区分“程序化滚动尚未被打断”和“用户已接管滚动”。只有前者才允许隐藏按钮并保持跟随；一旦用户打断，后续流式帧循环与 resize 回调都必须尊重 `autoFollow = false`。

备选方案：
- 仅在 `keepPinnedToBottom` 循环里检查用户意图。未采用，因为 `syncScrollInFrame` 与按钮结束后的强制补滚仍可能重新设回跟随状态。

### 3. UI 顺序与 provider transcript 顺序分离

聊天窗口继续按 `contentBlocks` / turn projection 渲染“思考 -> 工具 -> 文本”，但 `buildProviderTranscript` 恢复为 provider-safe 序列：某一轮 assistant 消息中的 `tool_use` 之后，紧邻的下一条 user 消息必须只承载对应 `tool_result` 块；任何 assistant 文本都只能出现在这些 tool results 之后的下一条 assistant 消息中。

这意味着“单条 assistant 消息在 UI 中显示多个阶段内容”和“发送给 provider 的多条规范消息”是两个不同视图，不能共享同一套顺序假设。

备选方案：
- 修改 Rust `sanitize_prompt_message`，在发送前重排 assistant 文本与 tool blocks。未采用，因为 transcript 的来源已经在前端按 turn 组装，局部重排更难验证多轮顺序。
- 让 UI 回退到 provider-safe 顺序。未采用，因为会破坏当前主窗口可读性目标。

### 4. 失败工具场景与成功工具场景共享同一邻接规则

`tool_result` 的合法性只取决于是否紧邻对应 `tool_use`，不取决于工具成功或失败。因此 transcript 测试会同时覆盖 `success: false` / `isError: true` 的场景，确保“失败工具结果”不会再次走到 assistant 文本后面。

## Risks / Trade-offs

- [Risk] 滚动中断逻辑过于激进，可能把非用户触发的事件也识别为打断。 → Mitigation：只在明确的输入事件入口中取消平滑滚动，并保留程序化滚动的 `skipScrollEvent` 标记。
- [Risk] transcript 顺序调整后，现有依赖 `contentBlocks` 顺序的测试可能需要同步更新。 → Mitigation：把 UI 渲染测试和 provider transcript 测试分开断言，避免再次共享隐式顺序。
- [Risk] 当前工作区已有进行中的消息重构改动，修复时可能与未提交修改交叉。 → Mitigation：仅在滚动、turn transcript、相关测试文件上做最小修改，不回退现有重构内容。
