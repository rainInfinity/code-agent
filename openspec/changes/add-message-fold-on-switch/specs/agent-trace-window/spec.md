## ADDED Requirements

### Requirement: TurnList 支持历史回合折叠

TracePanel 中的 TurnList SHALL 集成回合折叠机制。当回合数或内容长度超过阈值时，历史回合 SHALL NOT 渲染为 TurnCard 组件。折叠边界 SHALL 显示 FoldDivider 组件提供渐进式加载。

#### Scenario: 多回合 Trace 自动折叠

- **GIVEN** agent 执行了 30 个回合，Trace 窗口正在监控该对话
- **WHEN** Trace 窗口渲染 TurnList
- **THEN** TurnList SHALL 仅渲染最近 N 个回合的 TurnCard 组件
- **AND** 折叠的回合 SHALL NOT 存在于 DOM 中
- **AND** FoldDivider SHALL 显示在第一个可见 TurnCard 上方

#### Scenario: 少量回合全部渲染

- **GIVEN** agent 执行了 5 个回合
- **WHEN** Trace 窗口渲染 TurnList
- **THEN** TurnList SHALL 渲染全部 5 个回合
- **AND** FoldDivider SHALL NOT 存在

#### Scenario: Trace 加载更多回合

- **GIVEN** 30 个回合已按阈值折叠
- **WHEN** 用户点击 Trace 窗口中的"加载最近 5 回合"
- **THEN** 5 个新回合的 TurnCard SHALL 被创建
- **AND** 折叠分割线更新统计信息

#### Scenario: Trace 展开全部回合

- **GIVEN** 30 个回合已按阈值折叠
- **WHEN** 用户点击 Trace 窗口中的"展开全部"
- **THEN** 所有 30 个回合的 TurnCard SHALL 被创建
- **AND** 折叠分割线 SHALL 消失

#### Scenario: Agent 运行中历史回合保持折叠

- **GIVEN** 已完成的 15 个回合中折叠了前 5 个，agent 正在运行产生第 16 个回合
- **WHEN** 第 16 个回合的 TurnCard 被创建
- **THEN** 前 5 个回合 SHALL 保持折叠
- **AND** 第 16 个回合的 TurnCard SHALL 在可见区域渲染
- **AND** Trace 自动滚动到最新回合的行为 SHALL 正常
