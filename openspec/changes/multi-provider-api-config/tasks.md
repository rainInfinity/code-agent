# Tasks

## 1. TypeScript Type System

- [x] 1.1 Define `ProviderId` type (`'anthropic' | 'deepseek' | 'openai'`).
- [x] 1.2 Define `ProviderDefinition` interface with all config fields.
- [x] 1.3 Define `ProviderSettings` interface (`apiKey`, `apiEndpoint`, `model`).
- [x] 1.4 Update `Settings` interface: add `activeProviderId` and `providers: Record<ProviderId, ProviderSettings>`.

## 2. Provider Registry

- [x] 2.1 Create `src/config/providers.ts` with the `ProviderRegistry` map.
- [x] 2.2 Add Anthropic provider definition with correct defaults and protocol hints.
- [x] 2.3 Add DeepSeek provider definition.
- [x] 2.4 Add OpenAI provider definition.
- [x] 2.5 Add helper: `getProvider(id)` -> returns a `ProviderDefinition`.
- [x] 2.6 Add helper: `createDefaultProviderSettings(id)` -> returns `ProviderSettings` initialized from registry defaults.

## 3. Settings Store Refactor

- [x] 3.1 Add `activeProviderId`, `providers` map, and `apiKeyConfigured` per provider to Zustand state.
- [x] 3.2 Add `setActiveProvider(providerId)` -> switches provider, loads saved or default settings.
- [x] 3.3 Add `setProviderSettings(providerId, settings)` -> updates a provider's config.
- [x] 3.4 Add `isConfigured()` -> checks if the active provider has a configured API key.
- [x] 3.5 Update `partialize` to persist the new shape (excluding API keys).
- [x] 3.6 Derive `activeProviderSettings` and `activeProviderDefinition` selectors.

## 4. Settings UI

- [x] 4.1 Add provider selector dropdown to `SettingsModal` with three built-in options.
- [x] 4.2 Wire provider switch to load the selected provider's saved settings or defaults.
- [x] 4.3 Update API key input placeholder and help text to be provider-aware.
- [x] 4.4 Update endpoint input to prefill from provider registry on first config.
- [x] 4.5 Update model selector to fetch models from the active provider's endpoint.
- [x] 4.6 Update save handler to persist per-provider settings via IPC.
- [x] 4.7 Ensure the SettingsModal correctly initializes from the active provider's saved state.

## 5. IPC Layer Updates

- [x] 5.1 Update `saveSettings` payload to include `providerId`.
- [x] 5.2 Update `loadSettings` response to include `activeProviderId` and per-provider settings summary.
- [x] 5.3 Update `listModels` to accept `providerId` and route to the correct provider's models endpoint.
- [x] 5.4 Update `sendMessage` to include `providerId` so the backend routes to the correct provider.

## 6. i18n Updates

- [x] 6.1 Replace hardcoded "Anthropic" references with provider-neutral text where possible.
- [x] 6.2 Add provider-specific help text entries.
- [x] 6.3 Add provider selector label and option labels.
- [x] 6.4 Add provider-specific API key placeholder hints.

## 7. Rust: Provider Trait and Implementations

- [x] 7.1 Define `LlmProvider` trait in `src-tauri/src/providers/mod.rs`.
- [x] 7.2 Implement `AnthropicProvider` struct and trait impl.
- [x] 7.3 Implement `DeepSeekProvider` struct and trait impl.
- [x] 7.4 Implement `OpenAiProvider` struct and trait impl.
- [x] 7.5 Add `provider_from_id(id: &str) -> Result<Box<dyn LlmProvider>, String>` factory function.
- [x] 7.6 Register the `providers` module in `lib.rs` and `main.rs`.

## 8. Rust: Models Update

- [x] 8.1 Keep existing Anthropic API types.
- [x] 8.2 Add OpenAI-compatible API types (`OpenAiChatRequest`, `OpenAiChatResponse`, `OpenAiStreamChunk`).
- [x] 8.3 Add `ProviderSettings` struct for per-provider persisted config.
- [x] 8.4 Update `PersistedSettings` to include `active_provider_id` and `providers` map.
- [x] 8.5 Update IPC payload/response types to carry `providerId`.

## 9. Rust: Commands Refactor

- [x] 9.1 Refactor `AppState` to store `active_provider_id` and `provider_settings: HashMap<String, ProviderSettings>`.
- [x] 9.2 Update `save_settings` to persist per-provider config and set active provider.
- [x] 9.3 Update `load_settings` to return `activeProviderId` and per-provider summaries with `hasApiKey`.
- [x] 9.4 Update `send_message` to instantiate the correct provider from `active_provider_id` and route the request.
- [x] 9.5 Update `list_models` to use the provider's models endpoint and response parser.
- [x] 9.6 Remove old `LlmClient` after confirming provider migration is complete.

## 10. Verification

- [x] 10.1 Run `cargo check` and `tsc --noEmit` to verify no type errors.
- [ ] 10.2 Manually verify switching from Anthropic to DeepSeek loads fresh defaults.
- [ ] 10.3 Manually verify switching back to Anthropic restores previously saved Anthropic config.
- [ ] 10.4 Manually verify each provider's model listing (or hardcoded fallback for DeepSeek).
- [ ] 10.5 Manually verify chat streaming works for each provider with a valid API key.
- [ ] 10.6 Manually verify API keys are not exposed in localStorage or frontend state inspection.
- [ ] 10.7 Manually verify theme and sidebar settings are unaffected.
