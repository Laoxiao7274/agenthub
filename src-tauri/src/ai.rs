use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

// ========== Language Helper ==========

fn lang_instruction(lang: &Option<String>) -> String {
    match lang.as_deref() {
        Some("zh-CN") => "你必须用简体中文回答。".into(),
        Some("zh-TW") => "你必須用繁體中文回答。".into(),
        Some("en") => "You must respond in English.".into(),
        Some("ja") => "日本語で回答してください。".into(),
        Some("ko") => "반드시 한국어로 답변하세요.".into(),
        Some(other) => format!("You must respond in {}.", other),
        None => String::new(),
    }
}

// ========== Types ==========

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiChatRequest {
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub system: Option<String>,
    pub lang: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiChatResponse {
    pub reply: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiAnalyzeRequest {
    pub project_path: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub target: String,
    pub lang: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiAnalyzeResponse {
    pub result: String,
    pub target: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiUpdateRequest {
    pub project_path: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub target: String,
    pub user_request: String,
    pub current_content: String,
    pub lang: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiUpdateResponse {
    pub result: String,
    pub target: String,
}

// ========== API Call ==========

async fn call_chat_api(
    base_url: &str,
    api_key: &str,
    model: &str,
    messages: Vec<ChatMessage>,
) -> Result<String, String> {
    if base_url.is_empty() || api_key.is_empty() || model.is_empty() {
        return Err("Base URL, API Key and Model are required".into());
    }

    // Auto-fix base URL: if it doesn't end with /v1 (or /vN), append it
    let base_url = {
        let trimmed = base_url.trim_end_matches('/');
        if trimmed.ends_with("/v1")
            || trimmed.ends_with("/v2")
            || trimmed.ends_with("/v3")
            || trimmed.ends_with("/v4")
        {
            trimmed.to_string()
        } else {
            format!("{}/v1", trimmed)
        }
    };

    let url = format!("{}/chat/completions", base_url);

    let mut body_messages: Vec<serde_json::Value> = Vec::new();
    for msg in &messages {
        body_messages.push(serde_json::json!({
            "role": msg.role,
            "content": msg.content,
        }));
    }

    let body = serde_json::json!({
        "model": model,
        "messages": body_messages,
        "max_tokens": 4096,
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .timeout(std::time::Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| format!("API request failed: {}", e))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("Read response body failed: {}", e))?;

    if !status.is_success() {
        return Err(format!(
            "API error {}: {}",
            status,
            if text.len() > 500 { &text[..500] } else { &text }
        ));
    }

    // Detect HTML responses — means the base_url points to a website, not an API
    let trimmed = text.trim_start();
    if trimmed.starts_with("<!doctype") || trimmed.starts_with("<!DOCTYPE") || trimmed.starts_with("<html") || trimmed.starts_with("<HTML") {
        return Err(format!(
            "API returned HTML instead of JSON. Your Base URL may be pointing to a website instead of the API endpoint.\n\
             Current URL: {}/chat/completions\n\
             \n\
             Fix: make sure Base URL is the API address, e.g.:\n\
             - https://api.openai.com/v1\n\
             - https://api.anthropic.com/v1\n\
             - https://openrouter.ai/api/v1\n\
             \n\
             Note: /v1 is auto-appended if missing",
            base_url.trim_end_matches('/')
        ));
    }

    let json: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!(
            "Parse JSON failed: {}. Response (first 300 chars): {}",
            e,
            if text.len() > 300 { &text[..300] } else { &text }
        ))?;

    let reply = json["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string();

    if reply.is_empty() {
        // Some providers use different response shapes — try to give a useful error
        return Err(format!(
            "API returned empty content. Response keys: {:?}",
            json.as_object().map(|o| o.keys().collect::<Vec<_>>())
        ));
    }

    Ok(reply)
}

// ========== Project Context Helpers ==========

fn read_project_structure(project_path: &PathBuf, max_depth: u32) -> String {
    let mut lines = Vec::new();
    fn walk(dir: &PathBuf, prefix: &str, lines: &mut Vec<String>, depth: u32, max_depth: u32) {
        if depth > max_depth {
            return;
        }
        if let Ok(entries) = fs::read_dir(dir) {
            let mut entries: Vec<_> = entries.filter_map(|e| e.ok()).collect();
            entries.sort_by_key(|e| e.file_name());
            for entry in entries {
                let name = entry.file_name().to_string_lossy().to_string();
                // Skip hidden, node_modules, target, etc.
                if name.starts_with('.') || name == "node_modules" || name == "target" || name == "dist" || name == "__pycache__" {
                    continue;
                }
                let path = entry.path();
                if path.is_dir() {
                    lines.push(format!("{}{}/", prefix, name));
                    walk(&path, &format!("{}  ", prefix), lines, depth + 1, max_depth);
                } else {
                    lines.push(format!("{}{}", prefix, name));
                }
            }
        }
    }
    walk(project_path, "", &mut lines, 0, max_depth);
    lines.join("\n")
}

fn read_key_files(project_path: &PathBuf) -> String {
    let mut result = String::new();
    let key_files = [
        "package.json", "Cargo.toml", "go.mod", "pyproject.toml", "README.md",
        "tsconfig.json", "vite.config.ts", "next.config.js",
    ];

    for name in &key_files {
        let path = project_path.join(name);
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                // Truncate very long files
                let truncated = if content.len() > 3000 {
                    format!("{}... (truncated)", &content[..3000])
                } else {
                    content
                };
                result.push_str(&format!("=== {} ===\n{}\n\n", name, truncated));
            }
        }
    }

    // Read existing CLAUDE.md
    let claude_md_path = project_path.join("CLAUDE.md");
    if claude_md_path.exists() {
        if let Ok(content) = fs::read_to_string(&claude_md_path) {
            result.push_str(&format!("=== Current CLAUDE.md ===\n{}\n\n", content));
        }
    }

    result
}

fn read_skills_summary(project_path: &PathBuf) -> String {
    let skills_dir = project_path.join(".claude").join("skills");
    if !skills_dir.exists() {
        return "No skills directory found.".into();
    }

    let mut result = String::new();
    if let Ok(entries) = fs::read_dir(&skills_dir) {
        for entry in entries.flatten() {
            let skill_dir = entry.path();
            if !skill_dir.is_dir() {
                continue;
            }
            let skill_md = skill_dir.join("SKILL.md");
            if skill_md.exists() {
                if let Ok(content) = fs::read_to_string(&skill_md) {
                    let name = skill_dir.file_name().unwrap_or_default().to_string_lossy();
                    let truncated = if content.len() > 2000 {
                        format!("{}... (truncated)", &content[..2000])
                    } else {
                        content
                    };
                    result.push_str(&format!("--- Skill: {} ---\n{}\n\n", name, truncated));
                }
            }
        }
    }

    if result.is_empty() {
        return "No skills found.".into();
    }

    result
}

// ========== Tauri Commands ==========

#[tauri::command]
pub async fn ai_chat(req: AiChatRequest) -> Result<AiChatResponse, String> {
    log::info!("ai_chat: model={}, messages={}", req.model, req.messages.len());
    let mut messages = req.messages;

    let lang_suffix = lang_instruction(&req.lang);

    // Always ensure language instruction is present
    if let Some(system) = req.system {
        let system_with_lang = if lang_suffix.is_empty() {
            system
        } else {
            format!("{} {}", system, lang_suffix)
        };
        messages.insert(0, ChatMessage {
            role: "system".into(),
            content: system_with_lang,
        });
    } else if !lang_suffix.is_empty() {
        messages.insert(0, ChatMessage {
            role: "system".into(),
            content: lang_suffix,
        });
    }

    let reply = call_chat_api(&req.base_url, &req.api_key, &req.model, messages).await?;

    Ok(AiChatResponse { reply })
}

#[tauri::command]
pub async fn ai_analyze(req: AiAnalyzeRequest) -> Result<AiAnalyzeResponse, String> {
    log::info!("ai_analyze: path={}, target={}", req.project_path, req.target);
    let project_path = PathBuf::from(&req.project_path);
    if !project_path.exists() {
        return Err(format!("Project path does not exist: {}", req.project_path));
    }

    let structure = read_project_structure(&project_path, 3);
    let key_files = read_key_files(&project_path);
    let skills = read_skills_summary(&project_path);
    let lang_suffix = lang_instruction(&req.lang);

    let (system, user) = match req.target.as_str() {
        "claude_md" => {
            let current_claude_md = fs::read_to_string(project_path.join("CLAUDE.md"))
                .unwrap_or_default();

            let system = format!("You are a project analysis assistant. Generate a comprehensive CLAUDE.md file for the given project. \
                The CLAUDE.md should include: project overview, tech stack, build commands, architecture highlights, \
                coding conventions, and important notes. \
                Output ONLY the CLAUDE.md content, no markdown code fences. {}", lang_suffix);

            let user = format!(
                "Project structure:\n{}\n\nKey files:\n{}\n\nExisting CLAUDE.md (if any):\n{}",
                structure, key_files, current_claude_md,
            );

            (system, user)
        }
        "skills_summary" => {
            let system = format!("You are a project analysis assistant. Summarize the installed skills for this project. \
                For each skill, provide: name, purpose, and key capabilities. Write concisely. {}", lang_suffix);

            let user = format!(
                "Project structure:\n{}\n\nInstalled skills:\n{}",
                structure, skills,
            );

            (system, user)
        }
        "project_overview" => {
            let system = format!("You are a project analysis assistant. Provide a brief overview of this project: \
                what it does, its tech stack, and key architecture decisions. Keep it concise (under 300 words). {}", lang_suffix);

            let user = format!(
                "Project structure:\n{}\n\nKey files:\n{}\n\nSkills:\n{}",
                structure, key_files, skills,
            );

            (system, user)
        }
        _ => return Err(format!("Unknown analysis target: {}", req.target)),
    };

    let messages = vec![
        ChatMessage { role: "system".into(), content: system },
        ChatMessage { role: "user".into(), content: user },
    ];

    let reply = call_chat_api(&req.base_url, &req.api_key, &req.model, messages).await?;

    Ok(AiAnalyzeResponse {
        result: reply,
        target: req.target,
    })
}

#[tauri::command]
pub async fn ai_update(req: AiUpdateRequest) -> Result<AiUpdateResponse, String> {
    let project_path = PathBuf::from(&req.project_path);
    if !project_path.exists() {
        return Err(format!("Project path does not exist: {}", req.project_path));
    }

    let structure = read_project_structure(&project_path, 2);
    let key_files = read_key_files(&project_path);
    let lang_suffix = lang_instruction(&req.lang);

    let (system, user) = match req.target.as_str() {
        "claude_md" => {
            let system = format!("You are a project configuration assistant. The user wants to update their CLAUDE.md file. \
                Based on the current content and the user's request, generate the updated CLAUDE.md. \
                Preserve existing good content, only change what the user asks for. \
                Output ONLY the updated CLAUDE.md content, no markdown code fences, no explanations. {}", lang_suffix);

            let user = format!(
                "Project structure:\n{}\n\nCurrent CLAUDE.md:\n{}\n\nUser's request: {}",
                structure, req.current_content, req.user_request,
            );

            (system, user)
        }
        "skills" => {
            let existing_skills = read_skills_summary(&project_path);

            let system = format!("You are a skill design assistant. The user wants to create or update a skill. \
                Generate a SKILL.md file content. A skill has: name, description, instructions, and optional references. \
                Use markdown format with frontmatter. Output ONLY the SKILL.md content, no code fences. {}", lang_suffix);

            let user = format!(
                "Project context:\n{}\n\nKey files:\n{}\n\nExisting skills:\n{}\n\nCurrent skill content (if updating):\n{}\n\nUser's request: {}",
                structure, key_files, existing_skills, req.current_content, req.user_request,
            );

            (system, user)
        }
        _ => return Err(format!("Unknown update target: {}", req.target)),
    };

    let messages = vec![
        ChatMessage { role: "system".into(), content: system },
        ChatMessage { role: "user".into(), content: user },
    ];

    let reply = call_chat_api(&req.base_url, &req.api_key, &req.model, messages).await?;

    Ok(AiUpdateResponse {
        result: reply,
        target: req.target,
    })
}

#[tauri::command]
pub async fn ai_apply(
    project_path: String,
    target: String,
    content: String,
) -> Result<String, String> {
    let path = PathBuf::from(&project_path);
    if !path.exists() {
        return Err(format!("Project path does not exist: {}", project_path));
    }

    match target.as_str() {
        "claude_md" => {
            let claude_md_path = path.join("CLAUDE.md");
            fs::write(&claude_md_path, &content)
                .map_err(|e| format!("Write CLAUDE.md failed: {}", e))?;
            Ok("CLAUDE.md updated".into())
        }
        "skills" => {
            // For skills, content should be JSON with { name, content }
            let skill_info: serde_json::Value = serde_json::from_str(&content)
                .map_err(|e| format!("Invalid skill data: {}", e))?;
            let skill_name = skill_info["name"].as_str().unwrap_or("custom-skill");
            let skill_content = skill_info["content"].as_str().unwrap_or("");

            let skills_dir = path.join(".claude").join("skills").join(skill_name);
            fs::create_dir_all(&skills_dir)
                .map_err(|e| format!("Create skill dir failed: {}", e))?;

            let skill_md_path = skills_dir.join("SKILL.md");
            fs::write(&skill_md_path, skill_content)
                .map_err(|e| format!("Write SKILL.md failed: {}", e))?;

            Ok(format!("Skill '{}' saved", skill_name))
        }
        _ => Err(format!("Unknown apply target: {}", target)),
    }
}
