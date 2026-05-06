## ADDED Requirements

### Requirement: Thinking panel shall auto-scroll while thinking content streams

The Thinking Panel body SHALL scroll to its bottom automatically as thinking content deltas arrive during the thinking phase.

#### Scenario: Thinking content streams in

- **WHEN** a new thinking delta is appended while the panel is expanded and the message is in the thinking phase
- **THEN** the thinking body scrolls to its bottom
- **AND** the scroll does not affect the outer message list scroll position

#### Scenario: User manually scrolls thinking body

- **GIVEN** thinking content is streaming
- **WHEN** the user scrolls the thinking body away from the bottom
- **THEN** subsequent delta arrivals still scroll the thinking body to its bottom

#### Scenario: Thinking body does not overflow

- **GIVEN** thinking content fits within the `max-height` of the thinking body
- **WHEN** new deltas arrive
- **THEN** no scroll adjustment occurs

### Requirement: Thinking panel shall display elapsed time while thinking

The Thinking Panel SHALL display a duration counter showing elapsed time since the first thinking delta arrived.

#### Scenario: Duration increments during thinking

- **GIVEN** the first thinking delta has been received
- **WHEN** the thinking phase is ongoing
- **THEN** the panel header shows a steadily incrementing duration counter

#### Scenario: Duration stops at completion

- **WHEN** the message transitions from thinking phase to response phase
- **THEN** the duration counter freezes at the final elapsed time

#### Scenario: Duration format

- **WHEN** elapsed time is less than 1 second
- **THEN** the counter displays in milliseconds (e.g., `340ms`)
- **WHEN** elapsed time is between 1 and 60 seconds
- **THEN** the counter displays in seconds with one decimal (e.g., `2.3s`)
- **WHEN** elapsed time exceeds 60 seconds
- **THEN** the counter displays in minutes and seconds (e.g., `1m23s`)

### Requirement: Thinking panel shall show estimated token count

The Thinking Panel SHALL display a rough token estimate based on character count.

#### Scenario: Token estimate updates as content grows

- **GIVEN** thinking content has at least 1 character
- **WHEN** the panel header renders
- **THEN** a token estimate is displayed with a `~` prefix (e.g., `~340 tokens`)
- **AND** the estimate is computed as `Math.round(characterCount * 0.25)`

#### Scenario: No token estimate when thinking content is empty

- **GIVEN** thinking content is empty
- **WHEN** the panel renders
- **THEN** no token estimate is displayed

### Requirement: Thinking panel border shall animate while thinking is in progress

The Thinking Panel border SHALL have a subtle animated gradient effect while the thinking phase is active.

#### Scenario: Animated border during thinking phase

- **GIVEN** the message is in the thinking phase (streaming, no response content yet)
- **WHEN** the panel renders
- **THEN** the panel border has a flowing gradient or shimmer animation

#### Scenario: Static border after thinking completes

- **WHEN** the message transitions to the response phase or completes
- **THEN** the animated border effect is removed
- **AND** the panel reverts to a static border

#### Scenario: Reduced motion is preferred

- **GIVEN** the user prefers reduced motion
- **WHEN** the thinking panel is active
- **THEN** the animated border effect is disabled and a static border is shown instead

### Requirement: Thinking body shall show a blinking cursor at content end during streaming

The Thinking Panel body SHALL render a blinking cursor at the end of the thinking content while the thinking phase is active.

#### Scenario: Cursor visible during thinking

- **GIVEN** the message status is streaming
- **AND** the message has no response content yet
- **WHEN** thinking content is displayed
- **THEN** a blinking cursor element is rendered after the last character of thinking content

#### Scenario: Cursor hidden when response begins

- **WHEN** the message's response content becomes non-empty
- **THEN** the blinking cursor is no longer rendered

#### Scenario: Cursor hidden when message completes

- **GIVEN** the message status is complete
- **WHEN** the thinking panel is expanded
- **THEN** the blinking cursor is not shown

### Requirement: Thinking panel shall auto-collapse when response content generation begins

