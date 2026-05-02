# Design

## Current Shape

The app uses React, TypeScript, Vite, Tauri v2, styled-components, react-icons, and Zustand.

The main Tauri window is currently configured with native decorations enabled:

```text
src-tauri/tauri.conf.json
  app.windows[0].decorations = true
```

The frontend app shell currently starts directly with the product layout:

```text
App
  ThemeProvider
    GlobalStyle
    LayoutContainer
      Sidebar
      MainArea
        ApiConfigBanner?
        ContentArea
          ChatPanel
        StatusBar
```

Sidebar visibility is already represented in `useSettingsStore` via `sidebarCollapsed` and `toggleSidebar`. That state should be reused by the custom titlebar instead of introducing a second source of truth.

## Target Shell

Introduce an application shell where the titlebar is part of the React layout and the current sidebar/main content sits below it.

```text
App
  ThemeProvider
    GlobalStyle
    AppFrame
      CustomTitleBar
      LayoutContainer
        Sidebar
        MainArea
          ApiConfigBanner?
          ContentArea
            ChatPanel
          StatusBar
```

Conceptual visual structure:

```text
+--------------------------------------------------------------------------------+
| [sidebar]  [back] [forward]   文件  编辑  查看  窗口  帮助          -  []  x |
+--------------------------------------------------------------------------------+
| Sidebar                         Main content                                    |
|                                ...                                             |
+--------------------------------------------------------------------------------+
```

## Tauri Window Configuration

Set the main window to frameless by disabling decorations:

```text
decorations: false
```

Keep existing size, minimum size, centering, and resizable behavior. Resizability should remain enabled so users do not lose normal desktop window ergonomics.

The implementation should not add Rust commands for minimize, maximize, or close unless frontend APIs prove insufficient. Tauri v2 exposes these operations through `@tauri-apps/api/window`.

## Window API Permissions

The capability file must allow only the window operations required by this titlebar. Expected permissions include:

- `core:window:allow-minimize`
- `core:window:allow-toggle-maximize`
- `core:window:allow-close`
- `core:window:allow-is-maximized`
- `core:window:allow-start-dragging`

If double-click maximize is implemented through the same `toggleMaximize()` path, no separate Rust command is needed.

## Titlebar Component

Add a focused component for desktop chrome, for example:

```text
src/components/Layout/TitleBar.tsx
```

Responsibilities:

- Render the top row controls.
- Call existing sidebar toggle state.
- Call Tauri window APIs for minimize, maximize/restore, close, and drag.
- Track maximized state where needed to display the correct restore/maximize icon.
- Render menu placeholders.
- Keep interactive elements marked as non-draggable.

The titlebar should not own chat or app content state.

## Drag Regions and Interactive Regions

The custom titlebar needs both draggable and non-draggable areas.

```text
Titlebar
  draggable background/fill areas
  non-draggable buttons and menu controls
```

Implementation direction:

- Use Tauri's `startDragging()` from a safe pointer/mouse down handler on empty titlebar regions, or use the platform-supported drag region pattern if it works reliably in this stack.
- Ensure buttons, menu triggers, and popover content do not start dragging.
- Double-click on empty titlebar regions should call `toggleMaximize()`.
- Button clicks should not bubble into drag or double-click behavior.

## Menu Placeholders

Top-level labels:

- `文件`
- `编辑`
- `查看`
- `窗口`
- `帮助`

Each top-level menu should expose a placeholder surface when activated. The menu contents are deliberately non-functional in this change.

Recommended placeholder model:

```text
文件
  Item
编辑
  Item
查看
  Item
窗口
  Item
帮助
  Item
```

The placeholder items should be visibly disabled or otherwise honest that they are not implemented yet. Activating a placeholder item should not mutate state or call backend APIs.

## Internationalization

The new titlebar/window chrome text should be internationalization-ready from the start, with Chinese as the first implemented language.

The implementation does not need a full app-wide i18n framework if that would be disproportionate for this change. A small scoped translation module is enough, for example:

```text
src/i18n/zh-CN.ts
src/i18n/index.ts
```

