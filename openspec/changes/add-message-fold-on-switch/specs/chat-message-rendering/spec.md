## ADDED Requirements

### Requirement: MessageList supports one-time automatic fold initialization

MessageList SHALL integrate conversation-scoped fold state. For a long conversation, automatic folding SHALL happen only during that conversation's first load in the current chat view session.

#### Scenario: First render of a long conversation

- **GIVEN** a conversation contains enough history to cross the configured fold threshold
- **WHEN** MessageList renders that conversation for the first time
- **THEN** only the visible slice after the computed fold point SHALL render as `MessageItem`
- **AND** folded messages SHALL NOT exist in the DOM
- **AND** `FoldDivider` SHALL render above the first visible message

#### Scenario: Re-render after returning to the same conversation

- **GIVEN** MessageList already initialized fold state for the conversation
- **WHEN** the user later returns to that same conversation
- **THEN** MessageList SHALL reuse the remembered visible slice
- **AND** it SHALL NOT recalculate a fresh automatic fold from scratch

### Requirement: MessageList preserves visible history during streaming growth

MessageList SHALL preserve its current visible history while new streaming content is appended.

#### Scenario: Streaming crosses the threshold after first load

- **GIVEN** MessageList first rendered a conversation while it was still fully visible
- **WHEN** later streaming replies make that conversation cross the configured threshold
- **THEN** MessageList SHALL keep the already-visible history visible
- **AND** it SHALL NOT automatically insert a new folded region

#### Scenario: Streaming inside an already folded conversation

- **GIVEN** MessageList already shows a folded divider
- **WHEN** streaming deltas update the latest assistant message
- **THEN** the folded region SHALL remain stable
- **AND** the latest message SHALL remain visible
- **AND** existing auto-follow and scroll-to-bottom behavior SHALL continue to work
