## ADDED Requirements

### Requirement: 内联子组件提取为独立文件
MessageList.tsx 中内联定义的 ThinkingPanel、ToolResultBlock、TurnSection、MessageBodyContent、MessageItem 子组件 SHALL 提取为独立的 `.tsx` 文件，每个文件 SHALL 不超过 400 行。

#### Scenario: ThinkingPanel 提取为独立组件
- **WHEN** 开发者需要修改 ThinkingPanel 组件
- **THEN** 该组件代码在 `Chat/ThinkingPanel.tsx` 文件中，无需浏览 MessageList.tsx

#### Scenario: ToolResultBlock 提取为独立组件
- **WHEN** 开发者需要修改工具结果展示逻辑
- **THEN** 该组件代码在 `Chat/ToolResultBlock.tsx` 文件中，可独立测试

#### Scenario: MessageItem 提取为独立组件
- **WHEN** 开发者需要修改消息项渲染逻辑
- **THEN** 该组件代码在 `Chat/MessageItem.tsx` 文件中，通过 React.memo 包装

#### Scenario: MessageBodyContent 提取为独立组件
- **WHEN** 开发者需要修改消息正文的内容块分发逻辑
- **THEN** 该组件代码在 `Chat/MessageBodyContent.tsx` 文件中

#### Scenario: TurnSection 提取为独立组件
- **WHEN** 开发者需要修改 Turn 的分段渲染逻辑
- **THEN** 该组件代码在 `Chat/TurnSection.tsx` 文件中

#### Scenario: MessageList 导入提取后的子组件
- **WHEN** MessageList 渲染消息列表
- **THEN** 所有子组件从独立文件导入，行为与提取前完全一致

### Requirement: 子组件提取不改变原有行为
提取后的子组件 SHALL 保持与提取前完全一致的功能行为、样式渲染和 API 契约。

#### Scenario: 所有 MessageList 测试在提取后通过
- **WHEN** 运行 `MessageList.test.tsx` 测试套件
- **THEN** 所有测试用例通过，无需修改任何断言逻辑

#### Scenario: 流式渲染行为不变
- **WHEN** Agent 返回 streaming delta 更新
- **THEN** ThinkingPanel 的 streaming 动画、auto-scroll、折叠展开行为与提取前一致
