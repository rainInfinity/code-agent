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
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    thread,
    time::Duration,
};

use commands::AppState;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewWindow, WindowEvent};

const WINDOW_STATE_FILE: &str = "window-state.json";
const WINDOW_STATE_DEBOUNCE_MS: u64 = 500;

type WindowStates = HashMap<String, WindowState>;

#[derive(Debug, Clone, Deserialize, Serialize)]
struct WindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    maximized: bool,
}

fn window_state_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|dir| dir.join(WINDOW_STATE_FILE))
}

fn load_window_state(app: &AppHandle) -> Option<WindowStates> {
    let path = window_state_path(app)?;
    let contents = fs::read_to_string(path).ok()?;
    // Try new HashMap format first
    if let Ok(states) = serde_json::from_str::<WindowStates>(&contents) {
        return Some(states);
    }
    // Fall back to legacy single-object format, auto-migrate on next save
    if let Ok(state) = serde_json::from_str::<WindowState>(&contents) {
        let mut states = HashMap::new();
        states.insert("main".to_string(), state);
        return Some(states);
    }
    None
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

    let mut states = load_window_state(app).unwrap_or_default();
    states.insert(label.to_string(), state);

    if let Ok(contents) = serde_json::to_string_pretty(&states) {
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
    let states = load_window_state(app);
    if let Some(ref states) = states {
        if let Some(state) = states.get("trace") {
            restore_window_state(trace_window, state);
        }
    }

    let generation = Arc::new(AtomicU64::new(0));
    let app_handle = app.clone();
    let window_for_events = trace_window.clone();
    let save_generation = generation.clone();
    let label = "trace".to_string();

    trace_window.on_window_event(move |event| {
        match event {
            WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
                schedule_window_state_save(
                    app_handle.clone(),
                    window_for_events.clone(),
                    label.clone(),
                    save_generation.clone(),
                );
            }
            WindowEvent::CloseRequested { .. } => {
                save_window_state_for_label(&app_handle, &window_for_events, &label);
                let _ = app_handle.emit("trace-window-closed", ());
            }
            _ => {}
        }
    });
}

/// Save the trace window state before hiding it (called from hide_trace_window).
pub fn save_trace_window_state(app: &AppHandle) {
    if let Some(trace) = app.get_webview_window("trace") {
        save_window_state_for_label(app, &trace, "trace");
    }
}

fn close_trace_window(app: &AppHandle) {
    if let Some(trace) = app.get_webview_window("trace") {
        let _ = trace.close();
    }
}

/// Restore trace window state from persistence (called from open_trace_window).
/// Returns true if state was restored (meaning .center() should be skipped).
pub fn restore_trace_window_state(app: &AppHandle, trace_window: &WebviewWindow) -> bool {
    let states = load_window_state(app);
    if let Some(ref states) = states {
        if let Some(state) = states.get("trace") {
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
            commands::save_settings,
            commands::load_settings,
            commands::list_models,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
