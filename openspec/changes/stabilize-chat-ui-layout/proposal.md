# Stabilize Chat UI Layout

## Summary

Improve the frontend settings and chat experience by stabilizing layout behavior, making saved API key state visible without exposing the secret, correcting chat message avatar alignment, and introducing reusable responsive flex primitives for styled-components.

## Motivation

Several visible UI details currently make the app feel unreliable:

- After an API key is saved, reopening Settings shows the API Key field as empty, even though the backend may still have a configured key.
- Chat messages render both user and assistant avatars on the left; the desired conversation pattern is assistant on the left and user on the right.
- While an assistant response streams, the message content can visually jump when the renderer switches from a thinking indicator to Markdown output.
- Sidebar conversation rows change size or spacing on hover because the delete action enters the flex layout only during hover.
- Common flex layout patterns are repeatedly hand-written across styled-components instead of being expressed through shared responsive primitives.

This change should make the UI feel calmer and more intentional while reducing future layout drift.

## Goals

- Show a clear "API key already configured" state in Settings when the backend reports a saved key, without displaying the actual key.
- Allow users to replace the saved key by entering a new value.
- Align assistant messages with avatar/content on the left and user messages with avatar/content on the right.
- Keep streaming assistant messages in a stable message layout from the first token through completion.
- Prevent sidebar conversation row height/spacing changes on hover.
- Add shared styled-components flex primitives that support common responsive layouts.
- Migrate the affected components to use the shared flex primitives where it improves consistency.

## Non-Goals

- Do not expose or persist the plaintext API key in browser localStorage.
- Do not redesign the full application shell or visual theme.
- Do not replace styled-components.
- Do not perform a broad unrelated CSS cleanup.
- Do not change backend LLM streaming behavior except where needed to reflect existing settings state in the UI.

## Scope

Affected frontend areas:

- Settings modal API configuration state.
- Chat message list/message row layout.
- Streaming message content rendering.
- Sidebar conversation item hover actions.
- Shared styled-components layout primitives.

Backend involvement should be limited to using the existing settings response shape if possible. If the frontend cannot reliably know whether a key exists, use the existing `loadSettings()` / `hasApiKey` command rather than returning the secret.

## Open Questions

- Should the Settings API Key field show a masked placeholder such as `Configured` / `********` or use a separate status label beside the field?
- Should user messages be right-aligned as a full row, or should only the avatar move to the right while message content remains within the same readable column width?
- Should the flex primitives live under `src/components/common/` or `src/components/Layout/`?
