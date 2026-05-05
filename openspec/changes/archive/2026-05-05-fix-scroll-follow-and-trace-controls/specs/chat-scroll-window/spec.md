## MODIFIED Requirements

### Requirement: Auto-scroll shall stick to bottom during generation with hysteresis

The message list SHALL automatically stick to the bottom during streaming when the user has not intentionally scrolled away, including during content-height growth, scroll-container size changes, and the transition from no scrollbar to a scrollable list.

#### Scenario: User is at the bottom during streaming

- **GIVEN** a conversation is receiving streaming tokens
- **AND** the user's scroll position is within 150px of the bottom
- **WHEN** new content is appended to the streaming message
- **THEN** the list scrolls to the bottom instantly (no CSS smooth animation)
- **AND** the scroll-to-bottom button is not visible

#### Scenario: User remains followed while content height grows

- **GIVEN** a conversation is receiving streaming tokens
- **AND** auto-follow is engaged
- **WHEN** the streaming response increases the rendered content height over multiple animation frames
- **THEN** the message list remains pinned to the bottom throughout the height growth
- **AND** the latest generated content remains visible

#### Scenario: Scrollbar appears during streaming

- **GIVEN** the message list content initially fits without a scrollbar
- **AND** auto-follow is engaged
- **WHEN** streaming content grows enough to create vertical overflow
- **THEN** the list scrolls to the bottom as soon as overflow exists
- **AND** auto-follow remains engaged

#### Scenario: Scroll container height changes during streaming

- **GIVEN** a conversation is receiving streaming tokens
- **AND** auto-follow is engaged
- **WHEN** the message list container height changes because the window is resized or layout changes
- **THEN** the list remains scrolled to the latest message
- **AND** the container resize does not disengage auto-follow

#### Scenario: User scrolls up during streaming

- **GIVEN** a conversation is receiving streaming tokens
- **AND** the user's scroll position is at the bottom
- **WHEN** the user intentionally scrolls upward more than 150px from the bottom
- **THEN** auto-scroll disengages
- **AND** the user's current scroll position is preserved despite new content arriving
- **AND** the scroll-to-bottom button becomes visible

#### Scenario: User scrolls back near bottom during streaming

- **GIVEN** auto-scroll is disengaged and the scroll-to-bottom button is visible
- **AND** a conversation is receiving streaming tokens
- **WHEN** the user scrolls within 150px of the bottom
- **THEN** auto-scroll re-engages
- **AND** the scroll-to-bottom button hides

#### Scenario: User clicks scroll-to-bottom button during streaming

- **GIVEN** auto-scroll is disengaged and the scroll-to-bottom button is visible
- **WHEN** the user clicks the scroll-to-bottom button
- **THEN** the list smoothly scrolls to the bottom
- **AND** auto-scroll re-engages
- **AND** the scroll-to-bottom button hides

#### Scenario: User sends a new message while scrolled up

- **GIVEN** the user is scrolled up in the current conversation
- **WHEN** the user sends a new message
- **THEN** the list immediately scrolls to the bottom to show the new user message
- **AND** auto-follow is enabled for the subsequent streaming response

#### Scenario: Assistant placeholder follows user message

- **GIVEN** sending a user message immediately appends an assistant streaming placeholder
- **WHEN** the message list detects the new turn
- **THEN** the list treats the newly sent user message as the trigger for immediate bottom scroll
- **AND** the assistant placeholder does not prevent auto-follow from engaging
