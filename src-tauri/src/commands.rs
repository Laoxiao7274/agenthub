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
fn download_skill(claude_dir: &std::path::Path, slug: &str, step: &mut InitStep) {
    let skills_dir = claude_dir.join(format!("skills/{}", slug));
    let skill_md = skills_dir.join("SKILL.md");

    if skill_md.exists() {
        step.status = "skipped".into();
        step.message = format!("{} already exists", slug);
        return;
    }

    step.status = "running".into();
    let _ = fs::create_dir_all(&skills_dir);
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
                if let Ok(entries) = fs::read_dir(&tmp_dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_dir() {
                            let src = path.join("SKILL.md");
                            if src.exists() {
                                let _ = fs::copy(&src, &skill_md);
                                found = true;
                                break;
                            }
                        } else if path.file_name() == Some(std::ffi::OsStr::new("SKILL.md")) {
                            let _ = fs::copy(&path, &skill_md);
                            found = true;
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
                download_skill(&claude_dir, &step.step, step);
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
pub fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to AgentHub.", name)
}
