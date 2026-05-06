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

The trace panel SHALL display agent execution organized into numbered turns, each containing Prompt, Thinking, Tool, and Response phases when available. Turn status SHALL be driven by per-turn lifecycle updates instead of being tied only to the final session-level `agent-complete` event.

#### Scenario: New turn starts

- **WHEN** an `agent-turn` event is received
- **THEN** a new turn entry SHALL be created in the trace panel
- **AND** the turn SHALL be assigned an incrementing number starting from 1
- **AND** the turn status SHALL be "running"

#### Scenario: Previous turn closes before a later turn is shown

- **GIVEN** Turn 1 is currently marked as "running"
- **WHEN** the system determines Turn 1 has ended and Turn 2 begins
- **THEN** Turn 1 SHALL be marked as "complete" or "error" before Turn 2 is rendered as the active running turn
- **AND** Turn 1 SHALL record an `endTime`
- **AND** the trace panel SHALL NOT leave both Turn 1 and Turn 2 in "running" state

#### Scenario: Final turn closes when the session ends

- **GIVEN** the latest turn is still marked as "running"
- **WHEN** the agent session ends with completion, cancellation, maximum turn limit, or error
- **THEN** the latest turn SHALL be marked with its terminal status
- **AND** no stale running turn SHALL remain in the trace panel

#### Scenario: Multiple turns

- **GIVEN** the agent performs 3 turns
- **WHEN** all turns complete
- **THEN** 3 turn cards SHALL be visible in the trace panel
- **AND** each completed earlier turn SHALL show a terminal status instead of "running"

### Requirement: Each turn shall display prompt data

Each turn card SHALL contain an expandable section showing the full prompt sent to the LLM. Prompt message rendering SHALL preserve structured `contentBlocks` data instead of depending only on top-level plain-text content.

#### Scenario: Prompt section displays system prompt

- **WHEN** a `trace-prompt` event is received for a turn
- **THEN** the turn card SHALL show a "Prompt" section
- **AND** the system prompt SHALL be displayed in an expandable block
- **AND** the system prompt text SHALL be shown in a monospace format

#### Scenario: Prompt section displays structured messages

- **WHEN** a `trace-prompt` event is received
- **THEN** the messages array SHALL be displayed as a list
- **AND** each message SHALL show its role label
- **AND** each message SHALL render readable content derived from `contentBlocks` when `contentBlocks` are present

#### Scenario: Prompt message contains only content blocks

- **GIVEN** a prompt message has empty top-level `content`
- **AND** the same message contains one or more `contentBlocks`
- **WHEN** the Prompt section renders
- **THEN** the UI SHALL show a non-empty row for that message
- **AND** the row SHALL summarize the contained text, thinking, tool_use, or tool_result blocks
- **AND** the Prompt view SHALL NOT render an empty `user` or `assistant` entry

#### Scenario: Prompt section collapsed by default

- **GIVEN** a turn has prompt data
- **WHEN** the turn card first renders
- **THEN** the prompt section body SHALL be collapsed
- **AND** the header SHALL show a summary (e.g., "4 messages")

### Requirement: Each turn shall display tool execution trace

Each turn card SHALL show a dedicated Tool section when the turn contains one or more tool calls. The Tool section SHALL preserve tool parameters, lifecycle status changes, outputs, and errors.

#### Scenario: Single tool call succeeds

- **WHEN** a turn contains one tool call that completes successfully
- **THEN** the Tool section SHALL display the tool name and requested parameters
- **AND** the section SHALL transition through requested/running/completed states
- **AND** the final output SHALL remain viewable after the turn completes

#### Scenario: Tool call fails

- **WHEN** a tool call ends with validation failure, permission denial, timeout, or runtime error
- **THEN** the Tool section SHALL show the tool as failed
- **AND** the failure reason SHALL be viewable in the Trace window
- **AND** the turn SHALL NOT stay indefinitely in a running state because of that failed tool

#### Scenario: Multiple tool calls in one turn

- **GIVEN** a turn contains multiple tool calls
- **WHEN** the Tool section renders
- **THEN** all tool calls SHALL be listed in logical order
- **AND** each call SHALL maintain its own status and result area

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

### Requirement: TurnList supports one-time automatic fold initialization

TracePanel's TurnList SHALL integrate conversation-scoped fold state. For a long trace, automatic folding SHALL happen only during that conversation's first load in the current Trace view session.

#### Scenario: First render of a long trace

- **GIVEN** a conversation trace contains enough historical turns to cross the configured fold threshold
- **WHEN** TracePanel renders that conversation for the first time
- **THEN** only the visible slice after the computed fold point SHALL render as `TurnCard`
- **AND** folded turns SHALL NOT exist in the DOM
- **AND** `FoldDivider` SHALL render above the first visible turn

#### Scenario: Re-render after returning to the same trace conversation

- **GIVEN** TracePanel already initialized fold state for the conversation
- **WHEN** the Trace view later returns to that same conversation
- **THEN** TracePanel SHALL reuse the remembered visible slice
- **AND** it SHALL NOT recalculate a fresh automatic fold from scratch

### Requirement: TurnList preserves visible history during running updates

TracePanel SHALL preserve its current visible history while new running turns and turn updates are appended.

#### Scenario: Running updates cross the threshold after first load

- **GIVEN** TracePanel first rendered a conversation while all existing turns were visible
- **WHEN** later agent activity makes that trace cross the configured threshold
- **THEN** TracePanel SHALL keep the already-visible turns visible
- **AND** it SHALL NOT automatically insert a new folded region

#### Scenario: Running updates inside an already folded trace

- **GIVEN** TracePanel already shows a folded divider
- **WHEN** a new latest turn is created and keeps receiving prompt/thinking/response updates
- **THEN** the folded region SHALL remain stable
- **AND** the newest turn SHALL remain visible
- **AND** Trace auto-follow behavior SHALL continue to work
