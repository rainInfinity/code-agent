# trace-fold-control Specification

## ADDED Requirements

### Requirement: Trace fold initializes once per conversation

TracePanel SHALL compute the default fold point only the first time a given conversation is loaded into the Trace view. The default fold point SHALL still use the configured dual-threshold algorithm based on visible turns and token budget.

#### Scenario: First load of a long trace

- **GIVEN** a conversation trace contains 25 turns and exceeds the configured visible-turn limit
- **WHEN** the Trace view loads that conversation for the first time in the current Trace view session
- **THEN** only the latest turns within the computed fold boundary SHALL render as `TurnCard`
- **AND** earlier folded turns SHALL NOT be created
- **AND** a `FoldDivider` SHALL appear above the first visible turn

#### Scenario: Returning to a previously loaded trace conversation

- **GIVEN** conversation A in the Trace view has already initialized its fold state
- **AND** the user previously loaded more turns or expanded all turns for conversation A
- **WHEN** the Trace view switches to another conversation and later returns to conversation A
- **THEN** conversation A SHALL restore its remembered `visibleTurnCount`
- **AND** the Trace view SHALL NOT recompute a new default fold point for conversation A

### Requirement: Trace fold state is conversation-scoped

The Trace view SHALL remember fold state separately for each conversation it monitors.

#### Scenario: Independent trace fold states

- **GIVEN** conversation A trace is fully expanded
- **AND** conversation B trace remains folded
- **WHEN** the Trace view switches between A and B
- **THEN** each conversation SHALL restore its own remembered fold state

### Requirement: Streaming trace updates never re-trigger automatic folding

Once a conversation trace has initialized its fold state, later running/streaming updates SHALL NOT automatically fold additional history, even if the trace newly crosses configured thresholds. The newest turn SHALL remain visible.

#### Scenario: Trace threshold crossed after initial load

- **GIVEN** a trace was first loaded while still below the fold threshold and therefore displayed fully
- **WHEN** later agent turns cause the trace to exceed the configured threshold
- **THEN** the Trace view SHALL keep the current visible state
- **AND** previously visible turns SHALL NOT suddenly move into folded history

#### Scenario: Running agent in an already folded trace

- **GIVEN** a trace already initialized with folded history
- **WHEN** a new running turn appears and continues receiving prompt/thinking/response updates
- **THEN** the existing folded boundary SHALL remain unchanged
- **AND** the newest turn SHALL remain visible

### Requirement: Folded trace history remains available for manual expansion

The Trace view SHALL continue to support progressive expansion for initialized folded conversations.

#### Scenario: Load more trace turns and restore later

- **GIVEN** a trace is folded
- **WHEN** the user clicks `Load recent N turns`
- **THEN** the fold boundary SHALL move earlier by the configured batch size or until all remaining history is visible
- **AND** the remembered fold state for that conversation SHALL update accordingly

#### Scenario: Expand all trace turns and restore later

- **GIVEN** a trace is folded
- **WHEN** the user clicks `Expand all`
- **THEN** all turns SHALL render
- **AND** the conversation's remembered trace fold state SHALL become fully expanded
