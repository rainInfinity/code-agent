## ADDED Requirements

### Requirement: Chat fold initializes once per conversation

MessageList SHALL compute the default fold point only the first time a given conversation is loaded into the chat view. The default fold point SHALL still use the dual-threshold algorithm: maximum visible turns and token budget, using the stricter result.

#### Scenario: First load of a long conversation

- **GIVEN** a conversation contains 25 turns and exceeds the configured visible-turn limit
- **WHEN** the user opens that conversation in the chat view for the first time in the current view session
- **THEN** only the latest turns within the computed fold boundary SHALL render as `MessageItem`
- **AND** earlier folded messages SHALL NOT be created
- **AND** a `FoldDivider` SHALL appear above the first visible message

#### Scenario: Returning to a previously loaded conversation

- **GIVEN** conversation A has already initialized its fold state
- **AND** the user previously loaded more history or expanded all messages in conversation A
- **WHEN** the user switches to another conversation and later switches back to conversation A
- **THEN** conversation A SHALL restore its remembered `visibleTurnCount`
- **AND** the chat view SHALL NOT recompute a new default fold point for conversation A

### Requirement: Chat fold state is conversation-scoped

The chat view SHALL remember fold state separately for each conversation. A fold action in one conversation SHALL NOT affect another conversation.

#### Scenario: Independent chat fold states

- **GIVEN** conversation A is fully expanded
- **AND** conversation B remains at its default folded state
- **WHEN** the user switches between A and B
- **THEN** conversation A SHALL remain expanded
- **AND** conversation B SHALL remain folded according to its own remembered state

### Requirement: Streaming never re-triggers automatic folding

Once a conversation has initialized its fold state, later streaming updates SHALL NOT automatically reduce the visible range, even if the conversation now crosses the configured turn or token thresholds. Newly appended content SHALL remain visible at the tail.

#### Scenario: Threshold crossed after initial load

- **GIVEN** a conversation was first loaded while still below the fold threshold and therefore displayed fully
- **WHEN** later streaming replies and new turns cause the conversation to exceed the configured threshold
- **THEN** the conversation SHALL remain in its current visible state
- **AND** the chat view SHALL NOT automatically fold history that was previously visible

#### Scenario: Streaming in an already folded conversation

- **GIVEN** a conversation already initialized with folded history
- **WHEN** streaming deltas continue updating the latest assistant message
- **THEN** the existing folded boundary SHALL remain unchanged
- **AND** the latest user/assistant content SHALL remain visible

### Requirement: Folded chat history remains available for manual expansion

The chat view SHALL continue to support progressive expansion for initialized folded conversations.

#### Scenario: Load more and restore later

- **GIVEN** a conversation is folded
- **WHEN** the user clicks `Load recent N turns`
- **THEN** the fold boundary SHALL move earlier by the configured batch size or until all remaining history is visible
- **AND** the remembered fold state for that conversation SHALL update accordingly

#### Scenario: Expand all and restore later

- **GIVEN** a conversation is folded
- **WHEN** the user clicks `Expand all`
- **THEN** all messages SHALL render
- **AND** the conversation's remembered fold state SHALL become fully expanded
