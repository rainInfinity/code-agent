# Design

## Current Shape

The app uses React, TypeScript, Vite, Tauri, Zustand, and styled-components. UI layout is defined directly inside each component with repeated `display: flex`, `align-items`, `justify-content`, `gap`, and direction rules.

The relevant current issues map to these implementation patterns:

- `SettingsModal` initializes API key input from `settings.apiKey`, but the store intentionally does not persist the key to localStorage.
- The Rust settings command can return `hasApiKey`, but the modal does not currently use that to represent an already configured key.
- `MessageWrapper` receives `$role`, but it does not use role to change row direction or alignment.
- Empty streaming messages render `ThinkingIndicator`; non-empty streaming messages render `MarkdownRenderer`, causing a structural switch in the message body.
- Sidebar delete buttons are `display: none` until hover, then become `display: flex`, which changes their participation in flex layout.

## Flex Layout Primitives

Introduce shared styled-components primitives for common flex layouts. These should be thin, predictable building blocks rather than a new design system.

Recommended primitives:

- `Flex`: base primitive with configurable direction, align, justify, gap, wrap, width, minWidth, flex, and responsive behavior.
- `Row`: `Flex` with horizontal direction.
- `Column`: `Flex` with vertical direction.
- `Center`: centered flex container.
- Optional `Spacer` or `Fill`: a flex-growing element for toolbar/action alignment.

The primitives should:

- Use transient props such as `$direction`, `$align`, `$justify`, `$gap`, `$wrap`, `$responsive`.
- Avoid leaking custom props to the DOM.
- Support the app theme spacing scale for gaps where practical.
- Preserve explicit dimensions for fixed-format UI elements such as icon buttons, avatars, sidebar rows, and message rows.
- Remain simple enough that direct styled-components CSS is still allowed for component-specific styling.

Example conceptual usage:

```tsx
<Row $align="center" $gap="sm">
  ...
</Row>

<Column $gap="md">
  ...
</Column>
```

## Settings API Key State

Treat the API key input as an update field, not a secret display field.

State model:

```text
Backend has key? -- yes --> show configured state, empty input means "keep existing"
        |
        no -----------> show empty input, empty save means "not configured"
```

Expected behavior:

- On modal open, load settings or consume an already hydrated `apiKeyConfigured` value.
- If a key exists, show a visible configured indicator.
- Keep the password input value empty unless the user types a replacement key.
- Saving with an empty API key while `apiKeyConfigured` is true should preserve the existing backend key.
- Saving with a non-empty API key should replace the key and mark it configured.

This avoids exposing the secret while fixing the misleading "empty" perception.

## Message Role Layout

Use role-aware layout:

```text
Assistant:
  [avatar] [content............................]

User:
  [content............................] [avatar]
```

Implementation direction:

- Keep a stable max content width.
- Use `flex-direction: row` for assistant and `row-reverse` for user, or equivalent role-specific ordering.
- Align user text and role label appropriately so the row reads as a user-authored message.
- Keep avatars fixed-size with `flex-shrink: 0`.

## Stable Streaming Rendering

Avoid switching the message body between unrelated component trees during streaming.

Preferred model:

```text
Message row
  Avatar
  Message content shell
    Role label
    Body shell
      Markdown renderer OR empty-state indicator inside same shell
```

The key is that row, content shell, and body shell dimensions/styles stay stable while content changes. Empty streaming can still show animated dots, but it should occupy the same body area where Markdown will appear.

Additional considerations:

- Keep Markdown paragraph margins predictable for single-token and first-paragraph states.
- Avoid changing padding/borders when the status moves from `streaming` to `complete`.
- Preserve auto-scroll behavior.

## Sidebar Hover Stability

Conversation rows should reserve space for the delete action at all times.

Instead of toggling `display`, keep the delete button in layout and toggle:

- `opacity`
- `visibility`
- optionally `pointer-events`

This keeps row height and horizontal spacing stable across hover states.

## Migration Strategy

1. Add flex primitives in a shared common/layout component file.
2. Migrate only the affected components first:
   - Settings modal internal rows/groups where useful.
   - Message list wrappers/content rows.
   - Sidebar conversation item and action rows.
3. Keep component-specific styling local where it expresses visual identity or state.
4. Avoid a wholesale restyle of unrelated components.

## Risks

- Over-abstracting layout props could make simple components harder to read.
- Changing chat row direction may disturb Markdown/code block width if not constrained.
- API key configured state could confuse users if the empty field does not clearly communicate "leave blank to keep existing key."
- Flex primitives need careful transient prop naming to avoid React DOM warnings.
