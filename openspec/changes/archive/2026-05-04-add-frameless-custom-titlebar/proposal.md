# Add Frameless Custom Titlebar

## Summary

Replace the native decorated Tauri window frame with an application-rendered titlebar that matches the provided dark desktop reference: a compact toolbar with sidebar, back, forward, top-level menu labels, and Windows-style minimize, maximize/restore, and close controls.

## Motivation

The current app uses the operating system's native titlebar and border. That makes the desktop shell feel separate from the app UI and prevents matching the desired integrated titlebar design.

The requested shell should make the application feel more like a focused desktop tool:

- A frameless window lets the app own the top chrome visually.
- A custom titlebar can place app navigation and menu affordances in the same row as window controls.
- Sidebar visibility can be controlled from the titlebar, matching the screenshot.
- Back and forward affordances can exist now as disabled or placeholder navigation controls, leaving room for future history behavior.
- File, Edit, View, Window, and Help menu labels can be present without implementing their concrete item actions yet.

## Goals

- Configure the main Tauri window as frameless by disabling native decorations.
- Render a custom titlebar at the top of the app shell.
- Match the screenshot direction: dark compact bar, sidebar toggle, back/forward controls, menu labels, and right-aligned window controls.
- Support dragging the window from safe titlebar regions.
- Support double-clicking an appropriate titlebar region to maximize or restore the window.
- Implement minimize, maximize/restore, and close actions for the main window.
- Reflect maximized state in the maximize/restore control where practical.
- Reuse the existing sidebar collapsed state and toggle behavior for the titlebar sidebar button.
- Render File, Edit, View, Window, and Help as top-level menu placeholders, shown first in Chinese as `文件`, `编辑`, `查看`, `窗口`, and `帮助`.
- Provide placeholder menu item surfaces without wiring concrete menu actions.
- Render back and forward controls as placeholder navigation affordances until real navigation history exists.
- Introduce an internationalization-ready UI text path for the new titlebar shell.
- Ship the new titlebar shell text in Chinese first.
- Keep titlebar controls accessible by keyboard and screen reader labels.
- Preserve the existing chat, sidebar, status bar, settings, and theme behavior below the titlebar.

## Non-Goals

- Do not implement concrete File, Edit, View, Window, or Help menu item behavior.
- Do not implement real route, conversation, or webview navigation history for back and forward.
- Do not implement a language switcher UI in this change.
- Do not translate the entire existing application outside the new titlebar/window chrome surface.
- Do not replace the existing app theme system or redesign the full chat experience.
- Do not introduce a native OS menu bar.
- Do not add new backend LLM, settings, or chat behavior.
- Do not implement multi-window behavior.
- Do not implement custom window resizing handles unless Tauri frameless behavior requires it on the target platform.

## Scope

Affected areas:

- `src-tauri/tauri.conf.json` main window configuration.
- `src-tauri/capabilities/default.json` window API permissions.
- React app shell composition in `src/App.tsx` and layout components.
- A new titlebar/window chrome component.
- Theme-aware styled-components for titlebar buttons, menu placeholders, and draggable regions.
- A small localization structure for titlebar/window chrome text, initialized with Chinese strings.
- Existing sidebar state in the settings store.

The implementation should prefer Tauri v2 frontend window APIs from `@tauri-apps/api/window` for window control actions. Rust commands should only be added if a frontend API path is insufficient.

## Open Questions

- Should the placeholder menu popovers show one generic disabled `Item` entry, or should each top-level menu show several disabled placeholder entries?
- Should back and forward controls be disabled until real navigation exists, or visually enabled but no-op with honest accessible labels?
- Should the titlebar always use the dark screenshot style, or adapt to the app's light theme?
- Should the titlebar height be exactly screenshot-like around 42 px, or align to an existing spacing token for easier theme consistency?
- Should the app keep native OS shadow behavior for the frameless window, or explicitly configure shadow behavior if platform differences appear?
- Should future localization be app-wide from the start, or should this change introduce only a scoped titlebar translation module that can be expanded later?
