# content-block-messages Delta Spec

## ADDED Requirements

### Requirement: ContentBlock projections for main-window rendering shall be distinct from provider transcript representation

`contentBlocks` 在主窗口中 SHALL 只表达可视内容片段或 turn section 内部的显示顺序。系统 SHALL NOT 假定主窗口中的 `contentBlocks` 可直接作为 provider transcript 使用。

#### Scenario: Main-window content blocks omit explicit user tool_result message boundaries

- **GIVEN** 主窗口将某个 tool turn 的过程投影到一条 assistant 回复中
- **WHEN** 该回复的 `contentBlocks` 被用于 UI 渲染
- **THEN** 这些 blocks MAY 只表达主窗口需要的可视顺序
- **AND** 系统 SHALL NOT 据此推断 provider 历史已满足 assistant / user 交替约束

#### Scenario: Provider transcript is generated separately

- **GIVEN** 系统需要向 provider 发送下一轮历史消息
- **WHEN** transcript builder 运行
- **THEN** 它 SHALL 使用 canonical transcript 数据而非直接复用主窗口 `contentBlocks`
- **AND** 即使两者都引用同一 turn，UI projection 与 provider representation 仍 SHALL 视为不同层级的数据产物
