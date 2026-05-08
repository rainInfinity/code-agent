use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

use super::docking::{clamp_trace_docking_width, TraceDockingState};
use super::TRACE_DOCKING_DEFAULT_WIDTH;

const WINDOW_STATE_FILE: &str = "window-state.json";
const WINDOW_STATE_DEBOUNCE_MS: u64 = 500;

pub type WindowStates = HashMap<String, WindowState>;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct WindowState {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub maximized: bool,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedWindowState {
    #[serde(default)]
    pub windows: WindowStates,
    #[serde(default)]
    pub trace_docking: TraceDockingState,
}

pub fn window_state_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|dir| dir.join(WINDOW_STATE_FILE))
}

pub fn load_persisted_window_state(app: &AppHandle) -> Option<PersistedWindowState> {
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

pub fn load_window_state(app: &AppHandle) -> Option<WindowStates> {
    load_persisted_window_state(app).map(|state| state.windows)
}

pub fn capture_window_state(window: &WebviewWindow) -> Option<WindowState> {
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

pub fn save_window_state_for_label(app: &AppHandle, window: &WebviewWindow, label: &str) {
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

pub fn schedule_window_state_save(
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

pub fn is_position_on_screen(window: &WebviewWindow, state: &WindowState) -> bool {
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

pub fn restore_window_state(window: &WebviewWindow, state: &WindowState) {
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

fn default_trace_docking_width() -> f64 {
    TRACE_DOCKING_DEFAULT_WIDTH
}

/// Restore trace window state from persistence.
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

impl Default for TraceDockingState {
    fn default() -> Self {
        Self {
            side: None,
            attached_width: default_trace_docking_width(),
            previous_always_on_top: None,
            always_on_top: false,
            hidden_with_main: false,
            hidden_while_docked: false,
        }
    }
}