or a colocated titlebar text map if the project prefers narrower scope:

```text
src/components/Layout/titleBarMessages.ts
```

The important design constraint is that user-facing strings introduced by this change should not be scattered as hardcoded literals throughout JSX. They should be gathered behind stable keys so later English or additional locales can be added without redesigning the component.

Initial Chinese strings should cover:

- Menu labels: `文件`, `编辑`, `查看`, `窗口`, `帮助`.
- Placeholder menu item labels.
- Tooltip and accessible labels for sidebar, back, forward, minimize, maximize, restore, and close.
- Disabled/unavailable labels for back and forward.

This change should not add a language switcher, persisted locale setting, or translate unrelated existing chat/settings UI. The default locale for the new shell text is Chinese.

## Back and Forward Controls

The screenshot includes back and forward controls, but the app does not currently have a route or navigation history concept for this titlebar.

Preferred behavior for this change:

- Render both controls in the titlebar.
- Keep them disabled by default.
- Provide accessible labels such as "Back unavailable" and "Forward unavailable".
- Do not mutate conversation or chat state.

This preserves the target layout without creating fake navigation semantics.

## Sidebar Toggle

The titlebar sidebar button should use the existing settings store:

```text
useSettingsStore((s) => s.sidebarCollapsed)
useSettingsStore((s) => s.toggleSidebar)
```

The existing in-sidebar collapse/expand controls may remain unless the final UI feels redundant. If both remain, they must stay synchronized because they share the same store state.

## Window Controls

The right side should render icon-only controls:

- Minimize
- Maximize or restore
- Close

Expected behavior:

- Minimize calls `getCurrentWindow().minimize()`.
- Maximize/restore calls `getCurrentWindow().toggleMaximize()`.
- Close calls `getCurrentWindow().close()`.
- The maximize control may use `isMaximized()` and window resize/move events to update its visual state.
- Close should be visually distinct on hover, matching common Windows behavior.

## Layout and Sizing

The root layout should reserve titlebar height explicitly:

```text
AppFrame: height 100vh, width 100vw, flex-direction column
TitleBar: fixed height
LayoutContainer: flex 1, min-height 0
```

`LayoutContainer` currently uses `height: 100vh`. Once nested below the titlebar, it should use `flex: 1` and `min-height: 0` so the app does not exceed the viewport.

The titlebar should be dense and stable:

- Fixed height around 40-44 px.
- Fixed-size icon buttons.
- No layout shifts on hover, menu open, maximize state, or sidebar collapsed state.
- Text labels should not wrap.

## Theming

The screenshot is dark, but the app supports dark and light themes. There are two viable directions:

1. Always dark titlebar to match the desktop reference.
2. Theme-aware titlebar that uses dark theme tokens in dark mode and light-compatible tokens in light mode.

Recommended first implementation: theme-aware, with dark mode closely matching the screenshot. This avoids an awkward always-dark strip in light mode while preserving the requested look for the default dark theme.

## Accessibility

Controls should be keyboard reachable and expose clear accessible labels:

- Sidebar toggle: localized labels equivalent to "Show sidebar" or "Hide sidebar".
- Back/forward: localized unavailable labels while disabled.
- Menu triggers: localized top-level menu names.
- Window controls: localized labels equivalent to "Minimize window", "Maximize window", "Restore window", "Close window".

Menu placeholder surfaces should use normal button/menu affordances where practical and close predictably on outside click or Escape.

## Risks

- Frameless windows can behave differently across Windows, macOS, and Linux, especially drag, resize, shadow, and rounded-corner behavior.
- Incorrect drag region handling can make titlebar buttons hard to click.
- Missing Tauri permissions can make window controls fail at runtime even if TypeScript compiles.
- Double-click maximize can conflict with menu interactions if event targets are not separated.
- Setting `LayoutContainer` height incorrectly can create clipped content or vertical overflow under the titlebar.
- A custom close button should use `close()` rather than `destroy()` so future close interception still works.
- Introducing a scoped i18n path now could diverge from a future app-wide i18n framework if naming and file placement are not kept simple.
