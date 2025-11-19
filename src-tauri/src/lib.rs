pub mod commands;
pub mod models;
pub mod state;

pub use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Инициализация логирования
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    log::info!("Starting repo2txt application");

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(std::sync::Arc::new(state::AppState::new()))
        .invoke_handler(tauri::generate_handler![
            commands::repository::get_current_directory,
            commands::repository::get_parent_directory,
            commands::repository::open_directory,
            commands::repository::update_selection,
            commands::repository::toggle_expanded,
            commands::repository::get_tree,
            commands::repository::get_state,
            commands::repository::scan_directory,
            commands::repository::search_nodes,
            commands::repository::select_all,
            commands::repository::deselect_all,
            commands::generator::generate_markdown,
            commands::generator::get_stats,
            commands::generator::copy_from_cache_to_clipboard,
            commands::file_ops::read_file,
            commands::file_ops::save_config,
            commands::file_ops::load_config,
            commands::file_ops::get_config_schema,
            commands::file_ops::get_default_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    log::info!("Application shutdown");
}
