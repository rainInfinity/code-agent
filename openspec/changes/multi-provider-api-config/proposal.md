# Multi-Provider API Configuration

## Summary

Refactor the API configuration layer from a hardcoded Anthropic-only implementation into a provider-abstracted architecture using the Strategy pattern (Rust backend) and Provider Registry pattern (TypeScript frontend). Ship built-in provider presets for Anthropic, DeepSeek, and OpenAI, with each provider independently persisting its own API key, endpoint, and model selection.

## Motivation

The current API configuration is entirely Anthropic-specific:

- **Frontend** hardcodes `https://api.anthropic.com` and `claude-haiku-4-5-20251001` as defaults in `settingsStore.ts`.
- **Backend** `LlmClient` only speaks the Anthropic Messages API protocol (`/v1/messages`, `x-api-key` header, `anthropic-version` header, Anthropic SSE event format).
- **Settings UI** references "sk-ant-...", "Anthropic API Key" throughout i18n, and has no concept of switching providers.
- **Model listing** exclusively calls the Anthropic `/v1/models` endpoint.

Adding support for DeepSeek or OpenAI requires a full rewrite of the API layer. This change introduces a provider abstraction so that switching providers is a configuration choice, not a code change.

## Goals

- Define a `LlmProvider` trait (Strategy) in Rust with concrete implementations for Anthropic, DeepSeek, and OpenAI.
- Define a `ProviderRegistry` in TypeScript with metadata, defaults, and UI hints for each built-in provider.
- Store per-provider settings independently — API key, endpoint, and model are saved separately for each provider.
- When the user switches providers, load that provider's saved configuration, or initialize fresh defaults if never configured.
- Update the settings UI with a provider selector dropdown that drives the rest of the form.
- Keep the existing chat streaming, message data model, and conversation management unchanged.
- Update i18n to be provider-aware where necessary.

## Non-Goals

- Do not implement a "custom provider" or "bring your own endpoint" flow in this change. Only the three built-in providers are in scope.
- Do not implement multi-modal, tool-use, or provider-specific advanced parameters.
- Do not change the conversation data model, streaming event schema, or message persistence.
- Do not alter the existing theme, sidebar, or general layout.
- Do not support simultaneous multi-provider conversations (one active provider at a time).
- Do not migrate existing Anthropic-only settings to the new per-provider format — user re-enters keys once.

## Scope

Affected areas:

- **TypeScript types** — New `ProviderId`, `ProviderDefinition`, `ProviderSettings` types; `Settings` type gains `activeProviderId` and `providers` map.
- **TypeScript config** — New `src/config/providers.ts` with the provider registry.
- **Zustand store** — `settingsStore` refactored to manage per-provider state.
- **Settings UI** — Provider selector dropdown, dynamic form, per-provider model fetching.
- **IPC layer** — Commands and payloads updated to include provider context.
- **i18n** — Provider-neutral base text with provider-specific hints.
- **Rust models** — New provider-related types; OpenAI-compatible API types added alongside existing Anthropic types.
- **Rust LLM** — `LlmProvider` trait + `AnthropicProvider`, `DeepSeekProvider`, `OpenAiProvider` implementations.
- **Rust commands** — `AppState` updated for per-provider settings; commands route through provider trait.
- **Rust main/lib** — Register new module structure.

## Open Questions

- Should the active provider be indicated in the StatusBar or Composer hint text?
- Should we auto-detect the provider from the API key prefix (`sk-ant-` vs `sk-`)?
- When DeepSeek or OpenAI returns models via `/v1/models`, the response format differs slightly from Anthropic's — do we normalize model display names in the frontend or backend?
