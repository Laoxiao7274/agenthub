use std::fs;
use std::path::PathBuf;

use tauri::Manager;

use crate::types::{AgentChild, AgentStatus, InstalledSkill};

// ========== Agent Engine Core ==========

#[tauri::command]
pub fn check_runtime(runtime: &str) -> Result<bool, String> {
    let cmd = match runtime {
        "claude-code" => "claude",
        "codex" => "codex",
        "gemini" => "gemini",
        _ => return Err(format!("Unknown runtime: {}", runtime)),
    };

    match std::process::Command::new("which").arg(cmd).output() {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub fn get_runtime_version(runtime: &str) -> Result<String, String> {
    let cmd = match runtime {
        "claude-code" => "claude",
        "codex" => "codex",
        "gemini" => "gemini",
        _ => return Err(format!("Unknown runtime: {}", runtime)),
    };

    let output = std::process::Command::new(cmd)
        .arg("--version")
        .output()
        .map_err(|e| format!("Failed to run {} --version: {}", cmd, e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(format!("{} not found or --version failed", cmd))
    }
}

#[tauri::command]
pub fn start_agent(
    app: tauri::AppHandle,
    project_path: String,
    runtime: String,
    model: String,
    small_model: String,
    permission_mode: String,
    api_key: String,
) -> Result<u32, String> {
    let cmd_name = match runtime.as_str() {
        "claude-code" => "claude",
        other => return Err(format!("Unsupported runtime: {}", other)),
    };

    // Build the claude command arguments
    let mut args: Vec<String> = Vec::new();
    if !model.is_empty() {
        args.push("--model".into());
        args.push(model.clone());
    }
    if !permission_mode.is_empty() {
        args.push("--permission-mode".into());
        args.push(permission_mode.clone());
    }

    let settings_path = PathBuf::from(&project_path)
        .join(".claude")
        .join("settings.json");
    if settings_path.exists() {
        args.push("--settings".into());
        args.push(settings_path.to_string_lossy().to_string());
    }

    // Check both .mcp.json and .claude/mcp.json
    let mcp_root = PathBuf::from(&project_path).join(".mcp.json");
    let mcp_claude = PathBuf::from(&project_path).join(".claude").join("mcp.json");
    let mcp_path = if mcp_claude.exists() { mcp_claude } else { mcp_root };
    if mcp_path.exists() {
        args.push("--mcp-config".into());
        args.push(mcp_path.to_string_lossy().to_string());
    }

    let args_str = args.join(" ");
    let claude_cmd = format!("{} {}", cmd_name, args_str);

    // On Windows, use cmd /k to keep console open after command finishes
    // This prevents the window from flashing and closing on errors
    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = std::process::Command::new("cmd");
        c.args(["/k", &claude_cmd]);
        c
    };

    #[cfg(not(target_os = "windows"))]
    let mut cmd = {
        let mut c = std::process::Command::new(cmd_name);
        c.args(&args);
        c
    };

    cmd.current_dir(&project_path);

    if !small_model.is_empty() {
        cmd.env("ANTHROPIC_SMALL_FAST_MODEL", &small_model);
    }

    // If we have API key, clear ANTHROPIC_AUTH_TOKEN to avoid auth conflict
    if !api_key.is_empty() {
        cmd.env_remove("ANTHROPIC_AUTH_TOKEN");
    }

    // On Windows, create a new console window so claude CLI is visible
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x00000010); // CREATE_NEW_CONSOLE
    }

    // Inherit stdio so the interactive claude session is visible in the new console
    cmd.stdin(std::process::Stdio::inherit())
        .stdout(std::process::Stdio::inherit())
        .stderr(std::process::Stdio::inherit());

    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start {}: {}", cmd_name, e))?;

    let pid = child.id();
    log::info!("Agent started: runtime={}, pid={}, path={}", runtime, pid, project_path);
    // Store child in existing app state
    let state = app.state::<AgentChild>();
    let mut guard = state.0.lock().map_err(|e| format!("Lock: {}", e))?;
    *guard = Some(child);
    Ok(pid)
}

#[tauri::command]
pub fn stop_agent(app: tauri::AppHandle) -> Result<String, String> {
    let state = app.state::<AgentChild>();
    let mut guard = state.0.lock().map_err(|e| format!("Lock: {}", e))?;

    match *guard {
        Some(ref mut child) => {
            child.kill().map_err(|e| format!("Kill failed: {}", e))?;
            log::info!("Agent stopped (killed)");
            *guard = None;
            Ok("Agent stopped".into())
        }
        None => Err("No agent running".into()),
    }
}

#[tauri::command]
pub fn agent_status(app: tauri::AppHandle) -> Result<AgentStatus, String> {
    let state = app.state::<AgentChild>();
    let mut guard = state.0.lock().map_err(|e| format!("Lock: {}", e))?;

    match *guard {
        Some(ref mut child) => match child.try_wait() {
            Ok(Some(_)) => {
                *guard = None;
                Ok(AgentStatus {
                    running: false,
                    pid: None,
                    runtime: "claude-code".into(),
                    version: String::new(),
                })
            }
            Ok(None) => Ok(AgentStatus {
                running: true,
                pid: Some(child.id()),
                runtime: "claude-code".into(),
                version: String::new(),
            }),
            Err(e) => Err(format!("Status check failed: {}", e)),
        },
        None => Ok(AgentStatus {
            running: false,
            pid: None,
            runtime: String::new(),
            version: String::new(),
        }),
    }
}

// ========== Skillhub Integration ==========

#[tauri::command]
pub fn install_skillhub_skills(project_path: String) -> Result<Vec<InstalledSkill>, String> {
    // Scan skills from WSL's ~/.hermes/skills/ via wsl.exe
    // This works because the Tauri app runs on Windows but skills live in WSL
    let wsl_home_output = std::process::Command::new("wsl.exe")
        .args(["-e", "bash", "-c", "echo -n $HOME"])
        .output()
        .map_err(|e| format!("Failed to run wsl.exe: {}", e))?;

    if !wsl_home_output.status.success() {
        return Err("WSL not available".into());
    }
    let wsl_home = String::from_utf8_lossy(&wsl_home_output.stdout).trim().to_string();
    let skills_dir = format!("{}/.hermes/skills", wsl_home);

    // List all SKILL.md files recursively (category/skillname/SKILL.md)
    let find_output = std::process::Command::new("wsl.exe")
        .args(["-e", "bash", "-c", &format!(
            "find '{}' -name SKILL.md -type f 2>/dev/null | sort", skills_dir
        )])
        .output()
        .map_err(|e| format!("Failed to scan skills: {}", e))?;

    let stdout = String::from_utf8_lossy(&find_output.stdout);
    let mut skills = Vec::new();

    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() { continue; }
        // Extract category/skillname from path like /home/xzy/.hermes/skills/category/skillname/SKILL.md
        if let Some(relative) = line.strip_prefix(&format!("{}/", skills_dir)) {
            if let Some(skill_dir) = relative.strip_suffix("/SKILL.md") {
                // Read first line or frontmatter name from SKILL.md
                let name = skill_dir.replace("/", " / ");
                skills.push(InstalledSkill {
                    name,
                    path: line.to_string(),
                });
            }
        }
    }

    // Also copy skills to project's .claude/skills/ directory if possible
    let project_skills_dir = std::path::PathBuf::from(&project_path).join(".claude/skills");
    let _ = fs::create_dir_all(&project_skills_dir);

    Ok(skills)
}
