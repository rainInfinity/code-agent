# Tasks

## 1. Streaming Raw Text Display

- [x] 1.1 Create `StreamingText` styled component with `white-space: pre-wrap`, monospace font, matching font size and line height with rendered markdown
- [x] 1.2 Update `MessageBody` rendering logic in `MessageList.tsx` to show `StreamingText` for `status === "streaming"` with content, and `MarkdownRenderer` for `status === "complete"`
- [x] 1.3 Add opacity crossfade transition (200ms) when status changes from `streaming` to `complete`

## 2. Intelligent Auto-Scroll

- [x] 2.1 Implement hysteresis-based `autoFollow` logic in `MessageList.tsx` using `onScroll` handler (disengage at 150px from bottom, re-engage at 50px)
- [x] 2.2 Use instant scroll (`el.scrollTop = el.scrollHeight`) during active streaming when `autoFollow` is true â€?no smooth animation to avoid queue buildup
- [x] 2.3 Use `ResizeObserver` on the list container to detect content height changes and trigger stick-to-bottom when `autoFollow` is true
- [x] 2.4 When `autoFollow` is false (user has scrolled up), preserve scroll position even during content changes
- [x] 2.5 When user clicks â†?button, smooth-scroll to bottom and re-enable `autoFollow`
- [x] 2.6 Apply CSS `scroll-behavior: smooth` on the list container only when not actively streaming (for â†?button clicks)

## 3. Window State Persistence

- [x] 3.1 Add `WindowState` struct in `src-tauri/src/lib.rs` with `x`, `y`, `width`, `height`, `maximized` fields
- [x] 3.2 Implement `load_window_state()` to read `window-state.json` from app data directory
- [x] 3.3 Implement `save_window_state()` to write window state with debounce
- [x] 3.4 In `setup`, restore window position/size/maximized from saved state (with bounds validation for off-screen positions)
- [x] 3.5 Register window event listeners for move, resize, and close-requested to persist state
- [x] 3.6 Add required Tauri v2 window permissions in capabilities (`core:window:allow-set-position`, `core:window:allow-set-size`, `core:window:allow-maximize`, etc.)

## 4. Integration and Polish

- [x] 4.1 Ensure `ScrollToBottomButton` show/hide behavior works correctly with new hysteresis logic
- [x] 4.2 Handle edge case: `StreamingText` to `MarkdownRenderer` transition when `autoFollow` is false â€?preserve scroll position
- [x] 4.3 Handle edge case: user sends new message while scrolled up â€?reset `autoFollow` to true and scroll to bottom
- [x] 4.4 Handle edge case: window state file corrupt or unreadable â€?fall back to defaults gracefully

## 5. Verification

- [x] 5.1 Run TypeScript build checks (`npm run build` or `npx tsc --noEmit`)
- [x] 5.2 Run Rust build checks (`cargo build` in `src-tauri`)
- [ ] 5.3 Manually verify: no content-height jitter during streaming
- [ ] 5.4 Manually verify: auto-scroll sticks to bottom during generation
- [ ] 5.5 Manually verify: scrolling up during generation stops auto-follow, shows â†?button
- [ ] 5.6 Manually verify: clicking â†?button returns to bottom and resumes auto-follow
- [ ] 5.7 Manually verify: window position and size are restored on restart
- [ ] 5.8 Manually verify: maximized state is preserved across restart
- [ ] 5.9 Manually verify: off-screen saved positions are handled gracefully
