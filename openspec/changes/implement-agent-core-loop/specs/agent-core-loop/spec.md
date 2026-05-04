# agent-core-loop Specification

## ADDED Requirements

### Requirement: Agent shall execute multi-turn Think-Act-Observe loop

AgentRuntime SHALL drive conversation through a continuous Think→Act→Observe loop: send prompt to LLM (Think), execute any returned tool calls (Act), feed tool results back into context (Observe), then repeat until the LLM returns a text-only response or a stop condition is met.

#### Scenario: Text-only response ends the loop

- **GIVEN** an active AgentSession with user message "hello"
- **WHEN** the LLM returns a response containing only text content blocks (no tool_use)
- **THEN** the text is emitted to the frontend via `stream-delta` events
- **AND** the AgentLoop exits with status `Complete`
- **AND** an `agent-complete` event is emitted

#### Scenario: Tool use triggers continuation loop

- **GIVEN** an active AgentSession with user message "read file Cargo.toml"
- **WHEN** the LLM returns a response containing a tool_use block (e.g., read_file)
- **THEN** the tool_use is emitted to the frontend via `tool-call` event
- **AND** the tool is executed by ToolExecutor
- **AND** the tool result is appended to session context as a tool_result content block
- **AND** the AgentLoop continues to the next Think phase with updated context

#### Scenario: Multiple sequential tool calls in one turn

- **GIVEN** the LLM returns a response with 3 tool_use blocks (e.g., read_file, grep, glob)
- **WHEN** the AgentLoop processes the response
- **THEN** all 3 tools are executed sequentially
- **AND** each tool's result is added to the session context
- **AND** the loop continues to the next Think phase after all tool results are collected

### Requirement: AgentLoop shall enforce max turns limit

AgentLoop SHALL terminate after a configurable maximum number of Think→Act→Observe iterations to prevent infinite loops consuming API quota.

#### Scenario: Loop reaches max turns

- **GIVEN** AgentConfig.max_turns is set to 30
- **WHEN** the AgentLoop completes its 30th iteration and the LLM still returns tool_use
- **THEN** the loop terminates with status `MaxTurnsReached`
- **AND** an `agent-complete` event is emitted with the termination reason
- **AND** a message is appended informing the user that the turn limit was reached

#### Scenario: Loop completes before max turns

- **GIVEN** AgentConfig.max_turns is set to 30
- **WHEN** the LLM returns a text-only response on the 5th iteration
- **THEN** the loop terminates normally with status `Complete`
- **AND** no max-turns message is displayed

### Requirement: CancellationToken shall stop AgentLoop on demand

AgentLoop SHALL accept a CancellationToken and check for cancellation at the start of each iteration and after each tool execution, terminating promptly when cancellation is requested.

#### Scenario: User stops agent during LLM streaming

- **GIVEN** an AgentLoop is in the Think phase waiting for LLM stream
- **WHEN** the user triggers `stop_agent`
- **THEN** the CancellationToken is set to cancelled
- **AND** the LLM stream is aborted
- **AND** the AgentLoop terminates with status `Cancelled`
- **AND** any partial text already streamed remains in the chat

#### Scenario: User stops agent during tool execution

- **GIVEN** an AgentLoop is in the Act phase executing a long-running tool
- **WHEN** the user triggers `stop_agent`
- **THEN** the CancellationToken is set to cancelled
- **AND** the running tool is interrupted if possible
- **AND** the AgentLoop terminates with status `Cancelled`

#### Scenario: Cancellation check between turns

- **GIVEN** an AgentLoop has just completed tool execution and is about to start a new Think phase
- **WHEN** the CancellationToken has been set to cancelled
- **THEN** the loop exits before making the next LLM API call

### Requirement: AgentSession shall track conversation state

AgentSession SHALL maintain the conversation message history, turn count, session ID, and running status throughout the AgentLoop lifecycle.

#### Scenario: Session accumulates message history

- **GIVEN** a new AgentSession with one user message
- **WHEN** the AgentLoop completes 2 turns involving tool calls
- **THEN** the session message list contains the user message, all LLM responses, and all tool results in chronological order

#### Scenario: Session reports correct status

- **GIVEN** a newly created AgentSession
- **WHEN** queried for status
- **THEN** the status is `Idle`
- **AND** after `run_agent` is called, status transitions to `Running`
- **AND** after loop completes, status transitions to `Complete`, `Cancelled`, or `MaxTurnsReached`
