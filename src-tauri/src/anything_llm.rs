use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnythingLLMWorkspace {
    pub id: Option<i64>,
    pub name: String,
    pub slug: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<String>,
    #[serde(rename = "docCount")]
    pub doc_count: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnythingLLMDocument {
    pub name: String,
    pub url: Option<String>,
    #[serde(rename = "docAuthor")]
    pub doc_author: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "chunkSource")]
    pub chunk_source: Option<String>,
    pub published: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnythingLLMSearchResult {
    pub id: Option<String>,
    pub text: Option<String>,
    pub score: Option<f64>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnythingLLMChatResponse {
    #[serde(rename = "textResponse")]
    pub text_response: Option<String>,
    pub sources: Option<Vec<serde_json::Value>>,
}

fn build_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .unwrap_or_default()
}

/// Check AnythingLLM API health
#[tauri::command]
pub async fn anything_llm_health(url: String, api_key: String) -> Result<String, String> {
    let client = build_client();
    let resp = client
        .get(format!("{}/api/v1/auth", url.trim_end_matches('/')))
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("AnythingLLM health check failed: {}", e))?;
    let status = resp.status();
    if status.is_success() {
        let body: serde_json::Value = resp.json().await.map_err(|e| format!("Parse response failed: {}", e))?;
        if body.get("authenticated").and_then(|v| v.as_bool()).unwrap_or(false) {
            Ok("ok".into())
        } else {
            Err("Authentication failed".into())
        }
    } else {
        Err(format!("AnythingLLM returned {}", status))
    }
}

/// List all AnythingLLM workspaces
#[tauri::command]
pub async fn anything_llm_list_workspaces(
    url: String,
    api_key: String,
) -> Result<Vec<AnythingLLMWorkspace>, String> {
    let client = build_client();
    let resp = client
        .get(format!("{}/api/v1/workspaces", url.trim_end_matches('/')))
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("List workspaces failed: {}", e))?;
    let body: serde_json::Value = resp.json().await.map_err(|e| format!("Parse response failed: {}", e))?;
    let workspaces = body
        .get("workspaces")
        .and_then(|v| serde_json::from_value::<Vec<AnythingLLMWorkspace>>(v.clone()).ok())
        .unwrap_or_default();
    Ok(workspaces)
}

/// Create a new AnythingLLM workspace
#[tauri::command]
pub async fn anything_llm_create_workspace(
    url: String,
    api_key: String,
    name: String,
) -> Result<AnythingLLMWorkspace, String> {
    let client = build_client();
    let body = serde_json::json!({ "name": name });
    let resp = client
        .post(format!("{}/api/v1/workspace/new", url.trim_end_matches('/')))
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Create workspace failed: {}", e))?;
    let result: serde_json::Value = resp.json().await.map_err(|e| format!("Parse response failed: {}", e))?;
    let workspace = result
        .get("workspace")
        .and_then(|v| serde_json::from_value::<AnythingLLMWorkspace>(v.clone()).ok())
        .ok_or("Failed to parse workspace from response")?;
    Ok(workspace)
}

/// Delete an AnythingLLM workspace
#[tauri::command]
pub async fn anything_llm_delete_workspace(
    url: String,
    api_key: String,
    slug: String,
) -> Result<String, String> {
    let client = build_client();
    let resp = client
        .delete(format!("{}/api/v1/workspace/{}", url.trim_end_matches('/'), slug))
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("Delete workspace failed: {}", e))?;
    if resp.status().is_success() {
        Ok("deleted".into())
    } else {
        Err(format!("Delete failed: {}", resp.status()))
    }
}

/// List documents in an AnythingLLM workspace
#[tauri::command]
pub async fn anything_llm_list_documents(
    url: String,
    api_key: String,
    slug: String,
) -> Result<Vec<AnythingLLMDocument>, String> {
    let client = build_client();
    let resp = client
        .get(format!("{}/api/v1/workspace/{}/documents", url.trim_end_matches('/'), slug))
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("List documents failed: {}", e))?;
    let body: serde_json::Value = resp.json().await.map_err(|e| format!("Parse response failed: {}", e))?;
    let documents = body
        .get("documents")
        .and_then(|v| serde_json::from_value::<Vec<AnythingLLMDocument>>(v.clone()).ok())
        .unwrap_or_default();
    Ok(documents)
}

/// Search documents in AnythingLLM
#[tauri::command]
pub async fn anything_llm_search(
    url: String,
    api_key: String,
    query: String,
    workspace: Option<String>,
) -> Result<Vec<AnythingLLMSearchResult>, String> {
    let client = build_client();
    let mut body = serde_json::json!({ "query": query });
    if let Some(ws) = workspace {
        body["workspace"] = serde_json::json!(ws);
    }
    let resp = client
        .post(format!("{}/api/v1/search", url.trim_end_matches('/')))
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Search failed: {}", e))?;
    let result: serde_json::Value = resp.json().await.map_err(|e| format!("Parse response failed: {}", e))?;
    let results = result
        .get("results")
        .and_then(|v| serde_json::from_value::<Vec<AnythingLLMSearchResult>>(v.clone()).ok())
        .unwrap_or_default();
    Ok(results)
}

/// Upload a document to AnythingLLM
#[tauri::command]
pub async fn anything_llm_upload_document(
    url: String,
    api_key: String,
    file_path: String,
) -> Result<serde_json::Value, String> {
    let client = build_client();
    let path = std::path::Path::new(&file_path);
    let file_name = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("document")
        .to_string();
    let file_bytes = std::fs::read(path)
        .map_err(|e| format!("Read file failed: {}", e))?;

    let form = reqwest::multipart::Form::new()
        .part("file", reqwest::multipart::Part::bytes(file_bytes)
            .file_name(file_name));

    let resp = client
        .post(format!("{}/api/v1/document/upload", url.trim_end_matches('/')))
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Upload failed: {}", e))?;

    let result: serde_json::Value = resp.json().await
        .map_err(|e| format!("Parse response failed: {}", e))?;

    if result.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
        Ok(result)
    } else {
        Err(result.get("error").and_then(|v| v.as_str()).unwrap_or("Upload failed").to_string())
    }
}

/// Add documents to an AnythingLLM workspace
#[tauri::command]
pub async fn anything_llm_add_to_workspace(
    url: String,
    api_key: String,
    slug: String,
    doc_paths: Vec<String>,
) -> Result<String, String> {
    let client = build_client();
    let body = serde_json::json!({ "adds": doc_paths, "deletes": [] });
    let resp = client
        .post(format!("{}/api/v1/workspace/{}/update-embeddings", url.trim_end_matches('/'), slug))
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Add to workspace failed: {}", e))?;
    if resp.status().is_success() {
        Ok("added".into())
    } else {
        Err(format!("Add to workspace failed: {}", resp.status()))
    }
}

/// Chat with an AnythingLLM workspace
#[tauri::command]
pub async fn anything_llm_chat(
    url: String,
    api_key: String,
    slug: String,
    message: String,
) -> Result<AnythingLLMChatResponse, String> {
    let client = build_client();
    let body = serde_json::json!({ "message": message, "mode": "chat" });
    let resp = client
        .post(format!("{}/api/v1/workspace/{}/chat", url.trim_end_matches('/'), slug))
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Chat failed: {}", e))?;
    let response: AnythingLLMChatResponse = resp.json().await.map_err(|e| format!("Parse response failed: {}", e))?;
    Ok(response)
}
