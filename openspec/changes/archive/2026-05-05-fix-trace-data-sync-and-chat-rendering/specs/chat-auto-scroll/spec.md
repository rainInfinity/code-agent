# chat-auto-scroll Specification

## ADDED Requirements

### Requirement: 流式生成期间自动跟随底部

聊天消息列表 SHALL 在流式生成期间，当用户处于底部或距离底部不超过 150px 时，持续保持滚动位置在最新内容底部。

#### Scenario: 用户在底部时自动跟随流式内容

- **GIVEN** 对话已有多条历史消息
- **AND** 用户滚动到最底部
- **WHEN** 用户发送消息并开始流式生成回复
- **THEN** 消息列表 SHALL 随回复内容增长自动滚动到底部
- **AND** 用户 SHALL 始终能看到最新生成的 token
- **AND** 自动跟随 SHALL NOT 因新内容撑高 scrollHeight 而中断

#### Scenario: 用户距离底部 150px 内时自动跟随

- **GIVEN** 流式生成正在进行
- **AND** 用户当前距离底部不超过 150px
- **WHEN** 新 token 追加到回复中
- **THEN** 消息列表 SHALL 将该状态视为接近底部
- **AND** SHALL 自动滚动到最新内容底部

#### Scenario: 用户手动上滑超过阈值后停止自动跟随

- **GIVEN** 流式生成正在进行
- **AND** 用户原本处于底部
- **WHEN** 用户手动向上滚动到距离底部超过 150px
- **THEN** 自动跟随 SHALL 关闭
- **AND** “滚动到最新消息”按钮 SHALL 显示
- **AND** 新 token 追加时 SHALL NOT 强行把用户拉回底部

#### Scenario: 用户回到底部附近后恢复自动跟随

- **GIVEN** 自动跟随已关闭
- **AND** “滚动到最新消息”按钮可见
- **WHEN** 用户手动滚动到距离底部不超过 150px
- **THEN** 自动跟随 SHALL 恢复
- **AND** “滚动到最新消息”按钮 SHALL 隐藏

#### Scenario: 点击滚动到底部按钮恢复自动跟随

- **GIVEN** 自动跟随已关闭
- **WHEN** 用户点击“滚动到最新消息”按钮
- **THEN** 消息列表 SHALL 平滑滚动到底部
- **AND** 自动跟随 SHALL 恢复
- **AND** 按钮 SHALL 隐藏

#### Scenario: 程序自动滚动不触发误判

- **GIVEN** 流式生成正在进行
- **AND** autoFollow 状态为开启
- **WHEN** 程序在 rAF 中设置 `scrollTop = scrollHeight`
- **AND** 浏览器触发 `onScroll`
- **THEN** `updateScrollAffordance` SHALL 检测到程序滚动标记
- **AND** SHALL 跳过距离检测
- **AND** autoFollow 状态 SHALL 保持开启

### Requirement: 流式结束后确认最终位置

流式生成结束后，如果用户仍处于自动跟随状态，消息列表 SHALL 执行最后一次滚动到底部，确保最终内容可见。

#### Scenario: 流式结束后滚动确认

- **GIVEN** 流式生成正在进行
- **AND** 用户处于底部或接近底部
- **WHEN** streaming 状态从 true 变为 false
- **THEN** 消息列表 SHALL 在短延迟后强制滚动到底部
- **AND** 最终回复底部 SHALL 完全可见
