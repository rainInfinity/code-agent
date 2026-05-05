# trace-turn-timing Specification

## ADDED Requirements

### Requirement: Turn Time Display in TurnCard Header

每个 TurnCard 的头部 Meta 区域 SHALL 展示该 Turn 的时间信息：完成状态时展示总耗时，运行中状态时展示实时耗时。

#### Scenario: 已完成 Turn 展示耗时

- **GIVEN** Turn 状态为 'complete'，startTime = 1000，endTime = 3300
- **WHEN** TurnCard 渲染
- **THEN** Meta 区域 SHALL 显示 "2.3s"（格式化的 duration）
- **AND** 耗时计算 SHALL 为 `endTime - startTime`

#### Scenario: 运行中 Turn 展示实时耗时

- **GIVEN** Turn 状态为 'running'，startTime 为 5 秒前
- **WHEN** TurnCard 渲染
- **THEN** Meta 区域 SHALL 显示实时更新的耗时（如 "5.0s"）
- **AND** 计时器 SHALL 每 100ms 更新一次（与 ThinkingPanel 的 elapsed timer 一致）

#### Scenario: 出错 Turn 展示耗时

- **GIVEN** Turn 状态为 'error'，startTime = 1000，endTime = 2100
- **WHEN** TurnCard 渲染
- **THEN** Meta 区域 SHALL 显示 "1.1s"

### Requirement: Time Formatting Rules

时间格式化 SHALL 遵循以下规则：
- 耗时 < 1 秒：`"XXXms"`（如 `"230ms"`）
- 耗时 < 60 秒：`"X.Xs"`（如 `"2.3s"`、`"45.7s"`）
- 耗时 ≥ 60 秒：`"XmXs"`（如 `"1m23s"`）

#### Scenario: 亚秒级耗时

- **GIVEN** Turn 耗时为 450ms
- **WHEN** 格式化展示
- **THEN** SHALL 显示 "450ms"

#### Scenario: 分钟级耗时

- **GIVEN** Turn 耗时为 83 秒
- **WHEN** 格式化展示
- **THEN** SHALL 显示 "1m23s"

### Requirement: Turn Meta Area Layout

TurnCard 头部右侧 SHALL 按顺序展示：Turn 状态标记 → 耗时（→ Token 用量，由 token-usage-tracking capability 提供）。

#### Scenario: Meta 区域完整展示

- **GIVEN** Turn 状态 'complete'，耗时 3.2s
- **WHEN** TurnCard 渲染
- **THEN** Meta 区域 SHALL 显示 "完成 · 3.2s"
