mod agent;
mod commands;
mod llm;
mod models;
mod prompt;
mod providers;
mod tools;

use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicI64, AtomicU64, Ordering},
        Arc,
    },
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use commands::AppState;
use serde::{Deserialize, Serialize};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewWindow, WindowEvent,
};

const WINDOW_STATE_FILE: &str = "window-state.json";
const WINDOW_STATE_DEBOUNCE_MS: u64 = 500;
const TRACE_WINDOW_LABEL: &str = "trace";
const TRACE_DOCKING_DEFAULT_WIDTH: f64 = 600.0;
const TRACE_DOCKING_MIN_WIDTH: f64 = 580.0;
const TRACE_DOCKING_MAX_WIDTH: f64 = 800.0;
const TRACE_DOCKING_RESIZE_SYNC_MS: u64 = 160;
const DOCKING_DRAG_EXIT_THRESHOLD_MS: i64 = 150;
const MAIN_TITLE_BAR_HEIGHT: i32 = 42;

static LAST_TRACE_DOCKING_APPLY_MS: AtomicI64 = AtomicI64::new(0);

type WindowStates = HashMap<String, WindowState>;

#[derive(Debug, Clone, Deserialize, Serialize)]
struct WindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    maximized: bool,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TraceDockingSide {
    Left,
    Right,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct TraceDockingState {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    side: Option<TraceDockingSide>,
    #[serde(default = "default_trace_docking_width")]
    attached_width: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    previous_always_on_top: Option<bool>,
    #[serde(default)]
    always_on_top: bool,
    #[serde(default)]
    hidden_with_main: bool,
}

impl Default for TraceDockingState {
    fn default() -> Self {
        Self {
            side: None,
            attached_width: default_trace_docking_width(),
            previous_always_on_top: None,
            always_on_top: false,
            hidden_with_main: false,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TraceDockingSnapshot {
    pub side: Option<TraceDockingSide>,
    pub attached_width: f64,
    pub is_docked: bool,
    pub always_on_top: bool,
    pub always_on_top_forced: bool,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PersistedWindowState {
    #[serde(default)]
    windows: WindowStates,
    #[serde(default)]
    trace_docking: TraceDockingState,
}

fn default_trace_docking_width() -> f64 {
    TRACE_DOCKING_DEFAULT_WIDTH
}

fn window_state_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|dir| dir.join(WINDOW_STATE_FILE))
}

fn load_persisted_window_state(app: &AppHandle) -> Option<PersistedWindowState> {
    let path = window_state_path(app)?;
    let contents = fs::read_to_string(path).ok()?;
    if let Ok(mut state) = serde_json::from_str::<PersistedWindowState>(&contents) {
        state.trace_docking.attached_width =
            clamp_trace_docking_width(state.trace_docking.attached_width, None);
        return Some(state);
    }
    // Try new HashMap format first
    if let Ok(states) = serde_json::from_str::<WindowStates>(&contents) {
        return Some(PersistedWindowState {
            windows: states,
            trace_docking: TraceDockingState::default(),
        });
    }
    // Fall back to legacy single-object format, auto-migrate on next save
    if let Ok(state) = serde_json::from_str::<WindowState>(&contents) {
        let mut states = HashMap::new();
        states.insert("main".to_string(), state);
        return Some(PersistedWindowState {
            windows: states,
            trace_docking: TraceDockingState::default(),
        });
    }
    None
}

fn load_window_state(app: &AppHandle) -> Option<WindowStates> {
    load_persisted_window_state(app).map(|state| state.windows)
}

fn capture_window_state(window: &WebviewWindow) -> Option<WindowState> {
    let position = window.outer_position().ok()?;
    let size = window.outer_size().ok()?;
    let maximized = window.is_maximized().unwrap_or(false);

    Some(WindowState {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        maximized,
    })
}

fn save_window_state_for_label(app: &AppHandle, window: &WebviewWindow, label: &str) {
    let Some(state) = capture_window_state(window) else {
        return;
    };
    let Some(path) = window_state_path(app) else {
        return;
    };
    let Some(parent) = path.parent() else {
        return;
    };

    if fs::create_dir_all(parent).is_err() {
        return;
    }

    let mut persisted = load_persisted_window_state(app).unwrap_or_default();
    persisted.windows.insert(label.to_string(), state);

    if let Ok(contents) = serde_json::to_string_pretty(&persisted) {
        let _ = fs::write(path, contents);
    }
}

fn schedule_window_state_save(
    app: AppHandle,
    window: WebviewWindow,
    label: String,
    generation: Arc<AtomicU64>,
) {
    let current_generation = generation.fetch_add(1, Ordering::Relaxed) + 1;

    thread::spawn(move || {
        thread::sleep(Duration::from_millis(WINDOW_STATE_DEBOUNCE_MS));
        if generation.load(Ordering::Relaxed) == current_generation {
            save_window_state_for_label(&app, &window, &label);
        }
    });
}

fn is_position_on_screen(window: &WebviewWindow, state: &WindowState) -> bool {
    let Ok(monitors) = window.available_monitors() else {
        return true;
    };

    monitors.iter().any(|monitor| {
        let position = monitor.position();
        let size = monitor.size();
        let right = position.x + size.width as i32;
        let bottom = position.y + size.height as i32;

        state.x >= position.x && state.x < right && state.y >= position.y && state.y < bottom
    })
}

fn restore_window_state(window: &WebviewWindow, state: &WindowState) {
    if !is_position_on_screen(window, state) {
        return;
    }

    let width = state.width.max(800);
    let height = state.height.max(600);
    let _ = window.set_size(PhysicalSize::new(width, height));
    let _ = window.set_position(PhysicalPosition::new(state.x, state.y));

    if state.maximized {
        let _ = window.maximize();
    }
}

fn load_trace_docking_state(app: &AppHandle) -> TraceDockingState {
    load_persisted_window_state(app)
        .map(|state| state.trace_docking)
        .unwrap_or_default()
}

fn save_trace_docking_state(app: &AppHandle, mut docking: TraceDockingState) {
    docking.attached_width = clamp_trace_docking_width(docking.attached_width, None);

    let Some(path) = window_state_path(app) else {
        return;
    };
    let Some(parent) = path.parent() else {
        return;
    };

    if fs::create_dir_all(parent).is_err() {
        return;
    }

    let mut persisted = load_persisted_window_state(app).unwrap_or_default();
    persisted.trace_docking = docking;

    if let Ok(contents) = serde_json::to_string_pretty(&persisted) {
        let _ = fs::write(path, contents);
    }
}

fn trace_docking_snapshot(docking: &TraceDockingState) -> TraceDockingSnapshot {
    TraceDockingSnapshot {
        side: docking.side,
        attached_width: docking.attached_width,
        is_docked: docking.side.is_some(),
        always_on_top: docking.always_on_top || docking.side.is_some(),
        always_on_top_forced: docking.side.is_some(),
    }
}

fn emit_trace_docking_changed(app: &AppHandle, docking: &TraceDockingState) {
    let _ = app.emit("trace-docking-changed", trace_docking_snapshot(docking));
}

fn clamp_trace_docking_width(width: f64, _main_width: Option<u32>) -> f64 {
    width
        .max(TRACE_DOCKING_MIN_WIDTH)
        .min(TRACE_DOCKING_MAX_WIDTH)
}

fn calculate_trace_docking_bounds(
    main_content_position: PhysicalPosition<i32>,
    main_content_size: PhysicalSize<u32>,
    trace_frame_offset: PhysicalPosition<i32>,
    side: TraceDockingSide,
    width: f64,
    main_maximized: bool,
) -> (PhysicalPosition<i32>, PhysicalSize<u32>) {
    let width = clamp_trace_docking_width(width, Some(main_content_size.width)).round() as u32;
    let width_i32 = width as i32;

    let (height, y_offset) = if main_maximized {
        (
            (main_content_size.height as i32 - MAIN_TITLE_BAR_HEIGHT).max(1) as u32,
            MAIN_TITLE_BAR_HEIGHT,
        )
    } else {
        (main_content_size.height.max(1), 0)
    };

    let content_x = match (side, main_maximized) {
        (TraceDockingSide::Left, true) => main_content_position.x,
        (TraceDockingSide::Right, true) => {
            main_content_position.x + main_content_size.width as i32 - width_i32
        }
        (TraceDockingSide::Left, false) => main_content_position.x - width_i32,
        (TraceDockingSide::Right, false) => {
            main_content_position.x + main_content_size.width as i32
        }
    };

    (
        PhysicalPosition::new(
            content_x - trace_frame_offset.x,
            main_content_position.y + y_offset - trace_frame_offset.y,
        ),
        PhysicalSize::new(width, height),
    )
}

fn window_frame_offset(window: &WebviewWindow) -> PhysicalPosition<i32> {
    let Ok(inner) = window.inner_position() else {
        return PhysicalPosition::new(0, 0);
    };
    let Ok(outer) = window.outer_position() else {
        return PhysicalPosition::new(0, 0);
    };

    PhysicalPosition::new(inner.x - outer.x, inner.y - outer.y)
}

fn schedule_trace_docking_width_sync(
    app: AppHandle,
    trace: WebviewWindow,
    generation: Arc<AtomicU64>,
) {
    let current_generation = generation.fetch_add(1, Ordering::Relaxed) + 1;

    thread::spawn(move || {
        thread::sleep(Duration::from_millis(TRACE_DOCKING_RESIZE_SYNC_MS));
        if generation.load(Ordering::Relaxed) != current_generation {
            return;
        }
        if trace.is_minimized().unwrap_or(false) {
            return;
        }
        let _ = sync_trace_docking_width(&app, None);
    });
}

pub fn trace_docking_state(app: &AppHandle) -> TraceDockingSnapshot {
    trace_docking_snapshot(&load_trace_docking_state(app))
}

pub fn set_trace_always_on_top_state(app: &AppHandle, always_on_top: bool) -> TraceDockingSnapshot {
    let mut docking = load_trace_docking_state(app);
    if docking.side.is_some() && !always_on_top {
        docking.always_on_top = true;
        if let Some(trace) = app.get_webview_window(TRACE_WINDOW_LABEL) {
            let _ = trace.set_always_on_top(true);
        }
        save_trace_docking_state(app, docking.clone());
        emit_trace_docking_changed(app, &docking);
        return trace_docking_snapshot(&docking);
    }

    docking.always_on_top = always_on_top;
    save_trace_docking_state(app, docking.clone());
    emit_trace_docking_changed(app, &docking);
    trace_docking_snapshot(&docking)
}

pub fn set_trace_docking_side(
    app: &AppHandle,
    side: Option<TraceDockingSide>,
) -> Result<TraceDockingSnapshot, String> {
    let mut docking = load_trace_docking_state(app);

    match side {
        Some(side) => {
            if docking.side.is_none() {
                docking.previous_always_on_top = Some(docking.always_on_top);
            }
            docking.side = Some(side);
            docking.always_on_top = true;
            docking.hidden_with_main = false;
            docking.attached_width = clamp_trace_docking_width(docking.attached_width, None);
            save_trace_docking_state(app, docking.clone());
            apply_trace_docking(app)?;
        }
        None => {
            exit_trace_docking(app)?;
            return Ok(trace_docking_state(app));
        }
    }

    emit_trace_docking_changed(app, &docking);
    Ok(trace_docking_snapshot(&docking))
}

pub fn exit_trace_docking(app: &AppHandle) -> Result<(), String> {
    let mut docking = load_trace_docking_state(app);
    let Some(_) = docking.side else {
        emit_trace_docking_changed(app, &docking);
        return Ok(());
    };

    let restored_always_on_top = docking
        .previous_always_on_top
        .unwrap_or(docking.always_on_top);
    docking.side = None;
    docking.previous_always_on_top = None;
    docking.always_on_top = restored_always_on_top;
    docking.hidden_with_main = false;
    save_trace_docking_state(app, docking.clone());

    if let Some(trace) = app.get_webview_window(TRACE_WINDOW_LABEL) {
        // Restore normal size constraints (remove docked mode locks)
        let _ = trace.set_min_size(Some(PhysicalSize::new(
            TRACE_DOCKING_MIN_WIDTH.round() as u32,
            400,
        )));
        let _ = trace.set_max_size(None::<PhysicalSize<u32>>);

        let _ = restore_trace_window_state(app, &trace);
        trace
            .set_always_on_top(restored_always_on_top)
            .map_err(|e| e.to_string())?;
        let _ = trace.show();
        let _ = trace.set_focus();
    }

    emit_trace_docking_changed(app, &docking);
    Ok(())
}

pub fn apply_trace_docking(app: &AppHandle) -> Result<(), String> {
    let mut docking = load_trace_docking_state(app);
    let Some(side) = docking.side else {
        return Ok(());
    };

    let Some(main) = app.get_webview_window("main") else {
        return Ok(());
    };
    let Some(trace) = app.get_webview_window(TRACE_WINDOW_LABEL) else {
        return Ok(());
    };

    if main.is_minimized().unwrap_or(false) {
        return hide_trace_for_main_minimize(app);
    }

    if docking.hidden_with_main {
        docking.hidden_with_main = false;
        save_trace_docking_state(app, docking.clone());
    }

    if trace.is_minimized().unwrap_or(false) {
        return Ok(());
    }

    let main_position = main.inner_position().map_err(|e| e.to_string())?;
    let main_size = main.inner_size().map_err(|e| e.to_string())?;
    let trace_frame_offset = window_frame_offset(&trace);
    let main_maximized = main.is_maximized().unwrap_or(false);
    docking.attached_width =
        clamp_trace_docking_width(docking.attached_width, Some(main_size.width));
    let (position, size) = calculate_trace_docking_bounds(
        main_position,
        main_size,
        trace_frame_offset,
        side,
        docking.attached_width,
        main_maximized,
    );

    // Lock size at OS level BEFORE set_size so constraints are active immediately
    let locked_height = size.height;
    let _ = trace.set_min_size(Some(PhysicalSize::new(
        TRACE_DOCKING_MIN_WIDTH.round() as u32,
        locked_height,
    )));
    let _ = trace.set_max_size(Some(PhysicalSize::new(
        TRACE_DOCKING_MAX_WIDTH.round() as u32,
        locked_height,
    )));

    trace.set_size(size).map_err(|e| e.to_string())?;
    // Update timestamp BEFORE set_position so the Moved event it triggers
    // does not incorrectly interpret this as a user drag and exit docking.
    LAST_TRACE_DOCKING_APPLY_MS.store(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64,
        Ordering::Relaxed,
    );
    trace.set_position(position).map_err(|e| e.to_string())?;

    trace.set_always_on_top(true).map_err(|e| e.to_string())?;
    let _ = trace.show();

    docking.always_on_top = true;
    save_trace_docking_state(app, docking.clone());
    emit_trace_docking_changed(app, &docking);
    Ok(())
}

pub fn sync_trace_docking_width(
    app: &AppHandle,
    width: Option<f64>,
) -> Result<TraceDockingSnapshot, String> {
    let mut docking = load_trace_docking_state(app);
    if docking.side.is_none() {
        return Ok(trace_docking_snapshot(&docking));
    }

    let measured_width = if let Some(width) = width {
        width
    } else if let Some(trace) = app.get_webview_window(TRACE_WINDOW_LABEL) {
        if trace.is_minimized().unwrap_or(false) {
            return Ok(trace_docking_snapshot(&docking));
        }
        trace.inner_size().map_err(|e| e.to_string())?.width as f64
    } else {
        docking.attached_width
    };

    let main_width = app
        .get_webview_window("main")
        .and_then(|main| main.outer_size().ok())
        .map(|size| size.width);

    docking.attached_width = clamp_trace_docking_width(measured_width, main_width);
    save_trace_docking_state(app, docking.clone());
    emit_trace_docking_changed(app, &docking);
    Ok(trace_docking_state(app))
}

pub fn hide_trace_for_main_minimize(app: &AppHandle) -> Result<(), String> {
    let mut docking = load_trace_docking_state(app);
    if docking.side.is_none() {
        return Ok(());
    }

    if let Some(trace) = app.get_webview_window(TRACE_WINDOW_LABEL) {
        let visible = trace.is_visible().unwrap_or(false);
        if visible {
            trace.hide().map_err(|e| e.to_string())?;
            docking.hidden_with_main = true;
            save_trace_docking_state(app, docking.clone());
            emit_trace_docking_changed(app, &docking);
        }
    }

    Ok(())
}

fn setup_window_state(app: &tauri::App) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let states = load_window_state(app.handle());
    if let Some(ref states) = states {
        if let Some(state) = states.get("main") {
            restore_window_state(&window, state);
        }
    }

    window.show().ok();

    let generation = Arc::new(AtomicU64::new(0));
    let app_handle = app.handle().clone();
    let window_for_events = window.clone();
    let save_generation = generation.clone();
    let label = "main".to_string();

    window.on_window_event(move |event| match event {
        WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
            schedule_window_state_save(
                app_handle.clone(),
                window_for_events.clone(),
                label.clone(),
                save_generation.clone(),
            );
            if window_for_events.is_minimized().unwrap_or(false) {
                let _ = hide_trace_for_main_minimize(&app_handle);
            } else {
                let _ = apply_trace_docking(&app_handle);
            }
        }
        WindowEvent::Focused(true) => {
            let _ = apply_trace_docking(&app_handle);
        }
        WindowEvent::CloseRequested { .. } => {
            save_window_state_for_label(&app_handle, &window_for_events, &label);
            close_trace_window(&app_handle);
        }
        _ => {}
    });
}

/// Set up state persistence for the trace window (called from commands.rs after creation).
/// Restores persisted size/position, registers debounced save on move/resize, and
/// immediate save on CloseRequested.
pub fn setup_trace_window_state(app: &AppHandle, trace_window: &WebviewWindow) {
    let persisted = load_persisted_window_state(app);
    let is_docked = persisted
        .as_ref()
        .is_some_and(|state| state.trace_docking.side.is_some());
    if !is_docked {
        if let Some(state) = persisted
            .as_ref()
            .and_then(|state| state.windows.get("trace"))
        {
            restore_window_state(trace_window, state);
        }
    }

    let generation = Arc::new(AtomicU64::new(0));
    let app_handle = app.clone();
    let window_for_events = trace_window.clone();
    let save_generation = generation.clone();
    let resize_sync_generation = Arc::new(AtomicU64::new(0));
    let label = "trace".to_string();

    trace_window.on_window_event(move |event| match event {
        WindowEvent::Moved(_) => {
            if let Some(_) = load_trace_docking_state(&app_handle).side {
                if window_for_events.is_minimized().unwrap_or(false) {
                    return;
                }
                // Detect user-initiated drag (not our own programmatic position set)
                let now_ms = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as i64;
                let last_apply_ms = LAST_TRACE_DOCKING_APPLY_MS.load(Ordering::Relaxed);
                if now_ms - last_apply_ms > DOCKING_DRAG_EXIT_THRESHOLD_MS {
                    // User dragged the docked trace window — exit docking
                    let _ = exit_trace_docking(&app_handle);
                }
            } else {
                schedule_window_state_save(
                    app_handle.clone(),
                    window_for_events.clone(),
                    label.clone(),
                    save_generation.clone(),
                );
            }
        }
        WindowEvent::Resized(_) => {
            if load_trace_docking_state(&app_handle).side.is_some() {
                if window_for_events.is_minimized().unwrap_or(false) {
                    return;
                }
                schedule_trace_docking_width_sync(
                    app_handle.clone(),
                    window_for_events.clone(),
                    resize_sync_generation.clone(),
                );
            } else {
                schedule_window_state_save(
                    app_handle.clone(),
                    window_for_events.clone(),
                    label.clone(),
                    save_generation.clone(),
                );
            }
        }
        WindowEvent::CloseRequested { .. } => {
            if load_trace_docking_state(&app_handle).side.is_none() {
                save_window_state_for_label(&app_handle, &window_for_events, &label);
            }
            let _ = app_handle.emit("trace-window-closed", ());
        }
        _ => {}
    });
}

/// Save the trace window state before hiding it (called from hide_trace_window).
pub fn save_trace_window_state(app: &AppHandle) {
    if load_trace_docking_state(app).side.is_some() {
        return;
    }

    if let Some(trace) = app.get_webview_window(TRACE_WINDOW_LABEL) {
        save_window_state_for_label(app, &trace, "trace");
    }
}

fn close_trace_window(app: &AppHandle) {
    if let Some(trace) = app.get_webview_window(TRACE_WINDOW_LABEL) {
        let _ = trace.close();
    }
}

/// Restore trace window state from persistence (called from open_trace_window).
/// Returns true if state was restored (meaning .center() should be skipped).
pub fn restore_trace_window_state(app: &AppHandle, trace_window: &WebviewWindow) -> bool {
    let persisted = load_persisted_window_state(app);
    if let Some(ref persisted) = persisted {
        if persisted.trace_docking.side.is_some() {
            return true;
        }
        if let Some(state) = persisted.windows.get("trace") {
            restore_window_state(trace_window, state);
            return true;
        }
    }
    false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            app.manage(AppState::new(app.handle()));
            setup_window_state(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::send_message,
            commands::run_agent,
            commands::stop_agent,
            commands::stop_streaming,
            commands::open_trace_window,
            commands::hide_trace_window,
            commands::close_trace_window,
            commands::is_trace_window_open,
            commands::set_trace_always_on_top,
            commands::get_trace_docking_state,
            commands::set_trace_docking_mode,
            commands::exit_trace_docking,
            commands::sync_trace_docking_width,
            commands::sync_trace_docking_to_main,
            commands::hide_trace_for_main_minimize,
            commands::save_settings,
            commands::load_settings,
            commands::list_models,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
