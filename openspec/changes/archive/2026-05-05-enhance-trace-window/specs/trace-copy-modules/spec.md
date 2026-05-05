# trace-copy-modules Specification

## ADDED Requirements

### Requirement: Prompt Copy Button

PromptView 模块 SHALL 包含一个复制按钮，点击后将系统提示和所有消息内容拼接后的完整文本复制到剪贴板。

#### Scenario: 复制 Prompt 内容

- **GIVEN** Turn 的 prompt 包含系统提示（500 字符）和 3 条消息
- **WHEN** 用户点击 PromptView 的复制按钮
- **THEN** 系统提示 + 所有消息的 `role: content` SHALL 被复制到剪贴板
- **AND** 按钮 SHALL 短暂显示"已复制"成功状态

#### Scenario: 复制失败处理

- **GIVEN** 剪贴板 API 不可用或权限被拒绝
- **WHEN** 用户点击复制按钮
- **THEN** 按钮 SHALL 显示"复制失败"错误状态
- **AND** 1.6 秒后按钮 SHALL 恢复默认状态

### Requirement: Thinking Copy Button

ThinkingView 模块 SHALL 包含一个复制按钮，点击后将完整的 thinking 内容复制到剪贴板。

#### Scenario: 复制 Thinking 内容

- **GIVEN** Turn 的 thinking.content 包含 200 字符的思考内容
- **WHEN** 用户点击 ThinkingView 的复制按钮
- **THEN** thinking.content 完整文本 SHALL 被复制到剪贴板

#### Scenario: 空 Thinking 时隐藏复制按钮

- **GIVEN** Turn 的 thinking.status 为 'idle' 且 content 为空
- **WHEN** ThinkingView 渲染
- **THEN** 复制按钮 SHALL NOT 显示

### Requirement: Response Copy Button

ResponseView 模块 SHALL 包含一个复制按钮，点击后将完整的响应内容复制到剪贴板。

#### Scenario: 复制 Response 内容

- **GIVEN** Turn 的 response.content 包含 500 字符的响应内容
- **WHEN** 用户点击 ResponseView 的复制按钮
- **THEN** response.content 完整文本 SHALL 被复制到剪贴板

#### Scenario: 空 Response 时隐藏复制按钮

- **GIVEN** Turn 的 response.content 为空
- **WHEN** ResponseView 渲染
- **THEN** ResponseView SHALL NOT 渲染（保持现有行为），复制按钮也不显示

### Requirement: Copy Button Visual Feedback

所有复制按钮 SHALL 复用 MessageList 中已有的三态反馈模式：idle（默认图标）、success（绿色勾）、error（红色叉），1.6 秒后自动恢复。

#### Scenario: 复制成功状态自动恢复

- **GIVEN** 用户成功复制了 Prompt 内容
- **WHEN** 1.6 秒过去
- **THEN** 按钮 SHALL 从"已复制"恢复为默认"复制"状态
