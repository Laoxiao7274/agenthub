use std::fs;
use std::path::PathBuf;

use crate::types::InitStep;

// ========== Project Initialization ==========

#[tauri::command]
pub fn delete_folder(path: String) -> Result<String, String> {
    let path = PathBuf::from(&path);
    if path.exists() {
        fs::remove_dir_all(&path).map_err(|e| format!("Delete failed: {}", e))?;
        Ok(format!("Deleted {}", path.display()))
    } else {
        Ok("Path does not exist".into())
    }
}

#[tauri::command]
pub fn ensure_folder(path: String) -> Result<String, String> {
    let path = PathBuf::from(&path);
    fs::create_dir_all(&path).map_err(|e| format!("Create folder failed: {}", e))?;
    Ok(format!("Folder ensured: {}", path.display()))
}

/// Download a single skill from skillhub into the project's .claude/skills/ directory.
/// Copies the entire skill directory (SKILL.md + references/ templates/ scripts/ etc.)
fn download_skill(claude_dir: &std::path::Path, slug: &str, step: &mut InitStep) {
    let skills_dir = claude_dir.join(format!("skills/{}", slug));

    if skills_dir.join("SKILL.md").exists() {
        step.status = "skipped".into();
        step.message = format!("{} already exists", slug);
        return;
    }

    step.status = "running".into();
    let tmp_zip = claude_dir.join(format!("{}-{}.zip", slug, std::process::id()));
    let tmp_dir = claude_dir.join(format!("{}-tmp-{}", slug, std::process::id()));

    let dl_output = std::process::Command::new("powershell.exe")
        .args([
            "-Command",
            &format!(
                "try {{ Invoke-WebRequest -Uri 'https://lightmake.site/api/v1/download?slug={}' -TimeoutSec 30 -MaximumRedirection 5 -OutFile '{}' }} catch {{ exit 1 }}",
                slug,
                tmp_zip.to_string_lossy()
            ),
        ])
        .output();

    let downloaded = match dl_output {
        Ok(output) if output.status.success() && tmp_zip.exists() => true,
        _ => false,
    };

    if downloaded {
        let extract_output = std::process::Command::new("powershell.exe")
            .args([
                "-Command",
                &format!(
                    "Expand-Archive -Path '{}' -DestinationPath '{}' -Force",
                    tmp_zip.to_string_lossy(),
                    tmp_dir.to_string_lossy()
                ),
            ])
            .output();

        let mut found = false;
        if let Ok(ext_out) = extract_output {
            if ext_out.status.success() {
                // Check if the extracted root itself contains SKILL.md
                if tmp_dir.join("SKILL.md").exists() {
                    // Copy entire extracted directory tree to skills_dir
                    found = copy_dir_recursive(&tmp_dir, &skills_dir);
                } else if let Ok(entries) = fs::read_dir(&tmp_dir) {
                    // Look for a subdirectory containing SKILL.md
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_dir() && path.join("SKILL.md").exists() {
                            found = copy_dir_recursive(&path, &skills_dir);
                            break;
                        }
                    }
                }
            }
        }

        if found {
            step.status = "done".into();
            step.message = format!("{} installed", slug);
        } else {
            step.status = "failed".into();
            step.message = format!("{} downloaded but extraction failed", slug);
        }
    } else {
        step.status = "failed".into();
        step.message = format!("{} download failed", slug);
    }

    let _ = fs::remove_file(&tmp_zip);
    let _ = fs::remove_dir_all(&tmp_dir);
}

/// Recursively copy a directory tree from src to dst.
pub fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> bool {
    if fs::create_dir_all(dst).is_err() {
        return false;
    }
    if let Ok(entries) = fs::read_dir(src) {
        for entry in entries.flatten() {
            let src_path = entry.path();
            let dst_path = dst.join(src_path.file_name().unwrap_or_default());
            if src_path.is_dir() {
                if !copy_dir_recursive(&src_path, &dst_path) {
                    return false;
                }
            } else if fs::copy(&src_path, &dst_path).is_err() {
                return false;
            }
        }
        true
    } else {
        false
    }
}

