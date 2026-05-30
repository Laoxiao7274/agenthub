/**
 * Tauri backend command wrappers
 * All calls go through window.__TAURI_INTERNALS__.invoke
 */

export interface CcSwitchProvider {
  id: string;
  app_type: string;
  name: string;
  base_url: string;
  api_key: string;
  model: string;
  is_current: boolean;
  icon: string | null;
  icon_color: string | null;
  category: string | null;
  api_format: string | null;
}

export interface ProjectConfigInput {
  project_path: string;
  model: string;
  small_model: string;
  advisor_model: string;
  api_key: string;
  base_url: string;
  permission_mode: string;
  claude_md: string;
  mcp_servers: McpServerInput[];
  hooks: HookInput;
  skills: SkillInput[];
}

export interface McpServerInput {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface HookInput {
  pre_tool_use: string | null;
  post_tool_use: string | null;
  notification: string | null;
  stop: string | null;
}

export interface SkillInput {
  name: string;
  prompt: string;
  model: string;
  tools: string[];
}

export interface AgentStatus {
  running: boolean;
  pid: number | null;
  runtime: string;
  version: string;
}

export interface ChatMessage {
  role: string;
  content: string;
}

export interface AiChatRequest {
  base_url: string;
  api_key: string;
  model: string;
  messages: ChatMessage[];
  system?: string;
  lang?: string;
}

export interface AiAnalyzeRequest {
  project_path: string;
  base_url: string;
  api_key: string;
  model: string;
  target: string;
  lang?: string;
}

export interface AiUpdateRequest {
  project_path: string;
  base_url: string;
  api_key: string;
  model: string;
  target: string;
  user_request: string;
  current_content: string;
  lang?: string;
}

export interface WikiProject {
  id: string;
  name: string;
  description: string | null;
}

export interface WikiFile {
  name: string;
  path: string;
  is_dir: boolean;
  children: WikiFile[] | null;
}

export interface WikiSearchResult {
  title: string;
  path: string;
  snippet: string;
  score: number;
  mode: string;
}

export interface WikiGraphNode {
  id: string;
  label: string;
  node_type: string;
}

export interface WikiGraphEdge {
  source: string;
  target: string;
  label: string;
}

export interface WikiGraph {
  nodes: WikiGraphNode[];
  edges: WikiGraphEdge[];
}

export interface AnythingLLMWorkspace {
  id?: number;
  name: string;
  slug?: string;
  description?: string;
  createdAt?: string;
  docCount?: number;
}

export interface AnythingLLMDocument {
  name: string;
  url?: string;
  docAuthor?: string;
  description?: string;
  chunkSource?: string;
  published?: string;
}

export interface AnythingLLMSearchResult {
  id?: string;
  text?: string;
  score?: number;
  metadata?: Record<string, any>;
}

export interface AnythingLLMChatResponse {
  textResponse?: string;
  sources?: Record<string, any>[];
}

export interface QdrantCollectionInfo {
  name: string;
  vector_count: number;
  dimension: number;
  status: string;
}

export interface QdrantPoint {
  id: string;
  payload: Record<string, any>;
  score: number | null;
}

export interface Mem0AddRequest {
  content: string;
  user_id: string;
  agent_id?: string;
}

export interface ClaudeSession {
  id: string;
  firstMessage: string;
  timestamp: string;
  permissionMode: string;
  sizeBytes: number;
}

export interface SessionMessage {
  role: string;
  content: string;
  timestamp: string;
}

export interface Mem0SearchRequest {
  query: string;
  user_id: string;
  agent_id?: string;
}

export interface Mem0DeleteRequest {
  memory_id: string;
  user_id: string;
}

export interface Mem0Memory {
  id: string;
  memory: string;
  created_at?: string;
  updated_at?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const invoke = (cmd: string, args?: Record<string, any>) =>
  (window as any).__TAURI_INTERNALS__.invoke(cmd, args);

export const tauri = {
  /** Read CC Switch providers from local DB */
  readCcSwitchProviders: (): Promise<CcSwitchProvider[]> =>
    invoke("read_cc_switch_providers"),

  /** Check if a runtime is installed */
  checkRuntime: (runtime: string): Promise<boolean> =>
    invoke("check_runtime", { runtime }),

  /** Get runtime version string */
  getRuntimeVersion: (runtime: string): Promise<string> =>
    invoke("get_runtime_version", { runtime }),

  /** Write project config files (.claude/settings, CLAUDE.md, .mcp.json) */
  writeProjectConfig: (config: ProjectConfigInput): Promise<string> =>
    invoke("write_project_config", { config }),

  /** Read existing project config from Claude Code files */
  readProjectConfig: (projectPath: string): Promise<Record<string, any>> =>
    invoke("read_project_config", { projectPath: projectPath }),

  /** Start an agent for a project */
  startAgent: (
    projectPath: string,
    runtime: string,
    model: string,
    smallModel: string,
    permissionMode: string,
    apiKey: string,
  ): Promise<number> =>
    invoke("start_agent", {
      projectPath: projectPath,
      runtime,
      model,
      smallModel: smallModel,
      permissionMode: permissionMode,
      apiKey,
    }),

  /** Stop the running agent */
  stopAgent: (): Promise<string> => invoke("stop_agent"),

  /** Check agent status */
  agentStatus: (): Promise<AgentStatus> => invoke("agent_status"),

  /** Install skillhub default skills for a project */
  installSkillhubSkills: (projectPath: string): Promise<{ name: string; path: string }[]> =>
    invoke("install_skillhub_skills", { projectPath: projectPath }),

  /** Check if skillhub CLI is installed */
  checkSkillhubInstalled: (): Promise<boolean> =>
    invoke("check_skillhub_installed"),

  /** Initialize project (download default skills etc.) */
  initProject: (projectPath: string): Promise<{ step: string; status: string; message: string }[]> =>
    invoke("init_project", { projectPath }),

  /** Delete a folder recursively */
  deleteFolder: (path: string): Promise<string> =>
    invoke("delete_folder", { path }),

  /** Ensure a folder exists (create if needed) */
  ensureFolder: (path: string): Promise<string> =>
    invoke("ensure_folder", { path }),

  /** Open folder in system file explorer */
  openFolder: (path: string): Promise<string> =>
    invoke("open_folder", { path }),

  /** Initialize agent: run /init then /self-improving-agent */
  initAgent: (projectPath: string): Promise<string> =>
    invoke("init_agent", { projectPath }),

  /** Test API connectivity */
  testApi: (baseUrl: string, apiKey: string, model: string): Promise<string> =>
    invoke("test_api", { baseUrl, apiKey, model }),

  /** AI chat (multi-turn conversation) */
  aiChat: (req: AiChatRequest): Promise<{ reply: string }> =>
    invoke("ai_chat", { req }),

  /** Import skill from a local ZIP file */
  importSkillZip: (projectPath: string, zipPath: string): Promise<string> =>
    invoke("import_skill_zip", { projectPath, zipPath }),

  /** Import skill from skillhub by slug */
  importSkillSlug: (projectPath: string, slug: string): Promise<string> =>
    invoke("import_skill_slug", { projectPath, slug }),

  /** Read Claude Code memory data (CLAUDE.md, skills, settings) */
  readClaudeMemory: (projectPath: string): Promise<Record<string, any>> =>
    invoke("read_claude_memory", { projectPath }),

  /** List Claude Code sessions for a project */
  listClaudeSessions: (projectPath: string): Promise<ClaudeSession[]> =>
    invoke("list_claude_sessions", { projectPath }),

  /** Resume a Claude Code session */
  resumeClaudeSession: (projectPath: string, sessionId: string, model: string, apiKey: string): Promise<number> =>
    invoke("resume_claude_session", { projectPath, sessionId, model, apiKey }),

  /** Read full session content (messages) from a JSONL session file */
  readClaudeSession: (projectPath: string, sessionId: string): Promise<SessionMessage[]> =>
    invoke("read_claude_session", { projectPath, sessionId }),

  /** AI analyze project (generate CLAUDE.md / skills summary / overview) */
  aiAnalyze: (req: AiAnalyzeRequest): Promise<{ result: string; target: string }> =>
    invoke("ai_analyze", { req }),

  /** AI update (user describes change, AI designs updated content) */
  aiUpdate: (req: AiUpdateRequest): Promise<{ result: string; target: string }> =>
    invoke("ai_update", { req }),

  /** AI apply (write AI-generated content to disk after user confirms) */
  aiApply: (projectPath: string, target: string, content: string): Promise<string> =>
    invoke("ai_apply", { projectPath, target, content }),

  /** Check if Mem0 CLI is installed */
  checkMem0Installed: (): Promise<boolean> =>
    invoke("check_mem0_installed"),

  /** Get Mem0 CLI version */
  getMem0Version: (): Promise<string> =>
    invoke("get_mem0_version"),

  /** Install Mem0 CLI via npm */
  installMem0: (): Promise<string> =>
    invoke("install_mem0"),

  /** Uninstall Mem0 CLI via npm */
  uninstallMem0: (): Promise<string> =>
    invoke("uninstall_mem0"),

  /** Add a memory via Mem0 */
  mem0Add: (req: Mem0AddRequest): Promise<string> =>
    invoke("mem0_add", { req }),

  /** Search memories via Mem0 */
  mem0Search: (req: Mem0SearchRequest): Promise<Mem0Memory[]> =>
    invoke("mem0_search", { req }),

  /** Delete a memory via Mem0 */
  mem0Delete: (req: Mem0DeleteRequest): Promise<string> =>
    invoke("mem0_delete", { req }),

  /** Get all memories via Mem0 */
  mem0GetAll: (userId: string, agentId?: string): Promise<Mem0Memory[]> =>
    invoke("mem0_get_all", { userId, agentId }),

  /** Read recent log lines from the log file */
  getLogs: (lines?: number): Promise<string> =>
    invoke("get_logs", { lines }),

  /** Clear the log file */
  clearLogs: (): Promise<string> =>
    invoke("clear_logs"),

  /** Send a frontend log entry to the Rust logger */
  frontendLog: (level: string, message: string): Promise<void> =>
    invoke("frontend_log", { level, message }),

  /** Open the log directory in file explorer */
  openLogDir: (): Promise<string> =>
    invoke("open_log_dir"),

  // ===== Qdrant REST API =====

  /** Check Qdrant server health */
  qdrantHealth: (url: string, apiKey: string): Promise<string> =>
    invoke("qdrant_health", { url, apiKey }),

  /** List all Qdrant collections */
  qdrantListCollections: (url: string, apiKey: string): Promise<string[]> =>
    invoke("qdrant_list_collections", { url, apiKey }),

  /** Get details of a Qdrant collection */
  qdrantGetCollection: (url: string, apiKey: string, name: string): Promise<QdrantCollectionInfo> =>
    invoke("qdrant_get_collection", { url, apiKey, name }),

  /** Scroll (browse) points in a Qdrant collection */
  qdrantScrollPoints: (url: string, apiKey: string, collection: string, limit?: number, offset?: string): Promise<QdrantPoint[]> =>
    invoke("qdrant_scroll_points", { url, apiKey, collection, limit, offset }),

  /** Delete points from a Qdrant collection */
  qdrantDeletePoints: (url: string, apiKey: string, collection: string, ids: string[]): Promise<string> =>
    invoke("qdrant_delete_points", { url, apiKey, collection, ids }),

  // ===== agent-mem0 install =====

  /** Install agent-mem0 MCP config + skill into a project */
  installAgentMem0: (projectPath: string, projectName: string): Promise<string> =>
    invoke("install_agent_mem0", { projectPath, projectName }),

  /** Ensure a project link (junction) exists for paths with non-ASCII characters */
  ensureProjectLink: (displayPath: string): Promise<string> =>
    invoke("ensure_project_link", { displayPath }),

  // ===== AnythingLLM API =====

  /** Check AnythingLLM API health */
  anythingLLMHealth: (url: string, apiKey: string): Promise<string> =>
    invoke("anything_llm_health", { url, apiKey }),

  /** List all AnythingLLM workspaces */
  anythingLLMListWorkspaces: (url: string, apiKey: string): Promise<AnythingLLMWorkspace[]> =>
    invoke("anything_llm_list_workspaces", { url, apiKey }),

  /** Create a new AnythingLLM workspace */
  anythingLLMCreateWorkspace: (url: string, apiKey: string, name: string): Promise<AnythingLLMWorkspace> =>
    invoke("anything_llm_create_workspace", { url, apiKey, name }),

  /** Delete an AnythingLLM workspace */
  anythingLLMDeleteWorkspace: (url: string, apiKey: string, slug: string): Promise<string> =>
    invoke("anything_llm_delete_workspace", { url, apiKey, slug }),

  /** List documents in an AnythingLLM workspace */
  anythingLLMListDocuments: (url: string, apiKey: string, slug: string): Promise<AnythingLLMDocument[]> =>
    invoke("anything_llm_list_documents", { url, apiKey, slug }),

  /** Search documents in AnythingLLM */
  anythingLLMSearch: (url: string, apiKey: string, query: string, workspace?: string): Promise<AnythingLLMSearchResult[]> =>
    invoke("anything_llm_search", { url, apiKey, query, workspace }),

  /** Chat with an AnythingLLM workspace */
  anythingLLMChat: (url: string, apiKey: string, slug: string, message: string): Promise<AnythingLLMChatResponse> =>
    invoke("anything_llm_chat", { url, apiKey, slug, message }),

  /** Upload a document to AnythingLLM */
  anythingLLMUploadDocument: (url: string, apiKey: string, filePath: string): Promise<any> =>
    invoke("anything_llm_upload_document", { url, apiKey, filePath }),

  /** Add documents to an AnythingLLM workspace */
  anythingLLMAddToWorkspace: (url: string, apiKey: string, slug: string, docPaths: string[]): Promise<string> =>
    invoke("anything_llm_add_to_workspace", { url, apiKey, slug, docPaths }),
};
