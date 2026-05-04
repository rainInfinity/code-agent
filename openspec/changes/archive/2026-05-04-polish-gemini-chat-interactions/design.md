# Design

## Current Shape

The app is a React, TypeScript, Vite, Tauri frontend using Zustand for state and styled-components for UI. The relevant pieces are:

- `MessageList` owns the scroll container ref, auto-scroll behavior, and message row rendering.
- `MessageWrapper` currently applies a row hover background.
- `MessageInput` is rendered below the message list in `ChatPanel`.
- `Sidebar` conditionally returns either the full sidebar or the collapsed expand button.
- Sidebar collapsed state is persisted in `settingsStore`.

The key implementation tension is that two desired interactions depend on continuity:

- Sidebar collapse animation needs the sidebar shell to remain mounted while dimensions change.
- Scroll-to-bottom visibility needs message list scroll state to be observable outside the existing auto-scroll effect.

## Interaction Model

The Gemini-like direction should be quiet and utility-focused:

```text
Message row
  avatar
  content column
    role/content
    action row: [copy] [optional more]

No full-row hover fill.
Actions may reveal softly without shifting message content.
```

The composer should visually suggest the next layer of capability without enabling those capabilities yet:

```text
Composer
  text input
  left controls:  [+] [tools/skills]
  right controls: [mode selector] [send/mic]
  mode popover: Fast / Thinking / Pro-like options, UI only
```

The scroll-to-bottom control should behave like a navigation aid, not a permanent toolbar button:

```text
ChatPanel
  MessageList
    messages...
    floating scroll-to-bottom button when not near bottom
  MessageInput
```

## Message Hover and Actions

Remove the `MessageWrapper` hover background so message rows do not show a full-width surface change.

Introduce a message action row inside the message content area. The initial action set should include a copy button using an icon from `react-icons`. Unlike the composer tool controls, message copy is in scope and should write the message content to the clipboard.

Recommended behavior:

- Keep the action row in layout so content does not shift when actions appear.
- Use opacity/visibility for hover and focus reveal if actions are not always visible.
- Ensure keyboard users can discover the copy affordance through focus.
- Use `title` and `aria-label` for icon-only buttons.
- Do not rely on hover as the only way to access the control.
- Provide lightweight success/failure feedback for copy, such as a temporary label, tooltip text, or icon state.
- Prefer `navigator.clipboard.writeText` when available, with a graceful failure path if clipboard access is blocked.
- Copy the plain message content from message state rather than trying to scrape rendered DOM.

Possible visibility choices:

| Option | Behavior | Tradeoff |
| --- | --- | --- |
| Always visible | Copy button always shown below messages | Most discoverable, slightly busier |
| Hover/focus reveal | Actions fade in on hover or focus-within | Closest to Gemini, needs keyboard care |
| Assistant-only visible | Actions shown only for assistant messages | Lower clutter, less consistent |

Preferred starting point: hover/focus reveal for assistant messages, with layout space reserved and keyboard focus supported. If user messages feel incomplete without actions, extend the same action row to both roles.

## Composer Tool and Mode UI

The Gemini reference shows composer controls for adding content, opening tools, selecting a response mode, and voice input. This change should introduce the visual structure for the first three without implementing their deeper behavior.

Recommended composer controls:

- Add button: icon-only control, visually present, no file picker behavior.
- Tools/skills button: icon plus concise label or icon-only with tooltip, no skills discovery or execution.
- Mode selector button: current mode label with chevron, opens a small popover/menu.
- Mode menu: shows UI-only choices such as `Fast`, `Thinking`, and optionally `Pro`, with one selected item.

Behavior boundaries:

- The mode menu may open/close and update local visual selection if that helps the UI feel complete.
- Changing the selected mode must not change backend request parameters, selected model, streaming behavior, or persisted settings.
- The add button must not open a native file picker.
- The tools/skills button must not run tools, browse skills, or mutate settings.
- These controls should be styled as future affordances rather than disabled clutter. If a control is clickable only to show a placeholder menu, the accessible label should not promise unavailable functionality.