const DEFAULT_SKILLS: &[&str] = &["find-skills", "self-improving-agent"];

#[tauri::command]
pub async fn init_project(project_path: String) -> Result<Vec<InitStep>, String> {
    let project_path = PathBuf::from(&project_path);
    let claude_dir = project_path.join(".claude");
    let steps: Vec<InitStep> = DEFAULT_SKILLS
        .iter()
        .map(|&slug| InitStep {
            step: slug.into(),
            status: "pending".into(),
            message: format!("Download {} skill", slug),
        })
        .collect();

    let steps = tauri::async_runtime::spawn(async move {
        let result: Result<Vec<InitStep>, String> = std::thread::spawn(move || {
            let mut steps = steps;
            for step in steps.iter_mut() {
                let slug = step.step.clone();
                download_skill(&claude_dir, &slug, step);
            }
            Ok(steps)
        })
        .join()
        .map_err(|_| "Download thread panicked".to_string())?;

        result
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    Ok(steps)
}

#[tauri::command]
pub fn check_skillhub_installed() -> Result<bool, String> {
    let output = std::process::Command::new("wsl.exe")
        .args(["-e", "bash", "-c", "test -d $HOME/.hermes/skills && echo yes || echo no"])
        .output()
        .map_err(|e| format!("WSL check failed: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(stdout == "yes")
}

// ========== Misc Commands ==========

#[tauri::command]
pub async fn test_api(base_url: String, api_key: String, model: String) -> Result<String, String> {
    if base_url.is_empty() || api_key.is_empty() || model.is_empty() {
        return Err("Base URL, API Key and Model are required".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
        let body = format!(
            r#"{{"model":"{}","messages":[{{"role":"user","content":"hi"}}],"max_tokens":5}}"#,
            model
        );
        let output = std::process::Command::new("powershell.exe")
            .args([
                "-Command",
                &format!(
                    "try {{ $r = Invoke-RestMethod -Uri '{}' -Method Post -Headers @{{'Authorization'='Bearer {}';'Content-Type'='application/json'}} -Body '{}' -TimeoutSec 15; $r.choices[0].message.content }} catch {{ Write-Error $_.Exception.Message; exit 1 }}",
                    url, api_key, body
                ),
            ])
            .output()
            .map_err(|e| format!("PowerShell failed: {}", e))?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            Ok(if stdout.is_empty() { "API connected (empty response)".into() } else { stdout })
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            Err(if stderr.is_empty() { "API test failed".into() } else { stderr })
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn init_agent(project_path: String) -> Result<String, String> {
    let path = PathBuf::from(&project_path);
    if !path.exists() {
        return Err(format!("Project path does not exist: {}", path.display()));
    }
    tauri::async_runtime::spawn_blocking(move || {
        // Step 1: /init
        let init_out = std::process::Command::new("claude")
            .args(["-p", "/init", "--dangerously-skip-permissions"])
            .current_dir(&path)
            .stdin(std::process::Stdio::null())
            .output()
            .map_err(|e| format!("Failed to run claude /init: {}. Is Claude Code installed?", e))?;
        if !init_out.status.success() {
            let stderr = String::from_utf8_lossy(&init_out.stderr).trim().to_string();
            let stdout = String::from_utf8_lossy(&init_out.stdout).trim().to_string();
            let msg = if !stderr.is_empty() { &stderr } else { &stdout };
            return Err(format!("claude /init failed: {}", msg));
        }

        // Step 2: /self-improving-agent
        let sia_out = std::process::Command::new("claude")
            .args(["-p", "/self-improving-agent", "--dangerously-skip-permissions"])
            .current_dir(&path)
            .stdin(std::process::Stdio::null())
            .output()
            .map_err(|e| format!("Failed to run claude /self-improving-agent: {}", e))?;
        if !sia_out.status.success() {
            let stderr = String::from_utf8_lossy(&sia_out.stderr).trim().to_string();
            let stdout = String::from_utf8_lossy(&sia_out.stdout).trim().to_string();
            let msg = if !stderr.is_empty() { &stderr } else { &stdout };
            return Err(format!("claude /self-improving-agent failed: {}", msg));
        }

        Ok("Agent initialized".into())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub fn open_folder(path: String) -> Result<String, String> {
    let path = PathBuf::from(&path);
    if !path.exists() {
        return Err(format!("Path does not exist: {}", path.display()));
    }
    std::process::Command::new("explorer.exe")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open folder: {}", e))?;
    Ok(format!("Opened {}", path.display()))
}

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to AgentHub.", name)
}

/// Read Claude Code memory data from project directory.
/// Returns: autoMemories from ~/.claude/projects/{hash}/memory/
#[tauri::command]
pub fn read_claude_memory(project_path: String) -> Result<serde_json::Value, String> {
    let path = PathBuf::from(&project_path);

    // Compute the memory dir: ~/.claude/projects/{path-hash}/memory/
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let claude_projects_dir = home.join(".claude").join("projects");

    // Hash the project path the same way Claude Code does
    // Claude Code replaces : / \ and non-ASCII chars each with a single -
    let raw = path.to_string_lossy();
    let path_hash: String = raw.chars()
        .map(|c| if c.is_ascii() && ![':', '/', '\\'].contains(&c) { c } else { '-' })
        .collect();
    let memory_dir = claude_projects_dir.join(&path_hash).join("memory");

    let mut auto_memories = Vec::new();
    if memory_dir.exists() {
        if let Ok(entries) = fs::read_dir(&memory_dir) {
            for entry in entries.flatten() {
                let entry_path = entry.path();
                if entry_path.is_file() {
                    let name = entry_path.file_name().unwrap_or_default().to_string_lossy().to_string();
                    let content = fs::read_to_string(&entry_path).unwrap_or_default();
                    auto_memories.push(serde_json::json!({
                        "name": name,
                        "content": content,
                    }));
                }
            }
        }
    }

    let mut result = serde_json::Map::new();
    result.insert("autoMemories".into(), serde_json::Value::Array(auto_memories));

    Ok(serde_json::Value::Object(result))
}

/// List Claude Code sessions for a project.
#[tauri::command]
pub fn list_claude_sessions(project_path: String) -> Result<serde_json::Value, String> {
    log::info!("list_claude_sessions: path={}", project_path);
    let path = PathBuf::from(&project_path);
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let claude_projects_dir = home.join(".claude").join("projects");
    let path_hash: String = path.to_string_lossy()
        .chars()
        .map(|c| if c.is_ascii() && ![':', '/', '\\'].contains(&c) { c } else { '-' })
        .collect();
    let project_dir = claude_projects_dir.join(&path_hash);

    let mut sessions = Vec::new();
    if project_dir.exists() {
        if let Ok(entries) = fs::read_dir(&project_dir) {
            for entry in entries.flatten() {
                let entry_path = entry.path();
                if entry_path.extension().and_then(|e| e.to_str()) == Some("jsonl") {
                    let session_id = entry_path.file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("")
                        .to_string();

                    // Read first few lines to extract metadata
                    let metadata = fs::File::open(&entry_path)
                        .ok()
                        .and_then(|file| {
                            use std::io::{BufRead, BufReader};
                            let reader = BufReader::new(file);
                            let mut first_user_msg = String::new();
                            let mut timestamp = String::new();
                            let mut permission_mode = String::new();
                            for line in reader.lines().take(50) {
                                if let Ok(line) = line {
                                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                                        // Extract permission-mode from initial line
                                        if json.get("type").and_then(|v| v.as_str()) == Some("permission-mode") {
                                            permission_mode = json.get("permissionMode")
                                                .and_then(|v| v.as_str()).unwrap_or("").to_string();
                                        }
                                        // Extract first user message
                                        if json.get("type").and_then(|v| v.as_str()) == Some("user") && first_user_msg.is_empty() {
                                            if let Some(content) = json.get("message").and_then(|m| m.get("content")) {
                                                // content can be a string or an array of blocks
                                                if let Some(s) = content.as_str() {
                                                    first_user_msg = s.chars().take(120).collect();
                                                } else if let Some(arr) = content.as_array() {
                                                    for block in arr {
                                                        if block.get("type").and_then(|t| t.as_str()) == Some("text") {
                                                            if let Some(text) = block.get("text").and_then(|t| t.as_str()) {
                                                                first_user_msg = text.chars().take(120).collect();
                                                                break;
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                            timestamp = json.get("timestamp")
                                                .and_then(|v| v.as_str()).unwrap_or("").to_string();
                                            if permission_mode.is_empty() {
                                                permission_mode = json.get("permissionMode")
                                                    .and_then(|v| v.as_str()).unwrap_or("").to_string();
                                            }
                                        }
                                    }
                                }
                            }
                            Some((first_user_msg, timestamp, permission_mode))
                        });

                    let (first_msg, ts, perm) = metadata.unwrap_or((String::new(), String::new(), String::new()));
                    let file_size = entry_path.metadata().map(|m| m.len()).unwrap_or(0);

                    sessions.push(serde_json::json!({
                        "id": session_id,
                        "firstMessage": first_msg,
                        "timestamp": ts,
                        "permissionMode": perm,
                        "sizeBytes": file_size,
                    }));
                }
            }
        }
    }

    // Sort by timestamp descending
    sessions.sort_by(|a, b| {
        let ta = a.get("timestamp").and_then(|v| v.as_str()).unwrap_or("");
        let tb = b.get("timestamp").and_then(|v| v.as_str()).unwrap_or("");
        tb.cmp(ta)
    });

    Ok(serde_json::Value::Array(sessions))
}

/// Resume a Claude Code session by spawning `claude --resume {session_id}`
#[tauri::command]
pub fn resume_claude_session(project_path: String, session_id: String, model: String, api_key: String) -> Result<u32, String> {
    let path = PathBuf::from(&project_path);
    if !path.exists() {
        return Err(format!("Project path does not exist: {}", path.display()));
    }

    // Build claude command args
    let mut args: Vec<String> = vec!["--resume".into(), session_id.clone()];
    if !model.is_empty() {
        args.push("--model".into());
        args.push(model.clone());
    }
    let args_str = args.join(" ");
    let claude_cmd = format!("claude {}", args_str);

    // On Windows, use cmd /k to keep console open after command finishes
    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = std::process::Command::new("cmd");
        c.args(["/k", &claude_cmd]);
        c.current_dir(&path);
        if !api_key.is_empty() {
            c.env_remove("ANTHROPIC_AUTH_TOKEN");
        }
        use std::os::windows::process::CommandExt;
        c.creation_flags(0x00000010); // CREATE_NEW_CONSOLE
        c
    };

    #[cfg(not(target_os = "windows"))]
    let mut cmd = {
        let mut c = std::process::Command::new("claude");
        c.arg("--resume").arg(&session_id);
        c.current_dir(&path);
        if !model.is_empty() {
            c.arg("--model").arg(&model);
        }
        if !api_key.is_empty() {
            c.env_remove("ANTHROPIC_AUTH_TOKEN");
        }
        c
    };

    cmd.stdin(std::process::Stdio::inherit())
        .stdout(std::process::Stdio::inherit())
        .stderr(std::process::Stdio::inherit());

    let child = cmd.spawn().map_err(|e| format!("Failed to start claude --resume: {}. Is Claude Code installed?", e))?;
    let pid = child.id();

    Ok(pid)
}

/// Read full session content from a JSONL session file.
/// Returns an array of messages: [{ role, content, timestamp }, ...]
#[tauri::command]
pub fn read_claude_session(project_path: String, session_id: String) -> Result<serde_json::Value, String> {
    log::info!("read_claude_session: path={}, session={}", project_path, session_id);
    let path = PathBuf::from(&project_path);
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let claude_projects_dir = home.join(".claude").join("projects");
    let path_hash: String = path.to_string_lossy()
        .chars()
        .map(|c| if c.is_ascii() && ![':', '/', '\\'].contains(&c) { c } else { '-' })
        .collect();
    let session_file = claude_projects_dir.join(&path_hash).join(format!("{}.jsonl", session_id));

    if !session_file.exists() {
        return Err(format!("Session file not found: {}", session_file.display()));
    }

    use std::io::{BufRead, BufReader};
    let file = fs::File::open(&session_file).map_err(|e| format!("Open failed: {}", e))?;
    let reader = BufReader::new(file);

    let mut messages = Vec::new();
    for line in reader.lines() {
        let line = match line { Ok(l) => l, Err(_) => continue };
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
            let msg_type = json.get("type").and_then(|v| v.as_str()).unwrap_or("");
            if msg_type == "user" || msg_type == "assistant" {
                if let Some(message) = json.get("message") {
                    let role = message.get("role").and_then(|v| v.as_str()).unwrap_or(msg_type);
                    let content = message.get("content");
                    let text = match content {
                        Some(c) if c.is_string() => c.as_str().unwrap_or("").to_string(),
                        Some(c) if c.is_array() => {
                            let parts: Vec<String> = c.as_array().unwrap_or(&vec![])
                                .iter()
                                .filter_map(|block| {
                                    if block.get("type").and_then(|t| t.as_str()) == Some("text") {
                                        block.get("text").and_then(|t| t.as_str()).map(|s| s.to_string())
                                    } else {
                                        None
                                    }
                                })
                                .collect();
                            parts.join("\n")
                        }
                        _ => String::new(),
                    };
                    let timestamp = json.get("timestamp").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    // Skip empty system/meta messages
                    if !text.is_empty() {
                        messages.push(serde_json::json!({
                            "role": role,
                            "content": text,
                            "timestamp": timestamp,
                        }));
                    }
                }
            }
        }
    }

    Ok(serde_json::Value::Array(messages))
}

/// Import a skill from a local ZIP file into the project's .claude/skills/ directory.
#[tauri::command]
pub fn import_skill_zip(project_path: String, zip_path: String) -> Result<String, String> {
    let zip_path = PathBuf::from(&zip_path);
    if !zip_path.exists() {
        return Err(format!("ZIP file not found: {}", zip_path.display()));
    }

    let claude_dir = PathBuf::from(&project_path).join(".claude");
    let skills_dir = claude_dir.join("skills");
    let _ = fs::create_dir_all(&skills_dir);

    let tmp_dir = claude_dir.join(format!("import-tmp-{}", std::process::id()));

    let extract_output = std::process::Command::new("powershell.exe")
        .args([
            "-Command",
            &format!(
                "Expand-Archive -Path '{}' -DestinationPath '{}' -Force",
                zip_path.to_string_lossy(),
                tmp_dir.to_string_lossy()
            ),
        ])
        .output()
        .map_err(|e| format!("Extract failed: {}", e))?;

    if !extract_output.status.success() {
        let stderr = String::from_utf8_lossy(&extract_output.stderr).trim().to_string();
        let _ = fs::remove_dir_all(&tmp_dir);
        return Err(format!("Failed to extract ZIP: {}", stderr));
    }

    let mut skill_name = String::new();
    let mut found = false;

    if tmp_dir.join("SKILL.md").exists() {
        if let Some(name) = zip_path.file_stem().and_then(|n| n.to_str()) {
            skill_name = name.to_string();
        }
        found = copy_dir_recursive(&tmp_dir, &skills_dir.join(&skill_name));
    } else if let Ok(entries) = fs::read_dir(&tmp_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() && path.join("SKILL.md").exists() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    skill_name = name.to_string();
                }
                found = copy_dir_recursive(&path, &skills_dir.join(&skill_name));
                break;
            }
        }
    }

    let _ = fs::remove_dir_all(&tmp_dir);

    if found {
        Ok(skill_name)
    } else {
        Err("No SKILL.md found in ZIP archive".into())
    }
}

/// Import a skill from skillhub by slug into the project's .claude/skills/ directory.
#[tauri::command]
pub fn import_skill_slug(project_path: String, slug: String) -> Result<String, String> {
    let claude_dir = PathBuf::from(&project_path).join(".claude");
    let skills_dir = claude_dir.join("skills");
    let _ = fs::create_dir_all(&skills_dir);

    let target_dir = skills_dir.join(&slug);
    if target_dir.join("SKILL.md").exists() {
        return Ok(slug);
    }

    let tmp_zip = claude_dir.join(format!("{}-{}.zip", slug, std::process::id()));
    let tmp_dir = claude_dir.join(format!("{}-tmp-{}", slug, std::process::id()));

    let dl_output = std::process::Command::new("powershell.exe")
        .args([
            "-Command",
            &format!(
                "try {{ Invoke-WebRequest -Uri 'https://lightmake.site/api/v1/download?slug={}' -TimeoutSec 30 -MaximumRedirection 5 -OutFile '{}' }} catch {{ exit 1 }}",
                slug,
                tmp_zip.to_string_lossy()
            ),
        ])
        .output();

    let downloaded = match dl_output {
        Ok(output) if output.status.success() && tmp_zip.exists() => true,
        _ => {
            let _ = fs::remove_file(&tmp_zip);
            return Err(format!("Failed to download skill: {}", slug));
        }
    };

    if !downloaded {
        let _ = fs::remove_file(&tmp_zip);
        return Err(format!("Failed to download skill: {}", slug));
    }

    let extract_output = std::process::Command::new("powershell.exe")
        .args([
            "-Command",
            &format!(
                "Expand-Archive -Path '{}' -DestinationPath '{}' -Force",
                tmp_zip.to_string_lossy(),
                tmp_dir.to_string_lossy()
            ),
        ])
        .output();

    let mut found = false;
    if let Ok(ext_out) = extract_output {
        if ext_out.status.success() {
            if tmp_dir.join("SKILL.md").exists() {
                found = copy_dir_recursive(&tmp_dir, &target_dir);
            } else if let Ok(entries) = fs::read_dir(&tmp_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() && path.join("SKILL.md").exists() {
                        found = copy_dir_recursive(&path, &target_dir);
                        break;
                    }
                }
            }
        }
    }

    let _ = fs::remove_file(&tmp_zip);
    let _ = fs::remove_dir_all(&tmp_dir);

    if found {
        Ok(slug)
    } else {
        Err(format!("Failed to install skill: {}", slug))
    }
}

/// Install agent-mem0 MCP config and skill into a project directory.
/// Writes .claude/mcp.json and .claude/skills/agent-memory/SKILL.md
#[tauri::command]
pub fn install_agent_mem0(project_path: String, project_name: String) -> Result<String, String> {
    let dir = PathBuf::from(&project_path);
    if !dir.exists() {
        return Err(format!("Project directory does not exist: {}", project_path));
    }

    // Ensure .claude/ directory exists
    let claude_dir = dir.join(".claude");
    fs::create_dir_all(&claude_dir).map_err(|e| format!("Failed to create .claude dir: {}", e))?;

    // 1. Write .claude/mcp.json
    let mcp_path = claude_dir.join("mcp.json");
    let new_entry = serde_json::json!({
        "command": "python",
        "args": ["-m", "agent_mem0", "serve", "--project", project_name]
    });

    let mcp_content = if mcp_path.exists() {
        let existing: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(&mcp_path).map_err(|e| e.to_string())?
        ).unwrap_or(serde_json::json!({}));

        let mut merged = existing;
        if merged.get("mcpServers").is_none() {
            merged["mcpServers"] = serde_json::json!({});
        }
        // Remove null/empty entries
        if let Some(servers) = merged.get_mut("mcpServers").and_then(|s| s.as_object_mut()) {
            servers.retain(|_, v| v.is_object() && !v.as_object().map_or(true, |o| o.is_empty()));
        }
        merged["mcpServers"]["agent-memory"] = new_entry;
        serde_json::to_string_pretty(&merged).unwrap_or_default()
    } else {
        let entry = serde_json::json!({
            "mcpServers": {
                "agent-memory": new_entry
            }
        });
        serde_json::to_string_pretty(&entry).unwrap_or_default()
    };

    fs::write(&mcp_path, mcp_content).map_err(|e| format!("Failed to write mcp.json: {}", e))?;

    // 2. Write .claude/skills/agent-memory/SKILL.md
    let skill_dir = dir.join(".claude").join("skills").join("agent-memory");
    fs::create_dir_all(&skill_dir).map_err(|e| format!("Failed to create skill dir: {}", e))?;

    let skill_content = include_str!("../templates/agent_memory_skill.md");
    let skill_path = skill_dir.join("SKILL.md");
    fs::write(&skill_path, skill_content).map_err(|e| format!("Failed to write SKILL.md: {}", e))?;

    Ok(format!("agent-mem0 installed to {}", project_path))
}

/// Ensure a project link (junction) exists for paths with non-ASCII characters.
/// Returns the path to use for Claude Code operations (junction path or original path).
#[tauri::command]
pub fn ensure_project_link(display_path: String) -> Result<String, String> {
    let path = PathBuf::from(&display_path);

    // Check if path contains non-ASCII characters
    let has_non_ascii = display_path.chars().any(|c| !c.is_ascii());
    if !has_non_ascii {
        return Ok(display_path);
    }

    // Generate a deterministic ASCII-only junction name using FNV-1a hash
    // This ensures each unique path gets a unique name, avoiding Claude Code's
    // collision where all non-ASCII chars become the same '-'
    let hash = fnv1a_hash(display_path.as_bytes());
    let encoded = format!("agenthub-{:08x}", hash);

    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let links_dir = home.join(".agenthub").join("links");
    fs::create_dir_all(&links_dir).map_err(|e| format!("Failed to create links dir: {}", e))?;

    let junction_path = links_dir.join(&encoded);

    // If junction already exists, verify it points to the right place
    if junction_path.exists() {
        if let Ok(target) = std::fs::read_link(&junction_path) {
            if target == path {
                return Ok(junction_path.to_string_lossy().to_string());
            }
        }
        // Junction exists but points elsewhere, remove and recreate
        let _ = fs::remove_dir(&junction_path);
    }

    // Create junction using mklink /J
    let output = std::process::Command::new("cmd")
        .args(["/C", "mklink", "/J"])
        .arg(junction_path.to_string_lossy().as_ref())
        .arg(path.to_string_lossy().as_ref())
        .output()
        .map_err(|e| format!("Failed to run mklink: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to create junction: {}", stderr));
    }

    log::info!("Created junction: {} -> {}", junction_path.display(), path.display());
    Ok(junction_path.to_string_lossy().to_string())
}

/// FNV-1a hash function (32-bit)
fn fnv1a_hash(data: &[u8]) -> u32 {
    let mut hash: u32 = 0x811c_9dc5;
    for &byte in data {
        hash ^= byte as u32;
        hash = hash.wrapping_mul(0x0100_0193);
    }
    hash
}
