mod commands;
mod llm;
mod models;
mod providers;
mod tools;

use commands::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            app.manage(AppState::new(app.handle()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::send_message,
            commands::stop_streaming,
            commands::save_settings,
            commands::load_settings,
            commands::list_models,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
