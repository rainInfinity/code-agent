# chat-interactions Specification

## Requirements

### Requirement: Chat message rows shall not show a full-width hover background

The chat message list SHALL keep message rows visually calm by avoiding a full-width background fill when the pointer hovers a message.

#### Scenario: Hover an assistant message

- **GIVEN** an assistant message is visible in the chat list
- **WHEN** the user hovers the message row
- **THEN** the message row does not apply a full-width hover background
- **AND** the message content remains in the same position and width

#### Scenario: Hover a user message

- **GIVEN** a user message is visible in the chat list
- **WHEN** the user hovers the message row
- **THEN** the message row does not apply a full-width hover background
- **AND** the message content remains in the same position and width

### Requirement: Chat messages shall support copying message content

The chat UI SHALL render a copy action near message content and copy the message content to the clipboard when activated.

#### Scenario: Render a message with actions

- **GIVEN** a chat message is rendered
- **WHEN** its message action area is visible or focused
- **THEN** a copy action affordance is present near the message content
- **AND** the affordance uses an icon-style control
- **AND** the control has an accessible label

#### Scenario: Copy message content

- **GIVEN** the copy affordance is visible
- **WHEN** the user activates it
- **THEN** the app writes the message content to the clipboard as plain text
- **AND** the app provides lightweight success feedback
- **AND** no message data is changed
- **AND** no backend call is made

#### Scenario: Clipboard copy fails

- **GIVEN** the copy affordance is visible
- **AND** clipboard access is unavailable or rejected
- **WHEN** the user activates it
- **THEN** the app does not change message data
- **AND** the app provides lightweight failure feedback
- **AND** no backend call is made

#### Scenario: Reveal message actions

- **GIVEN** a message action area is hidden or visually subdued by default
- **WHEN** the message row is hovered or the action area receives keyboard focus
- **THEN** the copy affordance becomes discoverable
- **AND** the message content does not shift vertically or horizontally

### Requirement: Composer shall show Gemini-style add, tools, and mode controls as UI-only affordances

The message composer SHALL visually include controls for adding files, opening tools/skills, and selecting a response mode without implementing the underlying feature behavior.

#### Scenario: Render composer controls

- **GIVEN** the chat composer is visible
- **WHEN** the composer renders
- **THEN** an add-file icon control is visible
- **AND** a tools or skills control is visible
- **AND** a response mode selector control is visible
- **AND** the existing send or stop control remains available according to streaming state

#### Scenario: Activate add-file control

- **GIVEN** the add-file control is visible
- **WHEN** the user activates it
- **THEN** the app does not open a native file picker
- **AND** the app does not attach files
- **AND** no backend call is made

#### Scenario: Activate tools or skills control

- **GIVEN** the tools or skills control is visible
- **WHEN** the user activates it
- **THEN** the app does not execute tools or skills
- **AND** the app does not mutate tool, skill, or settings state
- **AND** no backend call is made

#### Scenario: Open response mode selector

- **GIVEN** the response mode selector is visible
- **WHEN** the user activates it
- **THEN** the app may show a small mode menu or popover
- **AND** the menu visually indicates the current mode
- **AND** selecting a mode does not change backend request parameters, model selection, streaming behavior, or persisted settings

#### Scenario: Composer controls remain accessible

- **GIVEN** the composer controls are visible
- **WHEN** the user navigates with the keyboard
- **THEN** each control can receive focus
- **AND** each control exposes an accessible name that does not promise unavailable behavior

### Requirement: Sidebar collapse and expand shall animate with spatial continuity

The sidebar SHALL animate between expanded and collapsed states instead of instantly swapping the full sidebar for only an expand button.

#### Scenario: Collapse the sidebar

- **GIVEN** the sidebar is expanded
- **WHEN** the user activates the collapse control
- **THEN** the sidebar shell remains mounted during the transition
- **AND** the sidebar width changes smoothly toward the collapsed state
- **AND** the main content adjusts without an abrupt visual jump
- **AND** an expand control remains available after collapse

#### Scenario: Expand the sidebar

- **GIVEN** the sidebar is collapsed
- **WHEN** the user activates the expand control
- **THEN** the sidebar width changes smoothly toward the expanded state
- **AND** the sidebar content becomes visible without text wrapping or flashing during the transition

#### Scenario: Reduced motion is preferred

- **GIVEN** the user prefers reduced motion at the system level
- **WHEN** the sidebar is collapsed or expanded
- **THEN** the app reduces or removes non-essential animation while preserving the state change

### Requirement: Message list shall provide a scroll-to-bottom control when away from the latest message

The chat UI SHALL show a scroll-to-bottom control when the user has scrolled away from the latest message.

#### Scenario: User scrolls upward in a conversation

- **GIVEN** a conversation has enough messages to scroll
- **WHEN** the user scrolls upward beyond the near-bottom threshold
- **THEN** a scroll-to-bottom button appears
- **AND** the button is visually positioned above the message composer area
- **AND** the button does not cover message text in the normal reading column

#### Scenario: User returns near the bottom

- **GIVEN** the scroll-to-bottom button is visible
- **WHEN** the user scrolls back near the latest message
- **THEN** the scroll-to-bottom button is hidden

#### Scenario: Activate scroll-to-bottom

- **GIVEN** the scroll-to-bottom button is visible
- **WHEN** the user activates the button
- **THEN** the message list scrolls to the latest message
- **AND** the button becomes hidden once the list is near the bottom

#### Scenario: Empty conversation

- **GIVEN** the active conversation has no messages
- **WHEN** the chat panel renders
- **THEN** the scroll-to-bottom button is not shown

### Requirement: New chat interaction controls shall be accessible and theme-aware

New icon controls introduced for message actions and scroll navigation SHALL be accessible, keyboard reachable, and visually compatible with dark and light themes.

#### Scenario: Navigate controls with keyboard

- **GIVEN** a message action or scroll-to-bottom control is rendered
- **WHEN** the user navigates with the keyboard
- **THEN** the control can receive focus
- **AND** a visible focus state is shown
- **AND** the control exposes an accessible name

#### Scenario: Render controls in dark and light themes

- **GIVEN** the app is using either dark or light theme
- **WHEN** the new controls are rendered
- **THEN** the icons and control surfaces have sufficient contrast
- **AND** their hover, active, disabled, and focus states remain visually understandable
