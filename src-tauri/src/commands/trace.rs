use crate::events::event_names;
use crate::window::{
    self, apply_trace_docking, restore_trace_window_state, setup_trace_window_state,
    save_trace_window_state, TRACE_WINDOW_LABEL, TRACE_WINDOW_WIDTH,
    TRACE_WINDOW_MIN_WIDTH, TRACE_WINDOW_MIN_HEIGHT,
};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
pub async fn open_trace_window(
    app: AppHandle,
    conversation_id: Option<String>,
) -> Result<(), String> {
    let mut docking = window::load_trace_docking_state(&app);
    if docking.hidden_while_docked {
        docking.hidden_while_docked = false;
        window::save_trace_docking_state(&app, docking);
    }

    if let Some(trace) = app.get_webview_window(TRACE_WINDOW_LABEL) {
        trace.show().map_err(|e| e.to_string())?;
        apply_trace_docking(&app)?;
        trace.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let url_path = if let Some(ref id) = conversation_id {
        format!("index.html?window=trace&conversationId={}", id)
    } else {
        "index.html?window=trace".to_string()
    };

    #[cfg(debug_assertions)]
    let url = WebviewUrl::External(
        format!("http://localhost:1420/{}", url_path)
            .parse()
            .unwrap(),
    );
    #[cfg(not(debug_assertions))]
    let url = WebviewUrl::App(url_path.into());

    let builder = WebviewWindowBuilder::new(&app, TRACE_WINDOW_LABEL, url)
        .title("Agent Trace")
        .inner_size(TRACE_WINDOW_WIDTH, 600.0)
        .min_inner_size(TRACE_WINDOW_MIN_WIDTH, TRACE_WINDOW_MIN_HEIGHT)
        .resizable(true)
        .decorations(false)
        .visible(true);

    let trace = builder.build().map_err(|e| e.to_string())?;
    let had_state = restore_trace_window_state(&app, &trace);
    if !had_state {
        let _ = trace.center();
    }

    setup_trace_window_state(&app, &trace);
    apply_trace_docking(&app)?;

    Ok(())
}

#[tauri::command]
pub fn hide_trace_window(app: AppHandle) -> Result<(), String> {
    if let Some(trace) = app.get_webview_window(TRACE_WINDOW_LABEL) {
        save_trace_window_state(&app);

        let mut docking = window::load_trace_docking_state(&app);
        if docking.side.is_some() {
            docking.hidden_while_docked = true;
            window::save_trace_docking_state(&app, docking);
        }

        trace.hide().map_err(|e| e.to_string())?;
        let _ = app.emit(event_names::TRACE_WINDOW_CLOSED, ());
    }
    Ok(())
}

#[tauri::command]
pub fn close_trace_window(app: AppHandle) -> Result<(), String> {
    if let Some(trace) = app.get_webview_window(TRACE_WINDOW_LABEL) {
        trace.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn is_trace_window_open(app: AppHandle) -> bool {
    app.get_webview_window(TRACE_WINDOW_LABEL)
        .and_then(|trace| trace.is_visible().ok())
        .unwrap_or(false)
}
