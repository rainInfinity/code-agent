## ADDED Requirements

### Requirement: MessageList 支持历史消息折叠

MessageList 组件 SHALL 集成消息折叠机制。当对话轮次或内容长度超过阈值时，历史消息 SHALL NOT 渲染为 MessageItem 组件。折叠边界 SHALL 显示 FoldDivider 组件提供渐进式加载。

#### Scenario: 长对话切换时自动折叠

- **GIVEN** 对话包含 30 轮消息（60+ Message 对象）
- **WHEN** 用户从侧边栏切换到该对话
- **THEN** MessageList SHALL 仅渲染最近 N 轮的 MessageItem 组件
- **AND** 折叠的消息 SHALL NOT 存在于 DOM 中（querySelector 无法找到折叠消息的元素）
- **AND** FoldDivider SHALL 显示在第一个可见 MessageItem 上方

#### Scenario: 短对话切换时全部渲染

- **GIVEN** 对话包含 3 轮消息
- **WHEN** 用户从侧边栏切换到该对话
- **THEN** MessageList SHALL 渲染全部 3 轮消息
- **AND** FoldDivider SHALL NOT 存在

#### Scenario: 加载更多后滚动位置保持

- **GIVEN** 对话已折叠，用户滚动至中间位置查看可见消息
- **WHEN** 用户点击"加载最近 5 轮"
- **THEN** 新消息 SHALL 插入到折叠分割线原位置上方
- **AND** 用户当前视口位置 SHALL 保持不变（内容不下跳也不上跳）

#### Scenario: 流式输出中折叠行为

- **GIVEN** 长对话正在流式接收新消息
- **WHEN** 流式 delta 持续更新最新消息内容
- **THEN** 历史消息的折叠状态 SHALL NOT 改变
- **AND** 最新消息 SHALL 始终在可见区域渲染
- **AND** 自动滚动到底部的行为 SHALL 正常工作
