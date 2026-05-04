# provider-config Specification

## Requirements

### Requirement: The app shall support multiple built-in LLM providers

The application SHALL ship with built-in provider definitions for Anthropic, DeepSeek, and OpenAI, each with distinct API protocol configuration.

#### Scenario: Provider registry is available

- **GIVEN** the application loads
- **WHEN** the provider registry is queried
- **THEN** three providers are available: `anthropic`, `deepseek`, `openai`
- **AND** each provider has a `defaultEndpoint`, `defaultModel`, `authHeaderName`, and protocol-specific metadata

#### Scenario: Provider definitions are immutable at runtime

- **GIVEN** the application is running
- **WHEN** user code or settings attempt to modify a built-in provider definition
- **THEN** the registry data is unchanged
- **AND** the application continues to use the built-in provider definitions

### Requirement: Each provider shall independently persist its own configuration

Provider settings (API key, endpoint, model) SHALL be stored per-provider and loaded when that provider becomes active.

#### Scenario: Configure Anthropic provider

- **GIVEN** the active provider is Anthropic
- **WHEN** the user saves an API key, endpoint, and model selection
- **THEN** those values are persisted under the `anthropic` provider key
- **AND** other providers' saved settings are unchanged

#### Scenario: Switch to a previously configured provider

- **GIVEN** the user has saved settings for both Anthropic and DeepSeek
- **AND** the active provider is Anthropic
- **WHEN** the user switches to DeepSeek
- **THEN** the DeepSeek saved endpoint, model, and API key status are loaded
- **AND** the DeepSeek API key becomes active for subsequent requests

#### Scenario: Switch to a provider never configured

- **GIVEN** the user has never configured OpenAI
- **WHEN** the user switches the active provider to OpenAI
- **THEN** the OpenAI settings initialize with the OpenAI provider defaults (endpoint, model)
- **AND** the API key field is empty
- **AND** `hasApiKey` for OpenAI is false

#### Scenario: API key is not exposed to the frontend

- **GIVEN** a provider has a saved API key
- **WHEN** the frontend calls `load_settings`
- **THEN** the response includes `hasApiKey: true` for that provider
- **AND** the response does NOT include the raw API key value

### Requirement: The settings UI shall provide a provider selector

The settings modal SHALL include a dropdown for selecting the active LLM provider.

#### Scenario: Provider selector renders

- **GIVEN** the settings modal is open
- **WHEN** the API Configuration section renders
- **THEN** a provider selector dropdown is visible
- **AND** it lists Anthropic, DeepSeek, and OpenAI
- **AND** the currently active provider is selected

#### Scenario: Select a different provider

- **GIVEN** the settings modal is open with Anthropic selected
- **WHEN** the user selects DeepSeek from the provider dropdown
- **THEN** the API key input, endpoint input, and model selector update to reflect DeepSeek's saved or default values
- **AND** the model list is cleared until the user refreshes it
- **AND** existing form values for Anthropic are not lost if the user switches back

### Requirement: Model listing shall be provider-aware

The model listing feature SHALL query the active provider's models endpoint and parse the response according to that provider's format.

#### Scenario: List Anthropic models

- **GIVEN** the active provider is Anthropic
- **AND** a valid API key is configured
- **WHEN** the user clicks refresh models
- **THEN** the backend queries `https://api.anthropic.com/v1/models` (or the configured endpoint)
- **AND** the response is parsed and returned as a list of `ModelInfo` objects

#### Scenario: List OpenAI models

- **GIVEN** the active provider is OpenAI
- **AND** a valid API key is configured
- **WHEN** the user clicks refresh models
- **THEN** the backend queries `https://api.openai.com/v1/models` (or the configured endpoint)
- **AND** the response is parsed and returned as a list of `ModelInfo` objects

#### Scenario: DeepSeek model listing fallback

- **GIVEN** the active provider is DeepSeek
- **WHEN** the user clicks refresh models
- **THEN** the backend either queries DeepSeek's models endpoint OR returns a hardcoded list of known DeepSeek models
- **AND** the result always includes at least `deepseek-chat` and `deepseek-reasoner`

### Requirement: Chat streaming shall work with all built-in providers

The chat streaming path SHALL route requests through the active provider's protocol implementation.

#### Scenario: Stream chat with Anthropic

- **GIVEN** the active provider is Anthropic with a valid API key
- **WHEN** the user sends a message
- **THEN** the backend sends a POST to the Anthropic Messages API endpoint
- **AND** uses the `x-api-key` and `anthropic-version` headers
- **AND** parses Anthropic SSE `content_block_delta` events into stream deltas
- **AND** the frontend receives normalized `stream-delta` events

#### Scenario: Stream chat with DeepSeek

- **GIVEN** the active provider is DeepSeek with a valid API key
- **WHEN** the user sends a message
- **THEN** the backend sends a POST to the DeepSeek chat completions endpoint
- **AND** uses the `Authorization: Bearer <key>` header
- **AND** parses OpenAI-format SSE events into stream deltas
- **AND** the frontend receives normalized `stream-delta` events

#### Scenario: Stream chat with OpenAI

- **GIVEN** the active provider is OpenAI with a valid API key
- **WHEN** the user sends a message
- **THEN** the backend sends a POST to the OpenAI chat completions endpoint
- **AND** uses the `Authorization: Bearer <key>` header
- **AND** parses OpenAI-format SSE events into stream deltas
- **AND** the frontend receives normalized `stream-delta` events

### Requirement: Existing chat features shall be provider-agnostic

The chat UI, message data model, conversation management, and streaming event types SHALL remain unchanged regardless of which provider is active.

#### Scenario: Message display is identical across providers

- **GIVEN** a conversation with messages from multiple providers
- **WHEN** the user views a conversation
- **THEN** message rendering, avatars, status indicators, and actions are identical regardless of which provider generated the response

#### Scenario: Conversation data model is unchanged

- **GIVEN** the app is using any provider
- **WHEN** messages are stored in the conversation state
- **THEN** the `Message`, `Conversation`, and related types have the same shape
- **AND** no provider-specific fields are added to message data
