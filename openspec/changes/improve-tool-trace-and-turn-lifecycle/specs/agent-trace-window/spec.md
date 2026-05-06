## MODIFIED Requirements

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

## ADDED Requirements

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

