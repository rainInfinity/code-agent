## ADDED Requirements

### Requirement: Trace window shall auto-follow latest output while running

The Trace window SHALL keep the latest Trace output visible while the agent is running when the user has not intentionally scrolled away, including during turn content growth and window size changes.

#### Scenario: Trace output grows while followed

- **GIVEN** the Trace window is showing a running turn
- **AND** auto-follow is engaged
- **WHEN** prompt, thinking, response, tool, or usage content increases the Trace list height
- **THEN** the Trace list remains scrolled to the bottom
- **AND** the latest Trace content remains visible

#### Scenario: Trace window height changes while followed

- **GIVEN** the Trace window is showing a running turn
- **AND** auto-follow is engaged
- **WHEN** the Trace window is resized, maximized, or restored
- **THEN** the Trace list remains scrolled to the latest Trace content
- **AND** the resize does not disengage auto-follow

#### Scenario: New turn arrives

- **GIVEN** the Trace window is open for an active conversation
- **WHEN** a new agent turn is recorded
- **THEN** the Trace list scrolls to the latest turn
- **AND** auto-follow is engaged for the new turn

#### Scenario: User intentionally scrolls away

- **GIVEN** the Trace window is auto-following a running turn
- **WHEN** the user intentionally scrolls away using wheel, touch, keyboard, or scrollbar dragging
- **THEN** auto-follow pauses unless follow-latest mode is active
- **AND** the user's chosen scroll position is preserved while new Trace content arrives

### Requirement: Trace window shall provide an expand-all toggle

The Trace window SHALL provide a single icon control that toggles between all turns expanded and all turns collapsed.

#### Scenario: Some turns are collapsed

- **GIVEN** the Trace window contains one or more turns
- **AND** at least one turn is collapsed
- **WHEN** the user activates the expand-all toggle
- **THEN** all visible turns are expanded
- **AND** follow-latest mode is disabled

#### Scenario: All turns are expanded

- **GIVEN** the Trace window contains one or more turns
- **AND** all turns are expanded
- **WHEN** the user activates the expand-all toggle
- **THEN** all visible turns are collapsed
- **AND** follow-latest mode is disabled

#### Scenario: No turns exist

- **GIVEN** the Trace window has no turns
- **WHEN** the Trace controls render
- **THEN** the expand-all toggle is disabled
- **AND** activating it does not change Trace state

### Requirement: Trace window shall provide a follow-latest mode toggle

The Trace window SHALL provide a follow-latest mode that only expands the latest turn, collapses previous turns, and keeps the Trace list following the newest output.

#### Scenario: Enable follow-latest mode

- **GIVEN** the Trace window contains one or more turns
- **WHEN** the user activates the follow-latest toggle while it is off
- **THEN** follow-latest mode is enabled
- **AND** only the latest turn is expanded
- **AND** all earlier turns are collapsed
- **AND** the Trace list scrolls to the latest turn

#### Scenario: New turn arrives while follow-latest is enabled

- **GIVEN** follow-latest mode is enabled
- **WHEN** a new agent turn is recorded
- **THEN** only the new latest turn is expanded
- **AND** all previous turns are collapsed
- **AND** the Trace list remains auto-followed to the bottom

#### Scenario: Disable follow-latest mode

- **GIVEN** follow-latest mode is enabled
- **WHEN** the user activates the follow-latest toggle again
- **THEN** follow-latest mode is disabled
- **AND** the current turn expansion state is preserved

#### Scenario: User manually changes a turn expansion

- **GIVEN** follow-latest mode is enabled
- **WHEN** the user manually expands or collapses a turn
- **THEN** follow-latest mode is disabled
- **AND** the user's requested turn expansion state is applied

### Requirement: Trace window shall combine pin and always-on-top behavior

The Trace window SHALL expose one icon control for the combined behavior of staying open across conversation changes and staying above other windows.

#### Scenario: Enable combined pin behavior

- **GIVEN** either keep-open-across-conversations or always-on-top is disabled
- **WHEN** the user activates the combined pin control
- **THEN** keep-open-across-conversations is enabled
- **AND** always-on-top is enabled
- **AND** the control is shown as active

#### Scenario: Disable combined pin behavior

- **GIVEN** keep-open-across-conversations is enabled
- **AND** always-on-top is enabled
- **WHEN** the user activates the combined pin control
- **THEN** keep-open-across-conversations is disabled
- **AND** always-on-top is disabled
- **AND** the control is shown as inactive

### Requirement: Trace window controls shall be accessible and theme-aware

Trace window icon controls SHALL expose accessible names, pressed states where applicable, disabled states where applicable, and visual states compatible with the active theme.

#### Scenario: Render Trace mode controls

- **GIVEN** the Trace window is visible
- **WHEN** the header controls render
- **THEN** the expand-all toggle, follow-latest toggle, combined pin control, clear control, minimize control, maximize/restore control, and close control each expose an accessible label
- **AND** toggled controls expose their active state through visual styling and `aria-pressed`

#### Scenario: Disabled Trace controls

- **GIVEN** a Trace control requires at least one turn
- **AND** the current Trace window has no turns
- **WHEN** the control renders
- **THEN** it is disabled
- **AND** it does not mutate Trace state when activated
