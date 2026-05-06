# style-mixins Specification

## ADDED Requirements

### Requirement: 创建 styles/mixins.ts 文件
项目 SHALL 在 `src/styles/mixins.ts` 中创建共享样式 mixin，使用 styled-components 的 `css` helper 定义可复用的样式片段。

#### Scenario: focusRing mixin 提供焦点环样式
- **WHEN** 组件应用 `focusRing` mixin
- **THEN** 元素获得 2px solid inputBorderFocus 的 outline 和 2px outline-offset

#### Scenario: interactiveBg mixin 提供交互态背景
- **WHEN** 组件应用 `interactiveBg` mixin
- **THEN** hover 状态下背景色为 bgHover，focus-visible 状态下有焦点环

#### Scenario: statusColor mixin 提供状态色
- **WHEN** 组件应用 `statusColor('success')` mixin
- **THEN** 元素颜色为 theme.colors.success
- **WHEN** 参数为 'error'
- **THEN** 元素颜色为 theme.colors.error
- **WHEN** 参数为 'warning'
- **THEN** 元素颜色为 theme.colors.warning

#### Scenario: textEllipsis mixin 提供文本截断
- **WHEN** 组件应用 `textEllipsis` mixin
- **THEN** 元素获得单行文本截断样式（overflow: hidden; text-overflow: ellipsis; white-space: nowrap）

### Requirement: 现有组件使用 mixins 消除重复
MessageList.tsx 中重复出现的 focus-visible outline 样式和 hover background-color 样式 SHALL 替换为 mixins 引用。

#### Scenario: CopyButton 使用交互 mixins
- **WHEN** CopyButton 渲染
- **THEN** 其 focus-visible 和 hover 样式通过 `interactiveBg` mixin 实现
- **AND** 与使用 mixin 前的视觉效果完全一致
