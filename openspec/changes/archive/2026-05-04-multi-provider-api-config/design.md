# Design

## Current Shape

```
┌─────────────── Frontend ───────────────┐
│ Settings = { apiKey, apiEndpoint,      │
│              model, theme, ... }       │
│                                        │
│ Defaults hardcoded to Anthropic:       │
│   endpoint: api.anthropic.com          │
│   model:    claude-haiku-4-5-20251001 │
└──────────────────┬─────────────────────┘
                   │ invoke('send_message')
                   ▼
┌─────────────── Backend ────────────────┐
│ LlmClient                              │
│   POST /v1/messages  (Anthropic only)  │
│   x-api-key header                     │
│   anthropic-version header             │
│   Anthropic SSE parsing                │
│                                        │
│ list_models → GET /v1/models           │
│   Anthropic ModelsResponse format      │
└────────────────────────────────────────┘
```

Everything is a single-provider hardwired path. There is no `providerId`, no routing, and no format negotiation.

## Target Architecture

```
┌─────────────────── Frontend ───────────────────┐
│                                                 │
│  ProviderRegistry                               │
│  ┌───────────────────────────────────────────┐  │
│  │ anthropic: { defaultEndpoint,             │  │
│  │   defaultModel, authHeader, apiKeyPrefix, │  │
│  │   modelsEndpoint, chatEndpoint, ... }     │  │
│  │ deepseek:  { ... }                        │  │
│  │ openai:    { ... }                        │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  Settings = {                                   │
│    activeProviderId: 'anthropic',               │
│    providers: {                                 │
│      anthropic: { apiKey, endpoint, model },    │
│      deepseek:  { apiKey, endpoint, model },    │
│      openai:    { apiKey, endpoint, model },    │
│    },                                           │
│    theme, sidebarCollapsed                      │
│  }                                              │
│                                                 │
│  SettingsModal:                                 │
│    [Provider Selector ▼]  ← switches active     │
│    [API Key input     ]  ← per-provider         │
│    [Endpoint (prefilled)]  ← from registry      │
│    [Model selector    ]  ← per-provider fetch   │
└──────────────────────┬──────────────────────────┘
                       │ invoke('send_message', {..., providerId})
                       ▼
┌─────────────────── Backend ────────────────────┐
│                                                 │
│  trait LlmProvider {                            │
│    fn chat_path() -> &str;                     │
│    fn models_path() -> &str;                   │
│    fn auth_header(key) -> (String, String);    │
│    fn extra_headers() -> Vec<(String,String)>; │
│    fn build_chat_request(model, msgs) -> Value;│
│    fn parse_stream_event(data) -> Option<Delta>;│
│    fn parse_models_response(body) -> Vec<Model>;│
│  }                                              │
│                                                 │
│  ┌──────────────┐  ┌──────────────┐            │
│  │ Anthropic    │  │ DeepSeek     │  ...       │
│  │ Provider     │  │ Provider     │            │
│  │              │  │              │            │
│  │ /v1/messages │  │ /v1/chat/    │            │
│  │ x-api-key    │  │ completions  │            │
│  │ anthropic-   │  │ Bearer token │            │
│  │ version      │  │              │            │
│  └──────────────┘  └──────────────┘            │
│                                                 │
│  AppState {                                     │
│    active_provider_id: String,                  │
│    provider_settings: Map<ProviderId, Settings> │
│  }                                              │
└─────────────────────────────────────────────────┘
```

## Provider Data Model

### Frontend: ProviderDefinition

Each built-in provider declares its identity, protocol details, and UI hints:

```typescript
interface ProviderDefinition {
  id: ProviderId;                  // 'anthropic' | 'deepseek' | 'openai'
  name: string;                    // display name
  defaultEndpoint: string;         // base URL
  defaultModel: string;
  chatPath: string;                // e.g. '/v1/messages' or '/v1/chat/completions'
  modelsPath: string;              // e.g. '/v1/models'
  authHeaderName: string;          // 'x-api-key' or 'Authorization'
  authHeaderValuePrefix: string;   // '' or 'Bearer '
  apiKeyPrefix: string;            // for placeholder hint: 'sk-ant-' or 'sk-'
  apiKeyHelp: string;              // i18n key for help text
  extraHeaders?: Record<string, string>;  // e.g. { 'anthropic-version': '2023-06-01' }
}
```

### Frontend: ProviderSettings (persisted per provider)

```typescript
interface ProviderSettings {
  apiKey: string;
  apiEndpoint: string;
  model: string;
}
```

### Rust: LlmProvider trait

```rust
pub trait LlmProvider: Send + Sync {
    /// Path for chat completions, e.g. "/v1/messages"
    fn chat_path(&self) -> &str;
    /// Path for listing models, e.g. "/v1/models"
    fn models_path(&self) -> &str;
    /// Auth header (name, value) — e.g. ("x-api-key", "sk-ant-...")
    fn auth_header(&self, api_key: &str) -> (String, String);
    /// Extra static headers — e.g. ("anthropic-version", "2023-06-01")
    fn extra_headers(&self) -> Vec<(String, String)>;
    /// Build the JSON request body for a chat request
    fn build_chat_request(&self, model: &str, messages: &[ChatMessage]) -> serde_json::Value;
    /// Parse a single SSE "data: {...}" line, return delta text if any
    fn parse_stream_data(&self, data: &str) -> Option<String>;
    /// Parse the response from the models list endpoint
    fn parse_models_response(&self, body: &str) -> Result<Vec<ModelInfo>, String>;
}
```

