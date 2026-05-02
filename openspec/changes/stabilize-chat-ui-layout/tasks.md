# Tasks

## 1. Shared Flex Primitives

- [x] 1.1 Add shared styled-components flex primitives for `Flex`, `Row`, `Column`, and `Center`.
- [x] 1.2 Support common alignment, justification, gap, wrapping, width, flex, and responsive props using transient prop names.
- [x] 1.3 Ensure primitives do not forward custom layout props to DOM elements.
- [x] 1.4 Document intended usage briefly in code comments or component naming, without turning the primitives into a large design framework.

## 2. Settings API Key Configured State

- [x] 2.1 Ensure the frontend loads or receives backend settings state including whether an API key is configured.
- [x] 2.2 Update Settings modal state so a saved key is shown as configured without rendering the plaintext key.
- [x] 2.3 Treat an empty API key field as "keep existing key" when a key is already configured.
- [x] 2.4 Allow entering a new key to replace the existing configured key.
- [x] 2.5 Update helper/status text so the user understands whether a key is configured.

## 3. Chat Message Role Layout

- [x] 3.1 Update message row layout so assistant avatars render on the left.
- [x] 3.2 Update message row layout so user avatars render on the right.
- [x] 3.3 Align user message labels/content so the row reads naturally from the right while preserving readable content width.
- [x] 3.4 Keep avatars fixed-size and prevent message content from causing row overflow.

## 4. Stable Streaming Message Rendering

- [x] 4.1 Refactor streaming message rendering so the message content shell remains stable from empty streaming through completed Markdown.
- [x] 4.2 Keep the thinking indicator inside the same body area used by rendered content.
- [ ] 4.3 Verify Markdown first-token, paragraph, list, and code-block rendering do not cause avoidable visual jumps.
- [x] 4.4 Preserve current auto-scroll behavior while streaming.

## 5. Sidebar Hover Stability

- [x] 5.1 Reserve a stable action slot for each conversation row.
- [x] 5.2 Replace hover `display` toggling for the delete button with opacity/visibility/pointer-event state.
- [ ] 5.3 Confirm conversation row height and spacing remain unchanged between default, hover, active, and active-hover states.

## 6. Focused Migration to Flex Primitives

- [x] 6.1 Migrate affected Settings modal layout rows/groups where shared primitives improve clarity.
- [x] 6.2 Migrate affected Message list row/content layout to shared primitives where practical.
- [x] 6.3 Migrate affected Sidebar action/conversation row layout to shared primitives where practical.
- [x] 6.4 Leave unrelated styled-components alone unless they are directly touched by this change.

## 7. Verification

- [x] 7.1 Run TypeScript/build checks.
- [ ] 7.2 Run the app and manually verify Settings API key configured state.
- [ ] 7.3 Manually verify assistant-left/user-right chat avatar placement.
- [ ] 7.4 Manually verify streaming response layout does not visibly jump when content starts rendering.
- [ ] 7.5 Manually verify sidebar conversation hover does not change row height.
