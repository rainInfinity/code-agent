## 1. Rust backend - Trace window creation parameters

- [x] 1.1 `open_trace_window`: use `WebviewUrl::App("index.html?window=trace".into())` so the frontend can identify the Trace window from URL params
- [x] 1.2 `open_trace_window`: use `.decorations(false)` to remove the native titlebar
- [x] 1.3 `open_trace_window`: remove main-window position/size reads (`main.outer_position()`, `main.outer_size()`), use independent default size 420x600 and `.center()`
- [x] 1.4 `open_trace_window`: keep `.resizable(true)` and `.min_inner_size(320, 400)`
- [x] 1.5 Keep `TRACE_WINDOW_LABEL` as `"trace"` and remove unneeded trace height constants/position calculations

## 2. Rust backend - Window lifecycle commands

- [x] 2.1 Add `hide_trace_window`: call `.hide()` on an existing trace window without destroying it, and return `Ok(())` if it does not exist
- [x] 2.2 Keep `close_trace_window` using `.close()` destroy semantics for main-window shutdown cleanup
- [x] 2.3 `open_trace_window`: when the trace window already exists, call `.show()` and `.set_focus()` instead of rebuilding it
- [x] 2.4 Register `hide_trace_window` in the `lib.rs` invoke handler
- [x] 2.5 Keep the `lib.rs` main-window `CloseRequested` cleanup path calling `.close()`
- [x] 2.6 Remove the unneeded `main` window lookup from `open_trace_window`

## 3. Frontend - Entry routing

- [x] 3.1 `main.tsx`: rewrite `isTraceWindow()` to check `URLSearchParams.get('window') === 'trace'` first, then `getCurrentWebviewWindow().label === 'trace'`
- [x] 3.2 Wrap the `getCurrentWebviewWindow()` fallback in try/catch

## 4. Frontend - TracePanel custom titlebar

- [x] 4.1 `TracePanel.tsx`: add a custom titlebar with drag area, `messages.trace.title`, minimize, maximize/restore, and close controls
- [x] 4.2 Stop mouse-down propagation from titlebar buttons/controls so they do not start dragging
- [x] 4.3 Use `getCurrentWindow().onResized()` and `getCurrentWindow().onMoved()` to sync the maximize/restore icon state

## 5. Frontend - IPC and StatusBar sync

- [x] 5.1 `useIpc.ts`: add `hideTraceWindow()` wrapping `invoke('hide_trace_window')`
- [x] 5.2 `StatusBar.tsx`: use `hideTraceWindow()` instead of `closeTraceWindow()` on the close/hide path
- [x] 5.3 Remove the unused `closeTraceWindow` import from `StatusBar.tsx`

## 6. i18n

- [x] 6.1 `zh-CN.ts`: add Trace control tooltip text under the `trace` namespace
- [x] 6.2 Use i18n text for all custom titlebar button `aria-label` values

## 7. Capabilities

- [x] 7.1 Confirm `src-tauri/capabilities/default.json` gives the trace window `core:window:allow-minimize` and `core:window:allow-toggle-maximize`

## 8. Verification

- [ ] 8.1 Start the app and verify the Trace button opens the Trace window without a blank screen and renders `<TraceApp />`
- [ ] 8.2 Verify the Trace window has no native titlebar and shows the custom titlebar
- [ ] 8.3 Verify the Trace window can be dragged freely, including across displays
- [ ] 8.4 Verify the Trace window can be resized independently
- [ ] 8.5 Verify the Trace window minimize and maximize/restore buttons work
- [ ] 8.6 Verify double-clicking the titlebar toggles maximize/restore
- [ ] 8.7 Verify the Trace button closes by hiding the Trace window
- [ ] 8.8 Verify the Trace window custom close button hides rather than destroys the window
- [ ] 8.9 Verify the main window can still be dragged, minimized, maximized, and closed after opening Trace
- [ ] 8.10 Verify conversation still works after opening Trace
- [ ] 8.11 Verify closing the main window thoroughly destroys the Trace window with `.close()`