The existing `MessageInput` currently has only a textarea and send/stop button. The composer can be reshaped into a Gemini-like two-row surface:

```text
┌──────────────────────────────────────┐
│ Ask...                               │
│ [+] [tools]          [Thinking v] [>] │
└──────────────────────────────────────┘
```

This should preserve the existing send and stop behavior.

## Sidebar Collapse Animation

The current conditional render prevents a true collapse animation:

```text
expanded  -> render SidebarContainer
collapsed -> render ExpandButton
```

Prefer a mounted shell that changes width and content visibility:

```text
LayoutContainer
  SidebarFrame width: 260px -> 0px or rail width
    SidebarContent opacity/transform
  FloatingExpandButton opacity/pointer-events based on collapsed state
```

Implementation considerations:

- Keep the sidebar container mounted in both states.
- Animate `width`, `min-width`, and optionally `opacity` / `transform` for inner content.
- Avoid animating child layout in a way that causes text wrapping during collapse.
- Keep overflow hidden during width animation.
- Keep the floating expand button outside the collapsing content so it remains reachable.
- Respect `prefers-reduced-motion` by reducing transitions.

Two viable collapse shapes:

| Shape | Description | Fit |
| --- | --- | --- |
| Full hide | Sidebar width animates to `0px`; floating expand button appears | Matches current layout intent |
| Narrow rail | Sidebar width animates to an icon rail; menu/new/settings remain icon-only | More Gemini-like, bigger scope |

Preferred starting point: full hide with a smooth shell animation, because it matches the current state model and avoids a larger navigation redesign.

## Scroll-To-Bottom Affordance

`MessageList` already owns `listRef`, so it should also own scroll position detection.

Recommended model:

```text
isNearBottom =
  scrollHeight - scrollTop - clientHeight < threshold

showScrollToBottom = !isNearBottom && messages.length > 0
```

Behavior:

- Listen for scroll events on the message list container.
- Hide the button when the user is near the bottom.
- Show it when the user scrolls upward beyond the threshold.
- Clicking the button scrolls the list to the bottom.
- Keep the button positioned within the chat panel/message list layer, above the composer.
- Ensure it does not cover message text at common desktop and mobile widths.

Although the button is a functional control, it can be implemented as UI wiring within this change because the requested behavior is part of the visual interaction. It should not change message data or backend behavior.

## Accessibility

- Icon-only controls need `aria-label` and `title`.
- The scroll-to-bottom button should be keyboard reachable.
- Message action controls should be reachable without requiring pointer hover.
- UI-only composer controls should have labels that honestly describe their current state, such as "Add file, not available yet" if they are inert.
- Use focus-visible styles for action buttons.
- Respect `prefers-reduced-motion`.
- Preserve readable line lengths and avoid dynamic text overlap.

## Risks

- Clipboard access can fail in insecure contexts or when permissions are blocked; copy feedback needs a failure path.
- UI-only composer controls can feel broken if they look fully functional. Their visual treatment and accessible labels should make the current boundary clear without making the UI feel unfinished.
- Reserving action-row space for every message may add vertical noise. Revealing actions while maintaining stable layout needs careful spacing.
- Sidebar animation can cause main content width changes during collapse; the animation should feel spatial rather than janky.
- Scroll-to-bottom state can conflict with the existing auto-scroll effect if both update at the same time.

## Verification Direction

Manual verification should include:

- Messages no longer show a full-row hover background.
- Copy affordance appears in the expected place, does not shift content, and copies message text.
- Composer add-file, tools/skills, and mode controls are visible but do not trigger real file/tool/model behavior.
- Mode selector surface opens/closes if implemented as an interactive UI shell.
- Sidebar collapse and expand visibly animate.
- Collapsed sidebar expand control remains accessible.
- Scroll-to-bottom button appears when scrolled upward and disappears near the bottom.
- Reduced-motion mode does not produce unnecessary animation.
