use crate::window::{self, TraceDockingSide, TraceDockingSnapshot, TRACE_WINDOW_LABEL};
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn set_trace_always_on_top(app: AppHandle, always_on_top: bool) -> Result<(), String> {
    if let Some(trace) = app.get_webview_window(TRACE_WINDOW_LABEL) {
        let snapshot = window::set_trace_always_on_top_state(&app, always_on_top);
        if snapshot.always_on_top_forced && !always_on_top {
            return Ok(());
        }
        trace
            .set_always_on_top(always_on_top)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_trace_docking_state(app: AppHandle) -> TraceDockingSnapshot {
    window::trace_docking_state(&app)
}

#[tauri::command]
pub fn set_trace_docking_mode(
    app: AppHandle,
    side: Option<TraceDockingSide>,
) -> Result<TraceDockingSnapshot, String> {
    window::set_trace_docking_side(&app, side)
}

#[tauri::command]
pub fn exit_trace_docking(app: AppHandle) -> Result<TraceDockingSnapshot, String> {
    window::exit_trace_docking(&app)?;
    Ok(window::trace_docking_state(&app))
}

#[tauri::command]
pub fn sync_trace_docking_width(
    app: AppHandle,
    width: Option<f64>,
) -> Result<TraceDockingSnapshot, String> {
    window::sync_trace_docking_width(&app, width)
}

#[tauri::command]
pub fn sync_trace_docking_to_main(app: AppHandle) -> Result<TraceDockingSnapshot, String> {
    window::apply_trace_docking(&app)?;
    Ok(window::trace_docking_state(&app))
}

#[tauri::command]
pub fn hide_trace_for_main_minimize(app: AppHandle) -> Result<(), String> {
    window::hide_trace_for_main_minimize(&app)
}
