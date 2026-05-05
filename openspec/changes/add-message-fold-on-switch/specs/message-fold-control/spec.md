## ADDED Requirements

### Requirement: 消息折叠双阈值触发

MessageList 组件 SHALL 在渲染前根据双阈值判断是否需要折叠历史消息。双阈值为：最大可见轮次（默认 10）和 token 预算上限（默认 4000 tokens 估算值）。折叠点 SHALL 取两个阈值中更严格者（即保留更少的轮次）。轮次的定义为一条 user 消息 + 紧随其后的 assistant 消息(s)。

#### Scenario: 轮次超过上限时折叠

- **GIVEN** 当前对话包含 25 轮，总估算 tokens 未超过预算，最大可见轮次配置为 10
- **WHEN** 用户切换到该对话
- **THEN** 仅最近 10 轮的消息 SHALL 渲染为 MessageItem 组件
- **AND** 前 15 轮的 MessageItem SHALL NOT 被创建
- **AND** 折叠分割线 SHALL 显示在可见消息上方

#### Scenario: token 估算超过预算时折叠

- **GIVEN** 当前对话包含 5 轮，但总估算 tokens 超过 4000（token 预算），最大可见轮次配置为 10
- **WHEN** 用户切换到该对话
- **THEN** 仅 tokens 估算在 4000 以内的最近轮次 SHALL 渲染
- **AND** 超出预算的旧轮次 SHALL NOT 被创建

#### Scenario: 两阈值均未超过时正常渲染

- **GIVEN** 当前对话包含 5 轮，总估算 tokens 不超过 4000
- **WHEN** 用户切换到该对话
- **THEN** 全部 5 轮消息 SHALL 正常渲染
- **AND** 折叠分割线 SHALL NOT 存在

### Requirement: 渐进式加载历史消息

折叠分割线 SHALL 提供渐进式加载按钮，每次加载固定数量（默认 5 轮）的折叠消息。同时 SHALL 提供"展开全部"选项。

#### Scenario: 加载更多

- **GIVEN** 20 轮对话已折叠前 10 轮，折叠分割线可见
- **WHEN** 用户点击"加载最近 5 轮"按钮
- **THEN** 折叠点 SHALL 前移 5 轮
- **AND** 5 轮新消息的 MessageItem SHALL 被创建并插入折叠分割线上方
- **AND** 折叠分割线更新为显示剩余折叠的轮次统计

#### Scenario: 展开全部

- **GIVEN** 20 轮对话已折叠前 10 轮
- **WHEN** 用户点击"展开全部"按钮
- **THEN** 所有折叠消息 SHALL 被渲染
- **AND** 折叠分割线 SHALL 消失
- **AND** 加载更多按钮 SHALL 不可见（因为全部已展开）

#### Scenario: 加载更多后剩余不足一批

- **GIVEN** 12 轮对话已折叠前 10 轮，显示可见 2 轮
- **WHEN** 用户点击"加载最近 5 轮"
- **THEN** 剩余 10 轮全部展开（实际仅有 10 轮可展开）
- **AND** 折叠分割线 SHALL 消失（无剩余折叠内容）

### Requirement: 流式接收期间保持折叠状态

在消息流式接收 (`status === 'streaming'`) 期间，折叠状态 SHALL 保持不变。新到达的流式 delta 不影响折叠点计算，新完成的轮次不触发重新折叠。

#### Scenario: 流式接收中不触发重新折叠

- **GIVEN** 对话已有 15 轮且折叠了前 5 轮，用户发送新消息开始流式接收
- **WHEN** 流式 delta 持续到达
- **THEN** 前 5 轮 SHALL 保持折叠状态
- **AND** 新消息 SHALL 始终在可见区域渲染（处于最新轮次）
- **AND** 折叠分割线 SHALL 保持显示

#### Scenario: 流式完成后的对话保持折叠

- **GIVEN** 流式接收完成，对话总轮次变为 16 轮（折叠 6 轮）
- **WHEN** 用户不做任何操作
- **THEN** 折叠状态 SHALL 保持不变（不因轮次增加而调整折叠点）

### Requirement: 会话切换时重置折叠状态

当用户切换到不同对话时，折叠状态 SHALL 重置为新对话的默认折叠计算。前一个对话的展开状态 SHALL NOT 保留。

#### Scenario: 从已展开对话切换到长对话

- **GIVEN** 用户将对话 A 的前 10 轮历史全部展开
- **WHEN** 用户切换到对话 B（包含 20 轮）
- **THEN** 对话 B SHALL 按双阈值计算折叠点并折叠历史轮次
- **AND** 对话 A 的展开状态 SHALL 被丢弃

#### Scenario: 切回之前查看过的对话

- **GIVEN** 用户在对话 B 中未展开任何折叠
- **WHEN** 用户切换回对话 A
- **THEN** 对话 A SHALL 重新按双阈值计算折叠点（不保留之前的展开状态）

### Requirement: 折叠阈值独立于后端上下文压缩配置

前端消息折叠的阈值常量 SHALL 独立于后端 ContextManager 的裁剪阈值。两者分别服务于渲染优化和 LLM 上下文管理，SHALL NOT 共享配置常量。

#### Scenario: 修改前端折叠阈值不影响后端

- **WHEN** 开发者修改 `CHAT_FOLD_CONFIG.MAX_VISIBLE_TURNS` 的值
- **THEN** 发送给 LLM 的消息列表 SHALL NOT 受影响
- **AND** 后端 ContextManager 的裁剪行为 SHALL NOT 变化

### Requirement: 折叠消息仍保留在 Zustand store 中

折叠的消息 SHALL 完整保留在 `chatStore.conversations[].messages` 数组中。折叠仅影响渲染层（是否创建 MessageItem 组件），不影响数据层。

#### Scenario: 折叠后发送消息仍包含完整历史

- **GIVEN** 对话折叠了前 10 轮，仅渲染最近 5 轮
- **WHEN** 用户发送新消息
- **THEN** `useAgent.send()` SHALL 从 store 读取完整 messages[] 并发送给 LLM
- **AND** 折叠的消息 SHALL 包含在发送给 LLM 的上下文中

### Requirement: FoldDivider 组件文案使用 i18n

FoldDivider 组件的所有用户可见文案 SHALL 通过 i18n 系统获取。

#### Scenario: 中文环境下的折叠分割线

- **GIVEN** 当前 locale 为 zh-CN
- **WHEN** 折叠分割线渲染
- **THEN** 文案 SHALL 显示中文（"以上 N 轮对话未渲染"、"加载最近 N 轮"、"展开全部"）
