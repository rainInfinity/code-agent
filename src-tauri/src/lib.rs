mod agent;
mod commands;
mod llm;
mod models;
mod providers;
mod tools;

use std::{
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
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow, WindowEvent};

const WINDOW_STATE_FILE: &str = "window-state.json";
const WINDOW_STATE_DEBOUNCE_MS: u64 = 500;

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

fn load_window_state(app: &AppHandle) -> Option<WindowState> {
    let path = window_state_path(app)?;
    let contents = fs::read_to_string(path).ok()?;
    serde_json::from_str(&contents).ok()
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

fn save_window_state(app: &AppHandle, window: &WebviewWindow) {
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

    if let Ok(contents) = serde_json::to_string_pretty(&state) {
        let _ = fs::write(path, contents);
    }
}

fn schedule_window_state_save(
    app: AppHandle,
    window: WebviewWindow,
    generation: Arc<AtomicU64>,
) {
    let current_generation = generation.fetch_add(1, Ordering::Relaxed) + 1;

    thread::spawn(move || {
        thread::sleep(Duration::from_millis(WINDOW_STATE_DEBOUNCE_MS));
        if generation.load(Ordering::Relaxed) == current_generation {
            save_window_state(&app, &window);
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

fn restore_window_state(window: &WebviewWindow, state: WindowState) {
    if !is_position_on_screen(window, &state) {
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

    if let Some(state) = load_window_state(app.handle()) {
        restore_window_state(&window, state);
    }

    window.show().ok();

    let generation = Arc::new(AtomicU64::new(0));
    let app_handle = app.handle().clone();
    let window_for_events = window.clone();
    let save_generation = generation.clone();

    window.on_window_event(move |event| match event {
        WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
            schedule_window_state_save(
                app_handle.clone(),
                window_for_events.clone(),
                save_generation.clone(),
            );
        }
        WindowEvent::CloseRequested { .. } => {
            save_window_state(&app_handle, &window_for_events);
        }
        _ => {}
    });
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
            commands::save_settings,
            commands::load_settings,
            commands::list_models,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
