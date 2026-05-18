use std::path::PathBuf;

use crate::types::CcSwitchProvider;

fn cc_switch_db_path() -> Result<PathBuf, String> {
    if let Ok(profile) = std::env::var("USERPROFILE") {
        let p = PathBuf::from(profile)
            .join(".cc-switch")
            .join("cc-switch.db");
        if p.exists() {
            return Ok(p);
        }
    }
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let p = home.join(".cc-switch").join("cc-switch.db");
    if p.exists() {
        Ok(p)
    } else {
        Err("CC Switch database not found. Is CC Switch installed?".into())
    }
}

#[tauri::command]
pub fn read_cc_switch_providers() -> Result<Vec<CcSwitchProvider>, String> {
    let db_path = cc_switch_db_path()?;
    let conn =
        rusqlite::Connection::open_with_flags(&db_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|e| format!("Failed to open CC Switch DB: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, app_type, name, settings_config, is_current, icon, icon_color, category, meta \
             FROM providers ORDER BY sort_index ASC, created_at ASC",
        )
        .map_err(|e| format!("Query error: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let app_type: String = row.get(1)?;
            let name: String = row.get(2)?;
            let settings_config: String = row.get(3)?;
            let is_current: bool = row.get(4)?;
            let icon: Option<String> = row.get(5)?;
            let icon_color: Option<String> = row.get(6)?;
            let category: Option<String> = row.get(7)?;
            let meta: Option<String> = row.get(8)?;

            let sc: serde_json::Value =
                serde_json::from_str(&settings_config).unwrap_or(serde_json::Value::Null);

            let env = sc
                .get("env")
                .cloned()
                .unwrap_or(serde_json::Value::Object(serde_json::Map::new()));

            let base_url = env
                .get("ANTHROPIC_BASE_URL")
                .or_else(|| env.get("base_url"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let api_key = env
                .get("ANTHROPIC_AUTH_TOKEN")
                .or_else(|| env.get("ANTHROPIC_API_KEY"))
                .or_else(|| env.get("apiKey"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let model = env
                .get("ANTHROPIC_MODEL")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let api_format = meta.as_ref().and_then(|m| {
                serde_json::from_str::<serde_json::Value>(m)
                    .ok()
                    .and_then(|v| {
                        v.get("apiFormat")
                            .and_then(|f| f.as_str())
                            .map(|s| s.to_string())
                    })
            });

            Ok(CcSwitchProvider {
                id,
                app_type,
                name,
                base_url,
                api_key,
                model,
                is_current,
                icon,
                icon_color,
                category,
                api_format,
            })
        })
        .map_err(|e| format!("Row error: {}", e))?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| format!("Parse error: {}", e))?);
    }
    Ok(result)
}
