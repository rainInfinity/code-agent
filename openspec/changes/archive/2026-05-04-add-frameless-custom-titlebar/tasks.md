# Tasks

## 1. Tauri Window Configuration

- [x] 1.1 Change the main Tauri window to use a frameless configuration by disabling native decorations.
- [x] 1.2 Preserve existing window size, minimum size, centering, and resizable behavior.
- [x] 1.3 Add the minimal Tauri window permissions required for minimize, maximize/restore, close, maximized-state reads, and dragging.

## 2. App Shell Layout

- [x] 2.1 Introduce an app frame that stacks the custom titlebar above the existing application layout.
- [x] 2.2 Adjust the existing layout container so it fills the remaining viewport height instead of using the full viewport height directly.
- [x] 2.3 Verify the sidebar, main area, API configuration banner, chat panel, and status bar still occupy the correct space below the titlebar.

## 3. Custom Titlebar UI

- [x] 3.1 Add a dedicated titlebar component.
- [x] 3.2 Render a sidebar toggle control in the left titlebar area.
- [x] 3.3 Render back and forward controls as placeholder navigation affordances.
- [x] 3.4 Render top-level menu labels for `文件`, `编辑`, `查看`, `窗口`, and `帮助`.
- [x] 3.5 Render placeholder menu item surfaces for each top-level menu without implementing concrete item behavior.
- [x] 3.6 Render right-aligned minimize, maximize/restore, and close controls.
- [x] 3.7 Match the compact dark screenshot direction while remaining compatible with the app theme.

## 4. Internationalized Titlebar Text

- [x] 4.1 Add a scoped localization structure for new titlebar/window chrome strings.
- [x] 4.2 Provide Chinese strings for menu labels, placeholder menu items, tooltips, and accessible labels.
- [x] 4.3 Use localization keys in the titlebar component instead of scattering new user-facing strings directly in JSX.
- [x] 4.4 Keep localization scoped to the new titlebar/window chrome surface without adding a language switcher.

## 5. Titlebar Behavior

- [x] 5.1 Wire the sidebar titlebar control to the existing sidebar collapsed state and toggle action.
- [x] 5.2 Keep back and forward controls disabled or no-op without changing chat, conversation, or route state.
- [x] 5.3 Wire minimize to the current Tauri window.
- [x] 5.4 Wire maximize/restore to the current Tauri window.
- [x] 5.5 Wire close to the current Tauri window.
- [x] 5.6 Track maximized state where needed so the maximize control can present a restore affordance.
- [x] 5.7 Support dragging the window from non-interactive titlebar regions.
- [x] 5.8 Support double-click maximize/restore from appropriate non-interactive titlebar regions.
- [x] 5.9 Prevent buttons and menu triggers from starting window drag.

## 6. Accessibility and Interaction Fit

- [x] 6.1 Add accessible labels for all icon-only titlebar controls.
- [x] 6.2 Ensure disabled placeholder controls communicate unavailable behavior honestly.
- [x] 6.3 Ensure menu placeholder surfaces can be opened and dismissed predictably.
- [x] 6.4 Ensure focus-visible styles are clear in dark and light themes.
- [x] 6.5 Ensure titlebar text and controls do not wrap or shift at narrow supported window widths.

## 7. Verification

- [x] 7.1 Run TypeScript/build checks.
- [x] 7.2 Run or inspect Tauri capability validation if available.
- [ ] 7.3 Manually verify the app launches as a frameless window.
- [ ] 7.4 Manually verify titlebar drag and double-click maximize/restore.
- [ ] 7.5 Manually verify minimize, maximize/restore, and close.
- [ ] 7.6 Manually verify sidebar toggle stays synchronized with any existing sidebar controls.
- [ ] 7.7 Manually verify menu labels open placeholder items and do not trigger real behavior.
- [ ] 7.8 Manually verify back and forward controls do not mutate app state.
- [ ] 7.9 Manually verify the app content remains correctly sized below the titlebar.
- [ ] 7.10 Manually verify new titlebar/window chrome text appears in Chinese.
