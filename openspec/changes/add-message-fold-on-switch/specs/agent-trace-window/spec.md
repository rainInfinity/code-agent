## ADDED Requirements

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
