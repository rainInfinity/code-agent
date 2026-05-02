# Polish Gemini Chat Interactions

## Summary

Refine the chat interface toward a calmer Gemini-like interaction model by removing per-message hover background fills, adding a working copy action for messages, introducing Gemini-style composer controls as UI-only affordances, animating sidebar collapse/expand, and adding a scroll-to-bottom control when the user is away from the latest message.

## Motivation

The current chat UI has several interaction details that make it feel more mechanical than conversational:

- Message rows apply a full-width hover background, which makes reading feel noisy and unlike the quieter Gemini reference.
- Messages do not expose a persistent place for common actions such as copy, even though users naturally expect actions near assistant responses.
- The composer does not visually communicate future affordances such as adding files, choosing tools/skills, or switching response mode, which makes the UI feel less aligned with the Gemini-style reference.
- The sidebar collapse path currently swaps the sidebar for a floating expand button, so the intended width transition cannot fully communicate spatial continuity.
- Auto-scroll exists while new content streams, but there is no user-facing affordance to return to the latest message after scrolling upward.

This change should make the chat surface feel calmer, more intentional, and easier to navigate without introducing new backend behavior.

## Goals

- Remove the full-row hover background from chat messages.
- Add a Gemini-like message action area with a working copy button for each message or for assistant messages, depending on the final UI fit.
- Copy the rendered message text/content to the clipboard using a frontend clipboard path.
- Add Gemini-style composer controls for adding files, opening tools/skills, and switching response mode as UI-only affordances.
- Show a mode selector surface similar to the reference, but do not wire mode changes into model/backend behavior.
- Animate sidebar collapse and expand with spatial continuity.
- Preserve an accessible sidebar expand/collapse control in both expanded and collapsed states.
- Add a scroll-to-bottom button that appears when the message list is not near the latest message.
- Keep the scroll-to-bottom control visually anchored above the composer area and out of message content.
- Respect reduced-motion preferences for sidebar and scroll affordance animation.

## Non-Goals

- Do not implement file attachment behavior.
- Do not implement tools/skills execution or discovery from the composer controls.
- Do not implement actual response mode switching, model switching, or backend behavior changes for the mode selector.
- Do not redesign the full application shell or theme.
- Do not change chat streaming, message persistence, or backend IPC behavior.
- Do not replace styled-components or the existing icon library.
- Do not introduce a broad Gemini clone; use the reference only for interaction tone and placement.
- Do not alter the existing conversation data model unless required for UI state.

## Scope

Affected frontend areas:

- Chat message row styling and message action affordances.
- Message copy behavior using browser/frontend clipboard capability.
- Composer action controls for add-file, tools/skills, and mode selection UI.
- Message list scroll state and scroll-to-bottom affordance.
- Sidebar collapsed/expanded rendering and animation.
- Theme-aware styling for icon-only controls and transitions.

The implementation should build on the current React, TypeScript, styled-components, react-icons, and Zustand structure. Any new state should remain local unless it must represent a persisted user preference.

## Open Questions

- Should the copy affordance appear for all messages, or only assistant messages as in many chat products?
- Should message actions be always visible, appear on message hover/focus, or use a hybrid where they become visible after keyboard focus?
- Should the mode selector default labels mirror Gemini terminology such as "Fast" and "Thinking", or use product-specific terms?
- Should the sidebar collapse to a narrow rail before fully hiding, or collapse completely while leaving only a floating expand button?
- Should the scroll-to-bottom button include only an icon, or an icon plus unread/new-message indicator when content arrives while the user is scrolled upward?
