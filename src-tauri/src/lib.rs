mod agent;
mod cc_switch;
mod commands;
mod config;
mod types;
mod ai;
mod mem0;
mod qdrant;
mod anything_llm;
mod logging;

use types::AgentChild;

// ========== App Entry ==========

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize file logger first
    logging::init();

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
            commands::open_folder,
            commands::init_agent,
            commands::test_api,
            commands::import_skill_zip,
            commands::import_skill_slug,
            commands::read_claude_memory,
            commands::list_claude_sessions,
            commands::resume_claude_session,
            commands::read_claude_session,
            commands::install_agent_mem0,
            commands::ensure_project_link,
            ai::ai_chat,
            ai::ai_analyze,
            ai::ai_update,
            ai::ai_apply,
            mem0::check_mem0_installed,
            mem0::get_mem0_version,
            mem0::install_mem0,
            mem0::uninstall_mem0,
            mem0::mem0_add,
            mem0::mem0_search,
            mem0::mem0_delete,
            mem0::mem0_get_all,
            qdrant::qdrant_health,
            qdrant::qdrant_list_collections,
            qdrant::qdrant_get_collection,
            qdrant::qdrant_scroll_points,
            qdrant::qdrant_delete_points,
            anything_llm::anything_llm_health,
            anything_llm::anything_llm_list_workspaces,
            anything_llm::anything_llm_create_workspace,
            anything_llm::anything_llm_delete_workspace,
            anything_llm::anything_llm_list_documents,
            anything_llm::anything_llm_search,
            anything_llm::anything_llm_chat,
            anything_llm::anything_llm_upload_document,
            anything_llm::anything_llm_add_to_workspace,
            logging::get_logs,
            logging::clear_logs,
            logging::frontend_log,
            logging::open_log_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
