mod agent;
mod commands;
mod events;
mod llm;
mod models;
mod prompt;
mod providers;
mod settings_io;
mod state;
mod tools;
mod window;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            app.manage(state::AppState::new(app.handle()));
            window::lifecycle::setup_window_state(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::chat::send_message,
            commands::chat::stop_streaming,
            commands::agent::run_agent,
            commands::agent::stop_agent,
            commands::trace::open_trace_window,
            commands::trace::hide_trace_window,
            commands::trace::close_trace_window,
            commands::trace::is_trace_window_open,
            commands::docking::set_trace_always_on_top,
            commands::docking::get_trace_docking_state,
            commands::docking::set_trace_docking_mode,
            commands::docking::exit_trace_docking,
            commands::docking::sync_trace_docking_width,
            commands::docking::sync_trace_docking_to_main,
            commands::docking::hide_trace_for_main_minimize,
            commands::settings::save_settings,
            commands::settings::load_settings,
            commands::settings::list_models,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
