use std::sync::atomic::{AtomicI64, AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use crate::events::event_names;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

use super::state::{
    load_persisted_window_state, restore_trace_window_state, window_state_path,
};
use super::{
    DOCKING_DRAG_EXIT_THRESHOLD_MS, MAIN_TITLE_BAR_HEIGHT, MAIN_TRACE_GAP,
    TRACE_DOCKING_MAX_WIDTH, TRACE_DOCKING_MIN_WIDTH, TRACE_DOCKING_RESIZE_SYNC_MS,
    TRACE_WINDOW_LABEL,
};

pub static LAST_TRACE_DOCKING_APPLY_MS: AtomicI64 = AtomicI64::new(0);

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TraceDockingSide {
    Left,
    Right,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TraceDockingState {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub side: Option<TraceDockingSide>,
    #[serde(default)]
    pub attached_width: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub previous_always_on_top: Option<bool>,
    #[serde(default)]
    pub always_on_top: bool,
    #[serde(default)]
    pub hidden_with_main: bool,
    #[serde(default)]
    pub hidden_while_docked: bool,
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MainAlwaysOnTopChangedEvent {
    pub always_on_top: bool,
}

// ─── Docking helpers ────────────────────────────────────────

pub fn clamp_trace_docking_width(width: f64, _main_width: Option<u32>) -> f64 {
    width
        .max(TRACE_DOCKING_MIN_WIDTH)
        .min(TRACE_DOCKING_MAX_WIDTH)
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
    let _ = app.emit(event_names::TRACE_DOCKING_CHANGED, trace_docking_snapshot(docking));
}

fn emit_main_always_on_top_changed(app: &AppHandle, always_on_top: bool) {
    let _ = app.emit(
        event_names::MAIN_ALWAYS_ON_TOP_CHANGED,
        MainAlwaysOnTopChangedEvent { always_on_top },
    );
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
        (TraceDockingSide::Left, false) => main_content_position.x - width_i32 - MAIN_TRACE_GAP,
        (TraceDockingSide::Right, false) => {
            main_content_position.x + main_content_size.width as i32 + MAIN_TRACE_GAP
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

pub fn schedule_trace_docking_width_sync(
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

// ─── Public docking API ─────────────────────────────────────

pub fn load_trace_docking_state(app: &AppHandle) -> TraceDockingState {
    load_persisted_window_state(app)
        .map(|state| state.trace_docking)
        .unwrap_or_default()
}

pub fn save_trace_docking_state(app: &AppHandle, mut docking: TraceDockingState) {
    docking.attached_width = clamp_trace_docking_width(docking.attached_width, None);

    let Some(path) = window_state_path(app) else {
        return;
    };
    let Some(parent) = path.parent() else {
        return;
    };

    if std::fs::create_dir_all(parent).is_err() {
        return;
    }

    let mut persisted = load_persisted_window_state(app).unwrap_or_default();
    persisted.trace_docking = docking;

    if let Ok(contents) = serde_json::to_string_pretty(&persisted) {
        let _ = std::fs::write(path, contents);
    }
}

pub fn trace_docking_state(app: &AppHandle) -> TraceDockingSnapshot {
    trace_docking_snapshot(&load_trace_docking_state(app))
}

pub fn reset_main_always_on_top_state(app: &AppHandle) {
    let mut docking = load_trace_docking_state(app);
    docking.always_on_top = false;
    docking.previous_always_on_top = None;
    docking.hidden_with_main = false;
    docking.hidden_while_docked = false;
    save_trace_docking_state(app, docking);
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

pub fn set_main_always_on_top(app: &AppHandle, always_on_top: bool) -> Result<(), String> {
    if let Some(main) = app.get_webview_window("main") {
        main.set_always_on_top(always_on_top)
            .map_err(|e| e.to_string())?;
    }

    let mut docking = load_trace_docking_state(app);
    docking.always_on_top = always_on_top;
    save_trace_docking_state(app, docking.clone());

    if let Some(trace) = app.get_webview_window(TRACE_WINDOW_LABEL) {
        if trace.is_visible().unwrap_or(false) {
            let trace_always_on_top = if docking.side.is_some() {
                true
            } else {
                always_on_top
            };
            trace.set_always_on_top(trace_always_on_top)
                .map_err(|e| e.to_string())?;
        }
    }

    emit_trace_docking_changed(app, &docking);
    emit_main_always_on_top_changed(app, always_on_top);
    Ok(())
}

pub fn set_trace_docking_side(
    app: &AppHandle,
    side: Option<TraceDockingSide>,
) -> Result<TraceDockingSnapshot, String> {
    let mut docking = load_trace_docking_state(app);

    match side {
        Some(side) => {
            docking.side = Some(side);
            docking.previous_always_on_top = None;
            docking.hidden_with_main = false;
            docking.hidden_while_docked = false;
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

    let restored_always_on_top = docking.always_on_top;
    docking.side = None;
    docking.previous_always_on_top = None;
    docking.always_on_top = restored_always_on_top;
    docking.hidden_with_main = false;
    docking.hidden_while_docked = false;
    save_trace_docking_state(app, docking.clone());

    if let Some(trace) = app.get_webview_window(TRACE_WINDOW_LABEL) {
        let _ = trace.set_min_size(Some(PhysicalSize::new(
            TRACE_DOCKING_MIN_WIDTH.round() as u32,
            400,
        )));
        let _ = trace.set_max_size(None::<PhysicalSize<u32>>);

        let _ = restore_trace_window_state(app, &trace);
        let _ = trace.show();
        trace
            .set_always_on_top(restored_always_on_top)
            .map_err(|e| e.to_string())?;
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
    LAST_TRACE_DOCKING_APPLY_MS.store(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64,
        Ordering::Relaxed,
    );
    trace.set_position(position).map_err(|e| e.to_string())?;

    if docking.hidden_while_docked {
        save_trace_docking_state(app, docking.clone());
        return Ok(());
    }

    let _ = trace.show();
    trace.set_always_on_top(true).map_err(|e| e.to_string())?;
    let _ = trace.set_focus();

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserialize_trace_docking_state_without_hidden_while_docked() {
        let json =
            r#"{"side":"right","attachedWidth":450.0,"alwaysOnTop":true,"hiddenWithMain":false}"#;
        let state: TraceDockingState = serde_json::from_str(json).unwrap();
        assert_eq!(state.hidden_while_docked, false);
        assert_eq!(state.side, Some(TraceDockingSide::Right));
        assert_eq!(state.attached_width, 450.0);
    }

    #[test]
    fn deserialize_trace_docking_state_with_hidden_while_docked_true() {
        let json = r#"{"side":"left","attachedWidth":500.0,"alwaysOnTop":true,"hiddenWithMain":false,"hiddenWhileDocked":true}"#;
        let state: TraceDockingState = serde_json::from_str(json).unwrap();
        assert_eq!(state.hidden_while_docked, true);
    }

    #[test]
    fn default_hidden_while_docked_is_false() {
        let state = TraceDockingState::default();
        assert!(!state.hidden_while_docked);
    }
}
