# chat-scroll-window Specification

## Requirements

### Requirement: Streaming messages shall display raw text without markdown rendering jitter

The chat message list SHALL display raw monospace text during streaming and transition to rendered markdown on completion, eliminating content-height jitter caused by incremental markdown parsing.

#### Scenario: Streaming response with incomplete markdown

- **GIVEN** an assistant message has status `streaming`
- **AND** the message content contains incomplete markdown structures (e.g., unclosed code fences, partial tables, unclosed bold markers)
- **WHEN** the message is rendered
- **THEN** the content is displayed as raw monospace text with preserved whitespace
- **AND** the content height changes monotonically and proportionally with text length
- **AND** no structural layout jumps occur when markdown syntax characters are appended

#### Scenario: Streaming response completes

- **GIVEN** an assistant message has status `streaming` with complete markdown content
- **WHEN** the message status changes to `complete`
- **THEN** the display transitions from raw text to rendered markdown
- **AND** the transition includes a brief crossfade animation
- **AND** the message body shell dimensions remain stable during the transition

#### Scenario: Empty streaming response starts

- **GIVEN** an assistant message has status `streaming` and empty content
- **WHEN** the message is rendered
- **THEN** the thinking indicator (animated dots) is displayed
- **AND** the display does not switch between unrelated component trees when the first token arrives

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

### Requirement: Scroll behavior shall use instant scroll during streaming and smooth scroll when idle

The message list SHALL use different scroll strategies for streaming vs idle states to avoid animation conflicts.

#### Scenario: Content changes during active streaming

- **GIVEN** a conversation is receiving streaming tokens
- **AND** auto-follow is engaged
- **WHEN** the list needs to scroll to follow new content
- **THEN** the scroll is instantaneous (`scrollTop = scrollHeight`, no animation)
- **AND** no smooth-scroll animation queue accumulates

#### Scenario: User triggers scroll when not streaming

- **GIVEN** no streaming is in progress
- **WHEN** the user clicks the scroll-to-bottom button
- **THEN** the list scrolls smoothly to the bottom

### Requirement: Window position, size, and maximized state shall persist across restarts

The application SHALL remember the main window's position, size, and maximized state and restore them on subsequent launches.

#### Scenario: First launch with no saved state

- **GIVEN** the application has never been launched before
- **WHEN** the application starts
- **THEN** the window uses the default size (1200×800) and centered position from `tauri.conf.json`

#### Scenario: Relaunch after moving and resizing

- **GIVEN** the user previously moved the window to position (100, 200) and resized it to 1400×900
- **AND** the application was closed normally
- **WHEN** the application starts again
- **THEN** the window appears at position (100, 200) with size 1400×900

#### Scenario: Relaunch after maximizing

- **GIVEN** the user previously maximized the window
- **AND** the application was closed in maximized state
- **WHEN** the application starts again
- **THEN** the window opens in maximized state

#### Scenario: Relaunch after closing in normal state

- **GIVEN** the user previously maximized, then restored, then closed the window
- **WHEN** the application starts again
- **THEN** the window opens with the last non-maximized position and size
- **AND** the window is not maximized

#### Scenario: Saved position is off-screen

- **GIVEN** the saved window position is outside any active display (e.g., external monitor disconnected)
- **WHEN** the application starts
- **THEN** the window falls back to the default centered position
- **AND** the off-screen state does not prevent the window from being visible

#### Scenario: Window state file is corrupted

- **GIVEN** the saved window state file contains invalid data
- **WHEN** the application starts
- **THEN** the window falls back to default size and position
- **AND** no error is shown to the user
- **AND** a valid state file is written on next close

### Requirement: Content transition from raw text to markdown shall not disrupt scroll position

When streaming completes and the display transitions from raw text to rendered markdown, the scroll behavior SHALL respect the user's current auto-follow state.

#### Scenario: Auto-follow engaged during transition

- **GIVEN** a streaming response is completing
- **AND** auto-follow is engaged (user is at the bottom)
- **WHEN** the display transitions from raw text to rendered markdown
- **THEN** the list stays scrolled to the bottom after the markdown renders

#### Scenario: Auto-follow disengaged during transition

- **GIVEN** a streaming response is completing
- **AND** auto-follow is disengaged (user has scrolled up)
- **WHEN** the display transitions from raw text to rendered markdown
- **THEN** the user's current scroll position is preserved
- **AND** the visible content does not jump
