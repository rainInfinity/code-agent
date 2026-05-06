# chat-message-rendering Delta Spec

## MODIFIED Requirements

### Requirement: Assistant messages shall display compact tool execution process blocks

当 assistant 消息触发工具调用时，主窗口聊天区 SHALL 在消息体中渲染紧凑的工具过程块，以展示工具名、当前状态和结果摘要。工具过程块 SHALL 在时间线上位于文本回复之前（因为工具执行发生在最终文本生成之前）。该视图 SHALL 借鉴 Claude Code 风格，但保持适合主窗口聊天流的紧凑密度。渲染顺序 SHALL 基于 `message.contentBlocks` 的插入时间顺序，而非组件硬编码。

#### Scenario: Tool is requested and starts running

- **WHEN** assistant 消息关联的工具调用进入已请求或执行中状态
- **THEN** 聊天区 SHALL 在该 assistant 消息内显示一个工具过程块
- **AND** 过程块 SHALL 显示工具名和运行中状态
- **AND** 用户无需打开 Trace 窗口也能知道 Agent 正在使用哪个工具

#### Scenario: Tool finishes successfully

- **WHEN** 一个工具调用成功结束
- **THEN** 同一个工具过程块 SHALL 更新为完成状态
- **AND** 过程块 SHALL 显示简短结果摘要
- **AND** 用户 SHALL 能按需展开查看参数或完整输出详情

#### Scenario: Tool fails

- **WHEN** 一个工具调用失败
- **THEN** 工具过程块 SHALL 更新为失败状态
- **AND** 过程块 SHALL 显示可读的错误摘要
- **AND** UI SHALL 不把失败工具继续显示为运行中

#### Scenario: Multiple tools are used in one assistant message

- **GIVEN** 同一个 assistant 消息包含多个工具调用
- **WHEN** 聊天区渲染该消息
- **THEN** 所有工具过程块 SHALL 按事件到达时间顺序显示
- **AND** 工具过程块 SHALL 渲染在最终文本回复之前
- **AND** 最终回复正文 SHALL 与这些过程块共存，而不是被覆盖或拆成空白消息

#### Scenario: Tool calls appear before text response in chronological order

- **GIVEN** Agent 先调用工具然后再生成文本回复
- **WHEN** 聊天区渲染该消息
- **THEN** 工具调用块 SHALL 在视觉上位于文本回复块的上方
- **AND** 这与 Agent 实际执行顺序（Think → Act → Observe → Respond）一致
