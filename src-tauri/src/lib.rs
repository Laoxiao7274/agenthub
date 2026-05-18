mod agent;
mod cc_switch;
mod commands;
mod config;
mod types;

use types::AgentChild;

// ========== App Entry ==========

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AgentChild(std::sync::Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            agent::check_runtime,
            agent::get_runtime_version,
            cc_switch::read_cc_switch_providers,
            config::write_project_config,
            config::read_project_config,
            agent::start_agent,
            agent::stop_agent,
            agent::agent_status,
            agent::install_skillhub_skills,
            commands::check_skillhub_installed,
            commands::init_project,
            commands::delete_folder,
            commands::ensure_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
