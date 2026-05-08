use std::sync::atomic::AtomicU64;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::events::event_names;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow, WindowEvent};

use super::docking::{
    apply_trace_docking, exit_trace_docking, hide_trace_for_main_minimize,
    load_trace_docking_state, schedule_trace_docking_width_sync, LAST_TRACE_DOCKING_APPLY_MS,
};
use super::DOCKING_DRAG_EXIT_THRESHOLD_MS;
use super::state::{
    load_persisted_window_state, load_window_state, restore_window_state,
    save_window_state_for_label, schedule_window_state_save,
};
use super::TRACE_WINDOW_LABEL;

pub fn setup_window_state(app: &tauri::App) {
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

/// Set up state persistence for the trace window (called after creation).
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
                let now_ms = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as i64;
                let last_apply_ms = LAST_TRACE_DOCKING_APPLY_MS.load(std::sync::atomic::Ordering::Relaxed);
                if now_ms - last_apply_ms > DOCKING_DRAG_EXIT_THRESHOLD_MS {
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
            let _ = app_handle.emit(event_names::TRACE_WINDOW_CLOSED, ());
        }
        _ => {}
    });
}

/// Save the trace window state before hiding it.
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

