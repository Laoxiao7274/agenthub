use std::fs;
use std::path::PathBuf;

use crate::types::{McpServerInput, ProjectConfigInput};

// ========== Config Write Engine ==========

#[tauri::command]
pub fn write_project_config(config: ProjectConfigInput) -> Result<String, String> {
    log::info!("write_project_config: path={}", config.project_path);
    let project_path = PathBuf::from(&config.project_path);
    let claude_dir = project_path.join(".claude");

    fs::create_dir_all(&claude_dir)
        .map_err(|e| format!("Failed to create .claude dir: {}", e))?;

    // 1. Write .claude/settings.json
    write_project_settings(&claude_dir, &config)?;
    // 2. Write .claude/settings.local.json
    write_local_settings(&claude_dir, &config)?;
    // 3. Write CLAUDE.md
    write_claude_md(&project_path, &config.claude_md)?;
    // 4. Write .mcp.json
    write_mcp_json(&project_path, &config.mcp_servers)?;
    // 5. Write global settings
    write_global_settings(&config)?;

    Ok(format!("Config written to {}", project_path.display()))
}

fn write_project_settings(
    claude_dir: &PathBuf,
    config: &ProjectConfigInput,
) -> Result<(), String> {
    let path = claude_dir.join("settings.json");

    let mut settings: serde_json::Value = if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| format!("Read settings: {}", e))?;
        serde_json::from_str(&content).unwrap_or(serde_json::Value::Object(serde_json::Map::new()))
    } else {
        serde_json::Value::Object(serde_json::Map::new())
    };

    let obj = settings
        .as_object_mut()
        .ok_or("settings.json is not an object")?;

    if !config.permission_mode.is_empty() {
        obj.insert(
            "permissions".into(),
            serde_json::json!({ "defaultMode": config.permission_mode }),
        );
    }

    if !config.mcp_servers.is_empty() {
        let mut mcp_map = serde_json::Map::new();
        for server in &config.mcp_servers {
            mcp_map.insert(
                server.name.clone(),
                serde_json::json!({
                    "command": server.command,
                    "args": server.args,
                    "env": server.env,
                }),
            );
        }
        obj.insert("mcpServers".into(), serde_json::Value::Object(mcp_map));
    }

    let has_hooks = config.hooks.pre_tool_use.is_some()
        || config.hooks.post_tool_use.is_some()
        || config.hooks.notification.is_some()
        || config.hooks.stop.is_some();
    if has_hooks {
        let mut hooks_map = serde_json::Map::new();
        if let Some(ref h) = config.hooks.pre_tool_use {
            if !h.is_empty() {
                hooks_map.insert("PreToolUse".into(), serde_json::json!([{ "command": h }]));
            }
        }
        if let Some(ref h) = config.hooks.post_tool_use {
            if !h.is_empty() {
                hooks_map.insert("PostToolUse".into(), serde_json::json!([{ "command": h }]));
            }
        }
        if let Some(ref h) = config.hooks.notification {
            if !h.is_empty() {
                hooks_map.insert("Notification".into(), serde_json::json!([{ "command": h }]));
            }
        }
        if let Some(ref h) = config.hooks.stop {
            if !h.is_empty() {
                hooks_map.insert("Stop".into(), serde_json::json!([{ "command": h }]));
            }
        }
        obj.insert("hooks".into(), serde_json::Value::Object(hooks_map));
    }

    let json = serde_json::to_string_pretty(&settings).map_err(|e| format!("JSON: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("Write settings: {}", e))?;
    Ok(())
}

fn write_local_settings(claude_dir: &PathBuf, config: &ProjectConfigInput) -> Result<(), String> {
    let path = claude_dir.join("settings.local.json");

    let mut local: serde_json::Value = if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| format!("Read local: {}", e))?;
        serde_json::from_str(&content).unwrap_or(serde_json::Value::Object(serde_json::Map::new()))
    } else {
        serde_json::Value::Object(serde_json::Map::new())
    };

    let obj = local
        .as_object_mut()
        .ok_or("settings.local.json is not an object")?;

    let mut env = serde_json::Map::new();
    if !config.api_key.is_empty() {
        env.insert("ANTHROPIC_API_KEY".into(), serde_json::Value::String(config.api_key.clone()));
        // Clear AUTH_TOKEN to avoid auth conflict
        env.insert("ANTHROPIC_AUTH_TOKEN".into(), serde_json::Value::String(String::new()));
    }
    if !config.base_url.is_empty() {
        env.insert("ANTHROPIC_BASE_URL".into(), serde_json::Value::String(config.base_url.clone()));
    }
    if !config.model.is_empty() {
        env.insert("ANTHROPIC_MODEL".into(), serde_json::Value::String(config.model.clone()));
    }
    if !config.small_model.is_empty() {
        env.insert(
            "ANTHROPIC_SMALL_FAST_MODEL".into(),
            serde_json::Value::String(config.small_model.clone()),
        );
    }
    if !env.is_empty() {
        obj.insert("env".into(), serde_json::Value::Object(env));
    }

    let json = serde_json::to_string_pretty(&local).map_err(|e| format!("JSON: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("Write local: {}", e))?;
    Ok(())
}

fn write_claude_md(project_path: &PathBuf, content: &str) -> Result<(), String> {
    let path = project_path.join("CLAUDE.md");
    if content.is_empty() {
        // Remove CLAUDE.md if exists and content is empty
        if path.exists() {
            let _ = fs::remove_file(&path);
        }
        return Ok(());
    }
    fs::write(&path, content).map_err(|e| format!("Write CLAUDE.md: {}", e))?;
    Ok(())
}

fn write_mcp_json(project_path: &PathBuf, servers: &[McpServerInput]) -> Result<(), String> {
    if servers.is_empty() {
        return Ok(());
    }

    let path = project_path.join(".mcp.json");
    let mut mcp_map = serde_json::Map::new();
    for server in servers {
        mcp_map.insert(
            server.name.clone(),
            serde_json::json!({
                "command": server.command,
                "args": server.args,
                "env": server.env,
            }),
        );
    }

    let mcp_config = serde_json::json!({ "mcpServers": mcp_map });
    let json = serde_json::to_string_pretty(&mcp_config).map_err(|e| format!("JSON: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("Write .mcp.json: {}", e))?;
    Ok(())
}

fn write_global_settings(config: &ProjectConfigInput) -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let claude_dir = home.join(".claude");
    fs::create_dir_all(&claude_dir).map_err(|e| format!("Create .claude: {}", e))?;

    let path = claude_dir.join("settings.json");
    let mut settings: serde_json::Value = if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| format!("Read global: {}", e))?;
        serde_json::from_str(&content).unwrap_or(serde_json::Value::Object(serde_json::Map::new()))
    } else {
        serde_json::Value::Object(serde_json::Map::new())
    };

    let obj = settings
        .as_object_mut()
        .ok_or("Global settings is not an object")?;

    if !config.advisor_model.is_empty() {
        obj.insert("advisorModel".into(), serde_json::Value::String(config.advisor_model.clone()));
    }

    let json = serde_json::to_string_pretty(&settings).map_err(|e| format!("JSON: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("Write global: {}", e))?;
    Ok(())
}

// ========== Read Config ==========

#[tauri::command]
pub fn read_project_config(project_path: String) -> Result<serde_json::Value, String> {
    log::info!("read_project_config: path={}", project_path);
    let path = PathBuf::from(&project_path);
    let claude_dir = path.join(".claude");
    let mut result = serde_json::Map::new();

    let settings_path = claude_dir.join("settings.json");
    if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| format!("Read: {}", e))?;
        result.insert("settings".into(), serde_json::from_str(&content).unwrap_or(serde_json::Value::Null));
    }

    let local_path = claude_dir.join("settings.local.json");
    if local_path.exists() {
        let content = fs::read_to_string(&local_path).map_err(|e| format!("Read: {}", e))?;
        result.insert("localSettings".into(), serde_json::from_str(&content).unwrap_or(serde_json::Value::Null));
    }

    let claude_md_path = path.join("CLAUDE.md");
    if claude_md_path.exists() {
        let content = fs::read_to_string(&claude_md_path).map_err(|e| format!("Read: {}", e))?;
        result.insert("claudeMd".into(), serde_json::Value::String(content));
    }

    let mcp_path = path.join(".mcp.json");
    if mcp_path.exists() {
        let content = fs::read_to_string(&mcp_path).map_err(|e| format!("Read: {}", e))?;
        result.insert("mcpConfig".into(), serde_json::from_str(&content).unwrap_or(serde_json::Value::Null));
    }

    let claude_mcp_path = claude_dir.join("mcp.json");
    if claude_mcp_path.exists() {
        let content = fs::read_to_string(&claude_mcp_path).map_err(|e| format!("Read: {}", e))?;
        // Merge into mcpConfig, .claude/mcp.json takes priority
        let claude_mcp: serde_json::Value = serde_json::from_str(&content).unwrap_or(serde_json::Value::Null);
        if let Some(existing) = result.get_mut("mcpConfig") {
            if let (Some(ex_obj), Some(cm_obj)) = (existing.as_object_mut(), claude_mcp.as_object()) {
                for (k, v) in cm_obj {
                    ex_obj.insert(k.clone(), v.clone());
                }
            }
        } else {
            result.insert("mcpConfig".into(), claude_mcp);
        }
    }

    // Read skills from .claude/skills/*/SKILL.md
    let skills_dir = claude_dir.join("skills");
    if skills_dir.exists() {
        let mut skills_list = Vec::new();
        if let Ok(entries) = fs::read_dir(&skills_dir) {
            for entry in entries.flatten() {
                let skill_path = entry.path().join("SKILL.md");
                if skill_path.exists() {
                    let content = fs::read_to_string(&skill_path).unwrap_or_default();
                    let name = entry.path().file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();
                    skills_list.push(serde_json::json!({
                        "name": name,
                        "content": content,
                    }));
                }
            }
        }
        if !skills_list.is_empty() {
            result.insert("skills".into(), serde_json::Value::Array(skills_list));
        }
    }

    Ok(serde_json::Value::Object(result))
}