Concrete implementations: `AnthropicProvider`, `DeepSeekProvider`, `OpenAiProvider`.

Since DeepSeek and OpenAI share the same API format (OpenAI chat completions), they can be thin wrappers around a shared `OpenAiCompatClient` with different default endpoints and model lists. Or each can be a standalone struct implementing the trait — the latter is simpler for two providers and avoids premature abstraction.

## Per-Provider Configuration Isolation

The key design decision: **each provider saves its own configuration independently**.

### Data flow on provider switch

```
User selects "DeepSeek" in SettingsModal
  → frontend checks providers.deepseek in Settings
  → if exists: load apiEndpoint, model from saved; apiKey stays in Rust
  → if not exists: create defaults from ProviderRegistry (deepseek.defaultEndpoint, deepseek.defaultModel)
  → SettingsModal form updates to show deepseek's values
  → on save: save_settings({ providerId: 'deepseek', apiKey, apiEndpoint, model })
  → Rust persists to settings.json:
      {
        "activeProviderId": "deepseek",
        "providers": {
          "anthropic": { "apiKey": "sk-ant-...", ... },
          "deepseek":  { "apiKey": "sk-...", ... }
        }
      }
```

### Security: API key storage

API keys are **never** persisted to localStorage. They are:
- Stored in the Rust backend's `AppState` (in-memory)
- Persisted to disk via `settings.json` in the Tauri app config directory
- The frontend never receives the API key from `load_settings` — only `hasApiKey: boolean`

Each provider's key is stored separately in the `providers` map.

## Settings UI Changes

```
┌─────────────────────────────────────────┐
│  Settings                           [X] │
├─────────────────────────────────────────┤
│  API 配置                               │
│                                         │
│  提供商                                 │
│  ┌─────────────────────────────────────┐│
│  │ Anthropic ▼                         ││
│  └─────────────────────────────────────┘│
│                                         │
│  API Key                                │
│  ┌─────────────────────────────────────┐│
│  │ sk-ant-...                          ││
│  └─────────────────────────────────────┘│
│  → 你的 Anthropic API Key...            │
│                                         │
│  API 端点                                │
│  ┌─────────────────────────────────────┐│
│  │ https://api.anthropic.com           ││
│  └─────────────────────────────────────┘│
│                                         │
│  模型                        [🔄 Refresh]│
│  ┌─────────────────────────────────────┐│
│  │ claude-haiku-4-5-20251001 ▼         ││
│  └─────────────────────────────────────┘│
│  → 3 个模型可用。                        │
│                                         │
├─────────────────────────────────────────┤
│  外观                                   │
│  [Dark] [Light]                         │
├─────────────────────────────────────────┤
│                          [取消] [保存]   │
└─────────────────────────────────────────┘
```

When the user changes the provider dropdown:
1. The current form values are held in local state (not yet saved to store)
2. The form loads the selected provider's saved settings (or defaults)
3. Helper text and placeholder update to match the provider
4. Model list is cleared — user clicks Refresh to fetch models for the new provider

## Backend Module Structure

```
src-tauri/src/
├── main.rs
├── lib.rs              # registers commands, initializes AppState
├── commands.rs         # Tauri commands, updated for provider-aware state
├── models.rs           # API types: adds OpenAI-compatible types + provider types
├── llm.rs              # OLD: remove or refactor
├── tools.rs            # tool definitions (unchanged)
└── providers/
    ├── mod.rs          # LlmProvider trait + provider_from_id() factory
    ├── anthropic.rs    # AnthropicProvider
    ├── deepseek.rs     # DeepSeekProvider
    └── openai.rs       # OpenAiProvider
```

## Streaming Event Normalization

The frontend receives the same stream events (`stream-delta`, `stream-end`, `stream-error`) regardless of provider. The backend normalizes provider-specific SSE formats into the existing `StreamDeltaEvent` / `StreamEndEvent` / `StreamErrorEvent` types:

```
Anthropic SSE:
  data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}
    → parse_stream_data() → Some("Hello")

DeepSeek/OpenAI SSE:
  data: {"choices":[{"delta":{"content":"Hello"}}]}
    → parse_stream_data() → Some("Hello")

Any SSE error:
    → emitted as stream-error event
```

## Risks

- **API key migration**: Existing users have their Anthropic key saved in the old flat format. On first launch after this change, the old settings won't map to the new per-provider structure. Users will need to re-enter their API key once. This is acceptable for a pre-release app (v0.1.0) with no production users.
- **Model list response differences**: Anthropic returns `{ data: [{ id, display_name, created_at, type }] }`. OpenAI returns `{ data: [{ id, created, owned_by }] }`. DeepSeek may not support model listing at all. The trait's `parse_models_response` method handles this per-provider.
- **DeepSeek model list**: DeepSeek's API may not expose a `/v1/models` endpoint. For DeepSeek, we may hardcode the known model list (`deepseek-chat`, `deepseek-reasoner`) and skip the network request.
- **OpenAI model list pagination**: OpenAI's `/v1/models` can be paginated. Initial implementation fetches the first page only; future iterations can add pagination.
