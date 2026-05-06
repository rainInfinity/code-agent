## ADDED Requirements

### Requirement: User scroll input shall interrupt button-initiated auto-follow immediately

当消息列表通过“滚动到最新消息”按钮进入平滑滚动阶段时，用户的后续滚轮、触摸、拖拽或键盘滚动输入 SHALL 立即取得控制权，并终止当前的自动跟随状态。

#### Scenario: User scroll interrupts smooth scroll to latest

- **GIVEN** 消息列表当前未处于底部附近，且“滚动到最新消息”按钮可见
- **WHEN** 用户点击该按钮并在平滑滚动完成前主动向上滚动
- **THEN** 消息列表 SHALL 立即停止把用户重新拉回底部
- **AND** 自动跟随状态 SHALL 切换为关闭
- **AND** 只要用户仍离开底部阈值范围，按钮 SHALL 保持可见

#### Scenario: Streaming updates respect interrupted auto-follow

- **GIVEN** 用户已经在按钮触发的平滑滚动期间主动打断自动跟随
- **AND** assistant 仍在流式生成新内容
- **WHEN** 新的 token、tool 块或布局高度变化到达
- **THEN** 消息列表 SHALL NOT 因这些更新再次自动滚动到底部
- **AND** 直到用户重新回到底部附近或再次点击按钮前，自动跟随 SHALL 保持关闭
