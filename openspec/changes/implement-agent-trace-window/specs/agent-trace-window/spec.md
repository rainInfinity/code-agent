## ADDED Requirements

### Requirement: Trace window shall open as a separate OS window attached to the main window

The system SHALL support opening a standalone trace window positioned to the right of the main window.

#### Scenario: Open trace window

- **GIVEN** the main window is visible
- **WHEN** the user clicks the "Trace" button in the status bar
- **THEN** a new OS window labeled "Agent Trace" SHALL open
- **AND** the window SHALL be positioned immediately to the right of the main window
- **AND** the window height SHALL match the main window height
- **AND** the window width SHALL be approximately 420px

#### Scenario: Close trace window

- **WHEN** the user closes the trace window (clicking the system close button)
- **THEN** the trace window SHALL close
- **AND** trace data collection SHALL stop
- **AND** the conversation's `traceEnabled` SHALL be set to false

#### Scenario: Main window closes

- **GIVEN** the trace window is open
- **WHEN** the main window is closed
- **THEN** the trace window SHALL also close

### Requirement: Trace window shall follow main window movement

The trace window SHALL track the main window's position and move accordingly.

#### Scenario: Main window moved

- **GIVEN** the trace window is open and visible
- **WHEN** the main window is moved or resized
- **THEN** the trace window SHALL reposition to remain attached to the right edge of the main window

#### Scenario: User manually repositions trace window

- **GIVEN** the trace window is open
- **WHEN** the user manually drags the trace window to a different position
- **THEN** the trace window SHALL stay at the user's chosen position
- **AND** the next main window move/resize SHALL re-attach the trace window to the right edge

### Requirement: Trace data shall be organized by turns

The trace panel SHALL display agent execution organized into numbered turns, each containing Prompt, Thinking, and Response phases.

#### Scenario: New turn starts

- **WHEN** an `agent-turn` event is received
- **THEN** a new turn entry SHALL be created in the trace panel
- **AND** the turn SHALL be assigned an incrementing number starting from 1
- **AND** the turn status SHALL be "running"

#### Scenario: Turn completes

- **WHEN** an `agent-complete` event is received
- **THEN** the current turn SHALL be marked as "complete"
- **AND** no new turns SHALL be created

#### Scenario: Multiple turns

- **GIVEN** the agent performs 3 turns
- **WHEN** all turns complete
- **THEN** 3 turn cards SHALL be visible in the trace panel
- **AND** each card SHALL show its turn number and completion status

### Requirement: Each turn shall display prompt data

Each turn card SHALL contain an expandable section showing the full prompt sent to the LLM.

#### Scenario: Prompt section displays system prompt

- **WHEN** a `trace-prompt` event is received for a turn
- **THEN** the turn card SHALL show a "Prompt" section
- **AND** the system prompt SHALL be displayed in an expandable block
- **AND** the system prompt text SHALL be shown in a monospace format

#### Scenario: Prompt section displays messages

- **WHEN** a `trace-prompt` event is received
- **THEN** the messages array SHALL be displayed as a list
- **AND** each message SHALL show its role label (user/assistant)
- **AND** each message content SHALL be expandable to view full text

#### Scenario: Prompt section collapsed by default

- **GIVEN** a turn has prompt data
- **WHEN** the turn card first renders
- **THEN** the prompt section body SHALL be collapsed
- **AND** the header SHALL show a summary (e.g., "4 messages")

### Requirement: Each turn shall display thinking content

Each turn card SHALL show the model's thinking content when available.

#### Scenario: Thinking content streams in

- **WHEN** `thinking-delta` events are received for a turn
- **THEN** the turn card SHALL show a "Thinking" section
- **AND** the thinking content SHALL update in real-time
- **AND** the section SHALL indicate "streaming" state (e.g., animated indicator)

#### Scenario: Thinking completes

- **WHEN** thinking deltas stop and response content begins
- **THEN** the thinking section SHALL show "complete" state
- **AND** the final thinking content SHALL be preserved

#### Scenario: No thinking content

- **GIVEN** a turn produces no thinking content
- **WHEN** the turn renders
- **THEN** no thinking section SHALL be shown (or it SHALL show "no thinking content")

### Requirement: Each turn shall display response content

Each turn card SHALL show the LLM's text response.

#### Scenario: Response content streams in

- **WHEN** `stream-delta` events are received for a turn
- **THEN** the turn card SHALL show a "Response" section
- **AND** the response text SHALL update in real-time

#### Scenario: Response completes

- **WHEN** the turn completes
- **THEN** the final response text SHALL be preserved in the card

### Requirement: Trace panel shall show agent status

The trace panel header SHALL display the current agent status.

#### Scenario: Agent running

- **GIVEN** the agent status is "running"
- **WHEN** the trace panel renders
- **THEN** a running indicator (e.g., animated dot or spinner) SHALL be shown
- **AND** the current turn number SHALL be displayed (e.g., "Turn 3/30")

#### Scenario: Agent idle

- **GIVEN** the agent has not started (status: idle)
- **WHEN** the trace panel renders
- **THEN** an idle indicator SHALL be shown
- **AND** a message like "等待 Agent 启动..." SHALL be displayed

#### Scenario: Agent complete

- **GIVEN** the agent has completed
- **WHEN** the trace panel renders
- **THEN** a completion indicator SHALL be shown
- **AND** the total turn count and elapsed time SHALL be displayed

### Requirement: Trace state shall be per-conversation

Trace enabled state SHALL be stored per conversation and persisted.

#### Scenario: Trace enabled for a conversation

- **GIVEN** the user opens trace for conversation A
- **WHEN** the user switches to conversation B and back to A
- **THEN** the trace window SHALL re-open automatically for conversation A

#### Scenario: Trace not enabled for a conversation

- **GIVEN** conversation C has never had trace enabled
- **WHEN** the user switches to conversation C
- **THEN** no trace window SHALL open
- **AND** no trace data SHALL be collected

#### Scenario: Trace disabled mid-conversation

- **GIVEN** trace is open for a conversation with accumulated data
- **WHEN** the user closes the trace window
- **THEN** all trace data for that conversation SHALL be discarded
- **AND** re-opening trace SHALL start with empty data

### Requirement: Trace window shall follow main window theme

The trace window SHALL use the same dark/light theme as the main window.

#### Scenario: Theme synchronization on open

- **WHEN** the trace window opens
- **THEN** it SHALL render with the current theme of the main window

#### Scenario: Theme change propagation

- **GIVEN** the trace window is open
- **WHEN** the user changes the theme in the main window
- **THEN** the trace window SHALL update to match within a reasonable time

### Requirement: Trace UI shall use i18n

All user-facing text in the trace window SHALL use the i18n system.

#### Scenario: Chinese locale

- **GIVEN** the application locale is zh-CN
- **WHEN** the trace window renders
- **THEN** all labels, status messages, and section headers SHALL display in Chinese
