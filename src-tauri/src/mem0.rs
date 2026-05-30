use std::process::Command;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Mem0AddRequest {
    pub content: String,
    pub user_id: String,
    pub agent_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Mem0SearchRequest {
    pub query: String,
    pub user_id: String,
    pub agent_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Mem0DeleteRequest {
    pub memory_id: String,
    pub user_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Mem0Memory {
    pub id: String,
    pub memory: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

fn escape_shell_arg(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', "\\n")
}

/// Run a mem0 CLI command through powershell.exe so PATH is inherited
fn run_mem0(args: &[String]) -> Result<std::process::Output, String> {
    let parts: Vec<String> = args.iter().map(|a| escape_shell_arg(a)).collect();
    let cmd = format!("mem0 {} 2>&1", parts.join(" "));
    Command::new("powershell.exe")
        .args(["-Command", &cmd])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .output()
        .map_err(|e| format!("Failed to run mem0: {}", e))
}

/// Run an arbitrary command through powershell.exe
fn run_powershell(cmd: &str) -> Result<std::process::Output, String> {
    Command::new("powershell.exe")
        .args(["-Command", cmd])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .output()
        .map_err(|e| format!("PowerShell failed: {}", e))
}

/// Extract the combined output text (powershell with 2>&1 sends everything to stdout)
fn output_text(output: &std::process::Output) -> String {
    String::from_utf8_lossy(&output.stdout).trim().to_string()
}

/// Check if mem0 CLI is installed AND configured (has API key)
#[tauri::command]
pub async fn check_mem0_installed() -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let args = vec!["status".into()];
        match run_mem0(&args) {
            Ok(o) => {
                let ok = o.status.success();
                log::info!("mem0 status check: installed={}", ok);
                Ok(ok)
            }
            Err(e) => {
                log::warn!("mem0 status check failed: {}", e);
                Ok(false)
            }
        }
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

#[tauri::command]
pub async fn get_mem0_version() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let args = vec!["--version".into()];
        let output = run_mem0(&args)?;
        if output.status.success() {
            let v = output_text(&output);
            Ok(if v.is_empty() { "unknown".into() } else { v })
        } else {
            Err("mem0 not found".into())
        }
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

/// Install mem0 CLI and run `mem0 init --agent --force` to auto-configure
#[tauri::command]
pub async fn install_mem0() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        log::info!("Installing @mem0/cli via npm...");

        // Step 1: Install via npm
        let output = run_powershell("npm install -g @mem0/cli 2>&1")?;
        if !output.status.success() {
            let err = if output_text(&output).is_empty() {
                "Install failed".into()
            } else {
                output_text(&output)
            };
            log::error!("npm install failed: {}", err);
            return Err(err);
        }
        log::info!("npm install succeeded");

        // Step 2: Run mem0 init --agent --force to bootstrap API key
        let init_args = vec![
            "init".into(),
            "--agent".into(),
            "--force".into(),
        ];
        let init_output = run_mem0(&init_args)?;
        if !init_output.status.success() {
            let err = if output_text(&init_output).is_empty() {
                "mem0 init failed — try running 'mem0 init' manually".into()
            } else {
                output_text(&init_output)
            };
            log::error!("mem0 init failed: {}", err);
            return Err(err);
        }
        log::info!("mem0 init --agent succeeded");

        Ok(output_text(&output))
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

#[tauri::command]
pub async fn uninstall_mem0() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        log::info!("Uninstalling @mem0/cli...");
        let output = run_powershell("npm uninstall -g @mem0/cli 2>&1")?;
        if output.status.success() {
            log::info!("mem0 uninstalled");
            Ok("uninstalled".into())
        } else {
            let err = if output_text(&output).is_empty() {
                "Uninstall failed".into()
            } else {
                output_text(&output)
            };
            log::error!("mem0 uninstall failed: {}", err);
            Err(err)
        }
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

#[tauri::command]
pub async fn mem0_add(req: Mem0AddRequest) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        log::info!("mem0 add: user={}, agent={:?}", req.user_id, req.agent_id);
        let mut args = vec![
            "add".into(),
            req.content.clone(),
            "--user-id".into(),
            req.user_id.clone(),
        ];
        if let Some(ref agent_id) = req.agent_id {
            args.push("--agent-id".into());
            args.push(agent_id.clone());
        }
        let output = run_mem0(&args)?;
        if output.status.success() {
            log::info!("mem0 add succeeded");
            Ok(output_text(&output))
        } else {
            let err = if output_text(&output).is_empty() {
                "mem0 add failed".into()
            } else {
                output_text(&output)
            };
            log::error!("mem0 add failed: {}", err);
            Err(err)
        }
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

/// mem0 search returns a raw JSON array of memory objects
#[tauri::command]
pub async fn mem0_search(req: Mem0SearchRequest) -> Result<Vec<Mem0Memory>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        log::info!("mem0 search: query={}", req.query);
        let mut args = vec![
            "search".into(),
            req.query.clone(),
            "--user-id".into(),
            req.user_id.clone(),
            "--output".into(),
            "json".into(),
        ];
        if let Some(ref agent_id) = req.agent_id {
            args.push("--agent-id".into());
            args.push(agent_id.clone());
        }
        let output = run_mem0(&args)?;
        if output.status.success() {
            let stdout = output_text(&output);
            // Strip non-JSON lines (CLI prefixes like "- Searching...")
            let json_start = stdout.find('[').unwrap_or(0);
            let json_str = &stdout[json_start..];
            if json_str.is_empty() || json_str == "[]" {
                return Ok(vec![]);
            }
            match serde_json::from_str::<Vec<Mem0Memory>>(json_str) {
                Ok(memories) => {
                    log::info!("mem0 search returned {} results", memories.len());
                    Ok(memories)
                }
                Err(e) => {
                    log::error!("mem0 search parse failed: {}", e);
                    Err(format!("Parse mem0 output failed: {}", e))
                }
            }
        } else {
            let err = if output_text(&output).is_empty() {
                "mem0 search failed".into()
            } else {
                output_text(&output)
            };
            log::error!("mem0 search failed: {}", err);
            Err(err)
        }
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

/// mem0 delete takes memory ID as positional arg
#[tauri::command]
pub async fn mem0_delete(req: Mem0DeleteRequest) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        log::info!("mem0 delete: id={}", req.memory_id);
        let args = vec![
            "delete".into(),
            req.memory_id.clone(),
            "--user-id".into(),
            req.user_id.clone(),
            "--force".into(),
        ];
        let output = run_mem0(&args)?;
        if output.status.success() {
            log::info!("mem0 delete succeeded");
            Ok("deleted".into())
        } else {
            let err = if output_text(&output).is_empty() {
                "mem0 delete failed".into()
            } else {
                output_text(&output)
            };
            log::error!("mem0 delete failed: {}", err);
            Err(err)
        }
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

/// mem0 list returns { status, data: [...] } wrapper
#[tauri::command]
pub async fn mem0_get_all(user_id: String, agent_id: Option<String>) -> Result<Vec<Mem0Memory>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        log::info!("mem0 list: user={}, agent={:?}", user_id, agent_id);
        let mut args = vec![
            "list".into(),
            "--user-id".into(),
            user_id.clone(),
            "--output".into(),
            "json".into(),
        ];
        if let Some(ref aid) = agent_id {
            args.push("--agent-id".into());
            args.push(aid.clone());
        }
        let output = run_mem0(&args)?;
        if output.status.success() {
            let stdout = output_text(&output);
            // Find the JSON object — skip CLI prefix lines like "- Listing..."
            let json_start = stdout.find('{').unwrap_or(0);
            let json_str = &stdout[json_start..];
            if json_str.is_empty() {
                return Ok(vec![]);
            }
            // Parse the wrapper: { status, data: [...] }
            let wrapper: serde_json::Value = serde_json::from_str(json_str)
                .map_err(|e| {
                    log::error!("mem0 list parse failed: {}", e);
                    format!("Parse mem0 list output failed: {}", e)
                })?;
            let data = wrapper.get("data")
                .and_then(|d| d.as_array())
                .cloned()
                .unwrap_or_default();
            let memories: Vec<Mem0Memory> = serde_json::from_value(serde_json::Value::Array(data))
                .map_err(|e| {
                    log::error!("mem0 list data parse failed: {}", e);
                    format!("Parse mem0 list data failed: {}", e)
                })?;
            log::info!("mem0 list returned {} memories", memories.len());
            Ok(memories)
        } else {
            let err = if output_text(&output).is_empty() {
                "mem0 list failed".into()
            } else {
                output_text(&output)
            };
            log::error!("mem0 list failed: {}", err);
            Err(err)
        }
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}
