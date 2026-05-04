# Improve Chat Scroll and Window State

## Summary

Improve the chat streaming experience by eliminating markdown-rendering jitter during streaming, implementing intelligent auto-scroll-to-bottom, and adding window size/position/maximized-state memory across app restarts.

## Motivation

Several UX issues degrade the chat experience during streaming and across restarts:

- **Markdown rendering jitter**: During streaming, `react-markdown` re-parses incomplete markdown on every token. When a code fence closes, a table row completes, or bold markers resolve, the rendered DOM height can change abruptly — sometimes by 50px or more. This causes the conversation to visibly "jump" as the scroll position races to catch up.
- **Auto-scroll during generation**: The current auto-scroll uses `scrollTo({ behavior: "smooth" })` on every token, creating animation queue conflicts during fast streaming. Users who scroll up to read earlier messages get pulled back to the bottom without clear opt-out.
- **Window state amnesia**: Every app launch resets to the default 1200×800 centered window. Users on larger or multi-monitor setups must resize and reposition every time.

This change makes the streaming experience calm and predictable, and respects the user's window preferences.

## Goals

- Eliminate content-height jitter during streaming by showing raw monospace text, then crossfading to rendered markdown on completion
- Auto-stick to bottom during streaming only when the user has not intentionally scrolled away (with hysteresis: disengage at 150px, re-engage at 50px)
- Use instant scroll during active streaming (avoid animation flood), CSS smooth scroll only for idle-mode navigation
- Persist window position, size, and maximized state; restore on next launch
- When the view is already at the bottom of the latest message, follow new content; when the user has scrolled away, preserve their position

## Non-Goals

- Do not change the backend Rust streaming infrastructure
- Do not add window state persistence for multi-window scenarios (only main window)
- Do not change the markdown rendering library or styling
- Do not introduce scroll position memory across conversation switches (only within the active conversation)

## Scope

Affected areas:

- `MessageList.tsx` — scroll logic, streaming detection, user-scroll tracking
- `MarkdownRenderer.tsx` / `MessageBody` — raw text display during streaming + crossfade transition
- `src-tauri/lib.rs` / `tauri.conf.json` — window state plugin and permissions
- `src-tauri/Cargo.toml` — new dependency for window state persistence

## Open Questions

- Should the raw-text-during-streaming mode use the same font size as rendered markdown, or a distinct monospace style?
- For window state, should we use the `tauri-plugin-window-state` community plugin or implement manual save/restore?
