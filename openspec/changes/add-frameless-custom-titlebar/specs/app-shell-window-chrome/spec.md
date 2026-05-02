# app-shell-window-chrome Specification

## ADDED Requirements

### Requirement: The desktop app shall use a frameless main window

The Tauri main window SHALL disable native window decorations so the application can render its own titlebar and desktop chrome.

#### Scenario: Launch the app

- **GIVEN** the desktop app is launched
- **WHEN** the main window appears
- **THEN** the operating system native titlebar is not shown
- **AND** the application-rendered titlebar is visible at the top of the window
- **AND** the window remains resizable
- **AND** the existing minimum window size remains enforced

### Requirement: The app shall render a custom titlebar matching the requested shell layout

The app SHALL render a compact custom titlebar with sidebar, navigation, menu, and window controls in the same top row.

#### Scenario: Render the titlebar

- **GIVEN** the app shell is visible
- **WHEN** the titlebar renders
- **THEN** a sidebar toggle control is visible on the left
- **AND** back and forward controls are visible after the sidebar control
- **AND** top-level menu labels for `文件`, `编辑`, `查看`, `窗口`, and `帮助` are visible
- **AND** minimize, maximize or restore, and close controls are visible on the right
- **AND** the controls remain on a single stable row without wrapping

#### Scenario: Render app content below the titlebar

- **GIVEN** the custom titlebar is visible
- **WHEN** the rest of the app shell renders
- **THEN** the existing sidebar and main content are laid out below the titlebar
- **AND** the content does not extend underneath the titlebar
- **AND** the app does not create viewport overflow solely because of the titlebar

### Requirement: The custom titlebar shall support native window movement and maximize behavior

The titlebar SHALL provide expected desktop window movement behavior from non-interactive titlebar regions.

#### Scenario: Drag the titlebar

- **GIVEN** the app is running in a frameless window
- **WHEN** the user drags a non-interactive region of the titlebar
- **THEN** the operating system window moves
- **AND** no app content state is changed

#### Scenario: Double-click the titlebar

- **GIVEN** the app is running in a frameless window
- **WHEN** the user double-clicks an appropriate non-interactive region of the titlebar
- **THEN** the window toggles between maximized and restored states
- **AND** no menu is opened
- **AND** no sidebar or navigation state is changed

#### Scenario: Interact with titlebar controls

- **GIVEN** a titlebar button or menu trigger is visible
- **WHEN** the user clicks the control
- **THEN** the click activates that control's intended behavior
- **AND** the click does not start a window drag

### Requirement: The titlebar shall control the main window

The custom titlebar SHALL provide working minimize, maximize/restore, and close controls for the current main window.

#### Scenario: Minimize the window

- **GIVEN** the custom titlebar is visible
- **WHEN** the user activates the minimize control
- **THEN** the current main window is minimized

#### Scenario: Maximize the window

- **GIVEN** the current main window is not maximized
- **WHEN** the user activates the maximize control
- **THEN** the current main window is maximized
- **AND** the titlebar can present a restore affordance where practical

#### Scenario: Restore the window

- **GIVEN** the current main window is maximized
- **WHEN** the user activates the restore control
- **THEN** the current main window is restored
- **AND** the titlebar can present a maximize affordance where practical

#### Scenario: Close the window

- **GIVEN** the custom titlebar is visible
- **WHEN** the user activates the close control
- **THEN** the current main window receives a normal close request

### Requirement: The titlebar sidebar control shall reuse existing sidebar state

The titlebar sidebar control SHALL use the same sidebar collapsed state as the existing sidebar UI.

#### Scenario: Collapse the sidebar from the titlebar

- **GIVEN** the sidebar is expanded
- **WHEN** the user activates the titlebar sidebar control
- **THEN** the sidebar becomes collapsed
- **AND** any existing sidebar collapse or expand controls reflect the same state

#### Scenario: Expand the sidebar from the titlebar

- **GIVEN** the sidebar is collapsed
- **WHEN** the user activates the titlebar sidebar control
- **THEN** the sidebar becomes expanded
- **AND** any existing sidebar collapse or expand controls reflect the same state

### Requirement: The titlebar shall show placeholder menus without implementing item behavior

The titlebar SHALL expose top-level menu labels and placeholder menu items while avoiding concrete File, Edit, View, Window, or Help actions.

#### Scenario: Open a placeholder menu

- **GIVEN** the titlebar menu labels are visible
- **WHEN** the user activates `文件`, `编辑`, `查看`, `窗口`, or `帮助`
- **THEN** a menu-like placeholder surface is shown for that label
- **AND** at least one placeholder item is visible
- **AND** no backend call is made
- **AND** no chat, settings, or conversation state is changed

#### Scenario: Activate a placeholder menu item

- **GIVEN** a placeholder menu item is visible
- **WHEN** the user attempts to activate it
- **THEN** no concrete menu behavior is executed
- **AND** no app data is changed

### Requirement: The titlebar shall show placeholder back and forward controls

The titlebar SHALL render back and forward controls without implementing real navigation history in this change.

#### Scenario: Render navigation placeholders

- **GIVEN** the titlebar is visible
- **WHEN** the back and forward controls render
- **THEN** they are visually present in the same position as the requested reference
- **AND** they communicate unavailable or placeholder behavior

#### Scenario: Activate navigation placeholders

- **GIVEN** a back or forward placeholder control is visible
- **WHEN** the user attempts to activate it
- **THEN** no route, conversation, chat, or settings state is changed
- **AND** no backend call is made

### Requirement: New titlebar text shall be internationalization-ready with Chinese implemented first

The new titlebar and window chrome UI text SHALL be organized through a localization-ready path and SHALL initially render Chinese strings.

#### Scenario: Render Chinese titlebar labels

- **GIVEN** the custom titlebar is visible
- **WHEN** the titlebar renders in the default locale
- **THEN** the menu labels appear as `文件`, `编辑`, `查看`, `窗口`, and `帮助`
- **AND** placeholder menu item labels use Chinese text
- **AND** titlebar tooltip or accessible-label text introduced by this change uses Chinese text

#### Scenario: Add future locales

- **GIVEN** titlebar text is implemented
- **WHEN** a future locale is added
- **THEN** new titlebar/window chrome strings can be added through localization keys or a localized message map
- **AND** the titlebar component does not require hunting through scattered hardcoded user-facing strings

#### Scenario: Scope localization work

- **GIVEN** the titlebar internationalization path exists
- **WHEN** this change is implemented
- **THEN** the app does not add a language switcher
- **AND** unrelated existing chat, settings, and status bar UI text is not required to be translated by this change

### Requirement: Titlebar controls shall be accessible and theme-aware

The custom titlebar controls SHALL be keyboard reachable where interactive, expose accessible names, and remain visually clear in supported themes.

#### Scenario: Navigate titlebar controls with keyboard

- **GIVEN** the custom titlebar is visible
- **WHEN** the user navigates through interactive controls with the keyboard
- **THEN** each interactive control can receive focus
- **AND** each focused control shows a visible focus state
- **AND** each icon-only control exposes an accessible name

#### Scenario: Render titlebar in dark and light themes

- **GIVEN** the app is using either dark or light theme
- **WHEN** the titlebar renders
- **THEN** text, icons, hover states, active states, disabled states, and focus states remain visually understandable
- **AND** the default dark theme closely follows the provided screenshot direction
