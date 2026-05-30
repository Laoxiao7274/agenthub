use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QdrantCollectionInfo {
    pub name: String,
    pub vector_count: u64,
    pub dimension: u64,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QdrantPoint {
    pub id: String,
    pub payload: serde_json::Value,
    pub score: Option<f64>,
}

fn build_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap_or_default()
}

/// Check Qdrant server health
#[tauri::command]
pub async fn qdrant_health(url: String, api_key: String) -> Result<String, String> {
    let client = build_client();
    let resp = client
        .get(format!("{}/healthz", url.trim_end_matches('/')))
        .header("api-key", &api_key)
        .send()
        .await
        .map_err(|e| format!("Qdrant health check failed: {}", e))?;
    let status = resp.status();
    if status.is_success() {
        Ok("ok".into())
    } else {
        let body = resp.text().await.unwrap_or_default();
        Err(format!("Qdrant health check returned {}: {}", status, body))
    }
}

/// List all Qdrant collections
#[tauri::command]
pub async fn qdrant_list_collections(
    url: String,
    api_key: String,
) -> Result<Vec<String>, String> {
    let client = build_client();
    let resp = client
        .get(format!("{}/collections", url.trim_end_matches('/')))
        .header("api-key", &api_key)
        .send()
        .await
        .map_err(|e| format!("List collections failed: {}", e))?;
    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Parse collections response failed: {}", e))?;
    let collections = body
        .get("result")
        .and_then(|r| r.get("collections"))
        .and_then(|c| c.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|item| item.get("name").and_then(|n| n.as_str()).map(String::from))
                .collect()
        })
        .unwrap_or_default();
    Ok(collections)
}

/// Get details of a specific Qdrant collection
#[tauri::command]
pub async fn qdrant_get_collection(
    url: String,
    api_key: String,
    name: String,
) -> Result<QdrantCollectionInfo, String> {
    let client = build_client();
    let resp = client
        .get(format!(
            "{}/collections/{}",
            url.trim_end_matches('/'),
            name
        ))
        .header("api-key", &api_key)
        .send()
        .await
        .map_err(|e| format!("Get collection '{}' failed: {}", name, e))?;
    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Parse collection response failed: {}", e))?;
    let result = body
        .get("result")
        .ok_or_else(|| "Missing 'result' in response".to_string())?;
    let info = QdrantCollectionInfo {
        name: result
            .get("collection_name")
            .or_else(|| result.get("name"))
            .and_then(|n| n.as_str())
            .unwrap_or(&name)
            .to_string(),
        vector_count: result
            .get("points_count")
            .or_else(|| result.get("vectors_count"))
            .and_then(|v| v.as_u64())
            .unwrap_or(0),
        dimension: result
            .get("config")
            .and_then(|c| c.get("params"))
            .and_then(|p| p.get("vectors"))
            .and_then(|v| v.get("size"))
            .and_then(|s| s.as_u64())
            .unwrap_or(0),
        status: result
            .get("status")
            .and_then(|s| s.as_str())
            .unwrap_or("unknown")
            .to_string(),
    };
    Ok(info)
}

/// Scroll (browse) points in a Qdrant collection
#[tauri::command]
pub async fn qdrant_scroll_points(
    url: String,
    api_key: String,
    collection: String,
    limit: Option<u32>,
    offset: Option<String>,
) -> Result<Vec<QdrantPoint>, String> {
    let client = build_client();
    let limit = limit.unwrap_or(20);
    let mut body = serde_json::json!({
        "limit": limit,
        "with_payload": true,
    });
    if let Some(ref page_offset) = offset {
        body["offset"] = serde_json::json!(page_offset);
    }
    let resp = client
        .post(format!(
            "{}/collections/{}/points/scroll",
            url.trim_end_matches('/'),
            collection
        ))
        .header("api-key", &api_key)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Scroll points in '{}' failed: {}", collection, e))?;
    let resp_body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Parse scroll response failed: {}", e))?;
    let points = resp_body
        .get("result")
        .and_then(|r| r.get("points"))
        .and_then(|p| p.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|item| {
                    let id = item
                        .get("id")
                        .and_then(|v| match v {
                            serde_json::Value::String(s) => Some(s.clone()),
                            serde_json::Value::Number(n) => Some(n.to_string()),
                            _ => None,
                        })
                        .unwrap_or_default();
                    let payload = item.get("payload").cloned().unwrap_or(serde_json::Value::Object(Default::default()));
                    Some(QdrantPoint {
                        id,
                        payload,
                        score: None,
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    Ok(points)
}

/// Delete points from a Qdrant collection by IDs
#[tauri::command]
pub async fn qdrant_delete_points(
    url: String,
    api_key: String,
    collection: String,
    ids: Vec<String>,
) -> Result<String, String> {
    let client = build_client();
    let point_ids: Vec<serde_json::Value> = ids
        .iter()
        .filter_map(|id| {
            if let Ok(n) = id.parse::<u64>() {
                Some(serde_json::json!(n))
            } else {
                Some(serde_json::json!(id))
            }
        })
        .collect();
    let body = serde_json::json!({
        "points": point_ids,
    });
    let resp = client
        .post(format!(
            "{}/collections/{}/points/delete",
            url.trim_end_matches('/'),
            collection
        ))
        .header("api-key", &api_key)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Delete points from '{}' failed: {}", collection, e))?;
    let status = resp.status();
    if status.is_success() {
        Ok("deleted".into())
    } else {
        let body = resp.text().await.unwrap_or_default();
        Err(format!("Delete points returned {}: {}", status, body))
    }
}
