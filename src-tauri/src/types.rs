use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CcSwitchProvider {
    pub id: String,
    pub app_type: String,
    pub name: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub is_current: bool,
    pub icon: Option<String>,
    pub icon_color: Option<String>,
    pub category: Option<String>,
    pub api_format: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectConfigInput {
    pub project_path: String,
    pub model: String,
    pub small_model: String,
    pub advisor_model: String,
    pub api_key: String,
    pub base_url: String,
    pub permission_mode: String,
    pub claude_md: String,
    pub mcp_servers: Vec<McpServerInput>,
    pub hooks: HookInput,
    pub skills: Vec<SkillInput>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct McpServerInput {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HookInput {
    pub pre_tool_use: Option<String>,
    pub post_tool_use: Option<String>,
    pub notification: Option<String>,
    pub stop: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SkillInput {
    pub name: String,
    pub prompt: String,
    pub model: String,
    pub tools: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub runtime: String,
    pub version: String,
}

// Wrapper for child process managed in app state
pub struct AgentChild(pub std::sync::Mutex<Option<std::process::Child>>);

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstalledSkill {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InitStep {
    pub step: String,
    pub status: String, // "pending" | "running" | "done" | "failed" | "skipped"
    pub message: String,
}
