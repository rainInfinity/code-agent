## ADDED Requirements

### Requirement: 安装和使用 class-variance-authority
项目 SHALL 添加 `class-variance-authority` 依赖，并为现存的多态组件定义 cva 变体配置。

#### Scenario: 添加 cva 依赖
- **WHEN** 执行 `npm install class-variance-authority`
- **THEN** package.json 中新增该依赖，版本锁定

### Requirement: CopyButton 使用 cva 管理 tone 变体
CopyButton 组件的 tone 变体（idle/success/error）SHALL 使用 `cva` 定义，替代内联的 `${({ $tone }) => ...}` 三元表达式。

#### Scenario: CopyButton 变体样式
- **WHEN** CopyButton 的 tone 属性为 "idle"
- **THEN** 按钮文字颜色为 `textTertiary`
- **WHEN** tone 为 "success"
- **THEN** 按钮文字颜色为 `success`
- **WHEN** tone 为 "error"
- **THEN** 按钮文字颜色为 `error`

### Requirement: MessageBubble 使用 cva 管理 role 变体
消息气泡的 role 变体（user/assistant）SHALL 使用 `cva` 定义对齐和布局差异。

#### Scenario: 用户消息靠右对齐
- **WHEN** MessageWrapper 的 role 为 "user"
- **THEN** flex-direction 为 row-reverse，text-align 为 right

#### Scenario: 助手消息靠左对齐
- **WHEN** MessageWrapper 的 role 为 "assistant"
- **THEN** flex-direction 为 row，text-align 为 left

### Requirement: ScrollToBottomButton 使用 cva 管理可见性变体
ScrollToBottomButton 的 visible 变体 SHALL 使用 `cva` 定义显示/隐藏样式。

#### Scenario: 按钮可见
- **WHEN** $visible 为 true
- **THEN** opacity 为 1，visibility 为 visible，pointer-events 为 auto

#### Scenario: 按钮隐藏
- **WHEN** $visible 为 false
- **THEN** opacity 为 0，visibility 为 hidden，pointer-events 为 none

### Requirement: cva 与 styled-components 配合使用
cva 生成的 className SHALL 通过 styled-components 组件的 `className` 属性接入，基础布局样式仍由 styled-components 管理。

#### Scenario: 基础布局与变体样式分层
- **WHEN** 组件同时使用 styled-components 和 cva
- **THEN** styled 组件定义布局、定位、动画
- **AND** cva 定义颜色、字体大小、间距等变体
