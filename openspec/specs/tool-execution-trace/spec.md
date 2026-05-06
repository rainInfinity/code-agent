# tool-execution-trace Specification

## ADDED Requirements

### Requirement: Tool execution lifecycle shall be exposed as structured trace events

系统 SHALL 为每个工具调用发出结构化追踪事件，覆盖模型请求、执行开始、执行完成和执行失败等关键阶段。每条事件 SHALL 至少包含 `conversationId`、`sessionId`、`turn`、`messageId`、`toolCallId`、工具名和输入参数，以便主窗口与 Trace 窗口共享同一条工具时间线。

#### Scenario: Model requests a tool

- **WHEN** Agent 在某一轮 assistant 输出中解析出一个 `tool_use`
- **THEN** 系统 SHALL 发出一条工具追踪事件，状态为"已请求"
- **AND** 事件 SHALL 包含完整的工具名和输入参数
- **AND** 事件 SHALL 关联到当前 conversation、session、turn 和 assistant message

#### Scenario: Tool execution begins

- **GIVEN** 一个工具调用已经进入执行器
- **WHEN** 执行器开始实际运行该工具
- **THEN** 系统 SHALL 发出一条工具追踪事件，状态为"执行中"
- **AND** 事件 SHALL 复用同一个 `toolCallId`
- **AND** 事件 SHALL 记录开始时间

#### Scenario: Tool execution succeeds

- **GIVEN** 一个工具调用执行成功
- **WHEN** 执行结果可用
- **THEN** 系统 SHALL 发出一条工具追踪事件，状态为"已完成"
- **AND** 事件 SHALL 包含标准化后的输出文本
- **AND** 事件 SHALL 记录结束时间

#### Scenario: Tool execution fails before or during runtime

- **GIVEN** 一个工具调用因为校验失败、权限拒绝、超时或运行时错误而失败
- **WHEN** 系统确定该调用无法成功完成
- **THEN** 系统 SHALL 发出一条工具追踪事件，状态为"失败"
- **AND** 事件 SHALL 包含可展示的失败原因
- **AND** UI SHALL 不把该调用永远保留在"执行中"

### Requirement: Tool trace records shall preserve logical order and batch context

当同一轮中存在多个工具调用时，系统 SHALL 保留它们在 assistant 输出中的逻辑顺序；当多个工具被并发执行时，系统 SHALL 暴露足够的批次上下文，使 UI 能稳定展示它们属于同一执行批次。

#### Scenario: Multiple tools in one turn

- **WHEN** 同一轮 assistant 消息中包含多个工具调用
- **THEN** 每个工具调用 SHALL 拥有独立的 `toolCallId`
- **AND** 每个调用 SHALL 保留其在该轮中的逻辑顺序
- **AND** UI SHALL 按逻辑顺序渲染，而不是仅按事件到达时间渲染

#### Scenario: Concurrent execution batch

- **GIVEN** 执行器将一组工具判定为可并发执行
- **WHEN** 这些工具开始运行
- **THEN** 系统 SHALL 为这些工具暴露共享的批次上下文或并发标记
- **AND** UI SHALL 能识别这些工具属于同一批执行

### Requirement: Tool trace events shall be consumable by both detailed and compact views

工具追踪事件 SHALL 同时支持详细 Trace 视图和主窗口紧凑视图。系统 SHALL 在同一条规范化数据中同时保留完整参数/结果和便于摘要展示的状态信息。

#### Scenario: Trace window consumes detailed data

- **WHEN** Trace 窗口接收一条工具追踪事件
- **THEN** 它 SHALL 能展示工具名、参数、阶段变化、输出或错误信息
- **AND** 不需要额外拼接其他来源的数据才能判断该工具当前状态

#### Scenario: Main window consumes compact data

- **WHEN** 主窗口聊天区接收一条工具追踪事件
- **THEN** 它 SHALL 能基于同一条数据渲染紧凑状态摘要
- **AND** 不要求主窗口展示 Trace 级别的全部细节
