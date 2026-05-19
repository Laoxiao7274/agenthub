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
fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> bool {
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
