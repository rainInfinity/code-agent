# Tasks

## 1. Message Row Visual Polish

- [x] 1.1 Remove the full-row hover background from chat message rows.
- [x] 1.2 Add a message action area below message content without changing message text width.
- [x] 1.3 Add a copy icon button affordance to the message action area.
- [x] 1.4 Implement copy behavior for message content using frontend clipboard capability.
- [x] 1.5 Provide lightweight success/failure feedback after copy attempts.
- [x] 1.6 Ensure the action area does not cause content to shift between default, hover, and focus states.
- [x] 1.7 Ensure icon-only action controls have accessible labels and focus-visible styling.

## 2. Composer Gemini-Style Controls

- [x] 2.1 Add a Gemini-like add-file icon control to the composer UI.
- [x] 2.2 Add a tools/skills control to the composer UI.
- [x] 2.3 Add a mode selector control with a chevron to the composer UI.
- [x] 2.4 Add a small mode menu/popover surface matching the reference direction.
- [x] 2.5 Keep add-file, tools/skills, and mode behavior UI-only with no file picker, tool execution, model switching, or backend parameter changes.
- [x] 2.6 Preserve existing send and stop behavior.
- [x] 2.7 Ensure UI-only controls have honest accessible labels and focus-visible styling.

## 3. Sidebar Collapse Animation

- [x] 3.1 Refactor sidebar rendering so the sidebar shell remains mounted during collapsed and expanded states.
- [x] 3.2 Animate sidebar width/min-width and inner content visibility during collapse and expand.
- [x] 3.3 Keep the expand control reachable when the sidebar is collapsed.
- [x] 3.4 Prevent sidebar text/content wrapping or flashing during the collapse animation.
- [x] 3.5 Respect `prefers-reduced-motion` for sidebar transitions.

## 4. Scroll-To-Bottom Control

- [x] 4.1 Track whether the message list scroll container is near the bottom.
- [x] 4.2 Show a floating scroll-to-bottom button when the user is not near the latest message.
- [x] 4.3 Hide the button when the user returns near the bottom or when no messages are present.
- [x] 4.4 Position the button above the composer without covering message content.
- [x] 4.5 Wire the button to scroll the message list to the bottom.
- [x] 4.6 Ensure the control is keyboard accessible and has an accessible label.

## 5. Responsive and Theme Fit

- [x] 5.1 Verify desktop layout against the Gemini reference direction without copying unrelated branding.
- [x] 5.2 Verify narrow viewport behavior for message actions, composer controls, sidebar animation, and scroll-to-bottom placement.
- [x] 5.3 Ensure dark and light themes both have sufficient contrast for icon controls.
- [x] 5.4 Avoid introducing a broad color/theme redesign.

## 6. Verification

- [x] 6.1 Run TypeScript/build checks.
- [ ] 6.2 Manually verify message hover no longer creates a row background.
- [ ] 6.3 Manually verify copy affordance placement, non-shifting behavior, and clipboard copy.
- [ ] 6.4 Manually verify composer add-file, tools/skills, and mode controls are UI-only and do not trigger real feature behavior.
- [ ] 6.5 Manually verify sidebar collapse and expand animation.
- [ ] 6.6 Manually verify scroll-to-bottom button visibility and click behavior.
- [ ] 6.7 Manually verify reduced-motion behavior if possible.