The Thinking Panel SHALL automatically collapse its body when the model starts generating the response text.

#### Scenario: Auto-collapse on response start

- **GIVEN** the thinking panel is expanded during the thinking phase
- **WHEN** the message's response content transitions from empty to non-empty
- **THEN** the thinking panel body collapses automatically

#### Scenario: Manual expand after auto-collapse

- **GIVEN** the thinking panel was auto-collapsed after the response began
- **WHEN** the user clicks the summary to expand the panel
- **THEN** the panel expands and stays expanded
- **AND** further content changes do not cause another auto-collapse

#### Scenario: Panel stays expanded if response content was present from start

- **GIVEN** a completed message from history has both thinking content and response content
- **WHEN** the message renders
- **THEN** the thinking panel renders collapsed by default

### Requirement: Thinking panel summary shall reflect thinking vs completed state

The Thinking Panel summary SHALL display distinct labels and indicators for the active thinking phase versus the completed state.

#### Scenario: Active thinking state

- **GIVEN** the message is in the thinking phase
- **WHEN** the panel summary renders
- **THEN** an animated pulse dot is shown
- **AND** the label displays thinking-in-progress text (e.g., "正在思考...")

#### Scenario: Completed thinking state

- **GIVEN** the thinking phase has ended
- **WHEN** the panel summary renders
- **THEN** a check icon replaces the pulse dot
- **AND** the label displays completion text (e.g., "思考完成")

### Requirement: Enhanced initial loading state before thinking content arrives

When the assistant message is streaming but no thinking content has arrived yet, the system SHALL display a refined loading indicator with a subtle shimmer bar instead of the previous three-dot pulse.

#### Scenario: Waiting for first thinking delta

- **GIVEN** an assistant message has status streaming
- **AND** no thinking content has been received
- **AND** no response content has been received
- **WHEN** the message renders
- **THEN** a loading indicator with a shimmer/flowing gradient bar is displayed
- **AND** a "正在思考..." label is shown

#### Scenario: First thinking delta arrives

- **GIVEN** the enhanced loading indicator is visible
- **WHEN** the first thinking delta is received
- **THEN** the loading indicator transitions to the Thinking Panel

### Requirement: All thinking panel UI text shall use i18n

All user-facing text in the thinking panel SHALL be defined in the i18n locale file.

#### Scenario: Labels use i18n keys

- **WHEN** the thinking panel renders any user-facing text
- **THEN** the text is sourced from the `messages` i18n module
- **AND** no hardcoded Chinese or English strings appear in JSX outside the i18n definitions

### Requirement: Thinking panel lifecycle in the main window shall be turn-scoped

主窗口中的 Thinking Panel SHALL 以所属 turn section 的生命周期为准确定义其 streaming / complete 状态、duration 计时、光标显示和自动折叠行为，而不是共享整条 assistant message 的状态。

#### Scenario: Only the active turn shows a blinking cursor

- **GIVEN** 一条 assistant 回复中包含多个 thinking panels
- **AND** 只有最后一个 turn 正在 streaming
- **WHEN** 主窗口渲染这些 panels
- **THEN** 只有当前 active turn 的 panel SHALL 显示 blinking cursor
- **AND** 先前 completed turn 的 panel SHALL NOT 显示 cursor

#### Scenario: Completed turn duration remains frozen while later turn continues

- **GIVEN** 第一个 turn 的 thinking 已完成，第二个 turn 仍在 streaming
- **WHEN** 主窗口持续更新 thinking duration
- **THEN** 第一个 panel 的 duration SHALL 保持冻结
- **AND** 第二个 panel 的 duration SHALL 继续递增

#### Scenario: Auto-collapse is based on the same turn's response start

- **GIVEN** 某个 turn 的 thinking panel 处于展开状态
- **WHEN** 同一个 turn 的 response 开始生成
- **THEN** 该 panel SHALL 根据本 turn 的 response start 自动折叠
- **AND** 其他 turn 的 response 变化 SHALL NOT 触发它的状态切换
