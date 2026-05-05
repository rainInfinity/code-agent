## ADDED Requirements

### Requirement: 回合折叠双阈值触发

TracePanel 中的 TurnList SHALL 在渲染前根据双阈值判断是否需要折叠历史回合。双阈值为：最大可见回合数（默认 10）和 token 预算上限（默认 4000 tokens 估算值）。折叠点 SHALL 取两个阈值中更严格者。回合的 token 估算 SHALL 合计该回合的 prompt + thinking + response 内容长度。

#### Scenario: 回合数超过上限时折叠

- **GIVEN** 当前 trace 包含 25 个回合，总估算 tokens 未超过预算，最大可见回合数配置为 10
- **WHEN** Trace 窗口渲染该对话的回合列表
- **THEN** 仅最近 10 个回合的 TurnCard SHALL 被创建
- **AND** 前 15 个回合的 TurnCard SHALL NOT 被创建
- **AND** 折叠分割线 SHALL 显示在可见回合上方

#### Scenario: token 估算超过预算时折叠

- **GIVEN** Trace 包含 8 个回合，但总估算 tokens 超过 4000
- **WHEN** Trace 窗口渲染
- **THEN** 仅 tokens 估算在 4000 以内的最近回合 SHALL 渲染
- **AND** 超出预算的旧回合 SHALL NOT 被创建

#### Scenario: 两阈值均未超过时正常渲染

- **GIVEN** Trace 包含 5 个回合，总估算 tokens 不超过 4000
- **WHEN** Trace 窗口渲染
- **THEN** 全部 5 个回合 SHALL 正常渲染
- **AND** 折叠分割线 SHALL NOT 存在

### Requirement: 渐进式加载历史回合

Trace 窗口的折叠分割线 SHALL 提供与主窗口一致的渐进式加载交互：每次加载固定数量（默认 5 回合）和"展开全部"选项。

#### Scenario: 加载更多回合

- **GIVEN** 15 个回合已折叠前 5 个，折叠分割线可见
- **WHEN** 用户点击"加载最近 5 回合"按钮
- **THEN** 折叠点 SHALL 前移 5 回合
- **AND** 5 个新回合的 TurnCard SHALL 被创建并插入折叠分割线上方

#### Scenario: 展开全部回合

- **GIVEN** 15 个回合已折叠前 5 个
- **WHEN** 用户点击"展开全部"按钮
- **THEN** 所有折叠回合 SHALL 被渲染
- **AND** 折叠分割线 SHALL 消失

### Requirement: 流式接收期间保持回合折叠状态

在 agent 运行并流式输出回合数据期间（`status === 'running'`），Trace 窗口的折叠状态 SHALL 保持不变。新产生的回合（最新）默认可见，不影响历史回合的折叠。

#### Scenario: agent 运行中历史回合保持折叠

- **GIVEN** Trace 已有 15 个完成回合且折叠了前 5 个，agent 正在运行产生第 16 个回合
- **WHEN** 新的回合数据流式到达
- **THEN** 前 5 个历史回合 SHALL 保持折叠状态
- **AND** 第 16 个回合（最新）SHALL 在可见区域渲染
- **AND** 折叠分割线 SHALL 保持显示

### Requirement: 会话切换时重置回合折叠状态

当 Trace 窗口切换监控到不同 conversationId 时，折叠状态 SHALL 重置为新对话的默认折叠计算。

#### Scenario: Trace 窗口切换监控对话

- **GIVEN** Trace 窗口监控对话 A，用户已展开全部 15 个回合
- **WHEN** 主窗口切换到对话 B，Trace 窗口自动切换到监控对话 B
- **THEN** 对话 B 的回合 SHALL 按双阈值重新计算折叠点
- **AND** 对话 A 的展开状态 SHALL 被丢弃

### Requirement: Trace 折叠阈值独立配置

Trace 窗口的折叠阈值常量 SHALL 独立于主窗口的折叠阈值，两者各自维护。

#### Scenario: Trace 和主窗口使用不同阈值

- **WHEN** 修改 `TRACE_FOLD_CONFIG.MAX_VISIBLE_TURNS`
- **THEN** 主窗口 `CHAT_FOLD_CONFIG.MAX_VISIBLE_TURNS` SHALL NOT 受影响
- **AND** 主窗口的折叠行为 SHALL NOT 改变
