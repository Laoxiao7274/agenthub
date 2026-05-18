export interface Project {
  id: string
  name: string
  path: string
  initial: string
  lastUsed: string
  running: boolean
  initializing?: boolean
}

export interface Provider {
  id: string
  name: string
  apiKey: string
  baseUrl: string
  model: string
  smallModel: string
  advisorModel: string
  source?: 'manual' | 'ccswitch'
  ccswitchId?: string
}

export interface McpServer {
  id: string
  name: string
  command: string
  args: string
  enabled: boolean
}

export interface AgentSkill {
  id: string
  name: string
  prompt: string
  model: string
  tools: string[]
}

export interface ProjectConfig {
  agentType: AgentType
  providerId: string
  model: string
  smallModel: string
  advisorModel: string
  claudeMd: string
  permissionMode: string
  mcpServers: McpServer[]
  skills: AgentSkill[]
  hooks: {
    preToolUse: string
    postToolUse: string
    notification: string
    stop: string
  }
}

/* CC Switch provider from Tauri backend */
export interface CcSwitchProvider {
  id: string
  app_type: string
  name: string
  base_url: string
  api_key: string
  model: string
  is_current: boolean
  icon: string | null
  icon_color: string | null
  category: string | null
  api_format: string | null
}

export type Page = 'projects' | 'project-detail' | 'settings'
export type DetailTab = 'agent' | 'provider' | 'mcp' | 'skills' | 'claudeMd' | 'permissions' | 'hooks'
export type AgentType = 'claude-code' | 'codex' | 'gemini-cli' | 'opencode' | 'hermes'

export const AGENT_TYPES: { value: AgentType, label: string, color: string, disabled: boolean, icon: string }[] = [
  { value: 'claude-code', label: 'Claude Code', color: '#D4915D', disabled: false, icon: 'claude-code.svg' },
  { value: 'codex', label: 'Codex', color: '#00A67E', disabled: true, icon: 'codex.svg' },
  { value: 'gemini-cli', label: 'Gemini CLI', color: '#4285F4', disabled: true, icon: 'gemini-cli.svg' },
  { value: 'opencode', label: 'OpenCode', color: '#8B5CF6', disabled: true, icon: 'opencode.png' },
  { value: 'hermes', label: 'Hermes', color: '#EC4899', disabled: true, icon: 'hermes.png' },
]

export const APP_TYPE_BADGE: Record<string, { label: string, color: string }> = {
  claude: { label: 'Claude', color: '#D4915D' },
  codex: { label: 'Codex', color: '#00A67E' },
  gemini: { label: 'Gemini', color: '#4285F4' },
  opencode: { label: 'OpenCode', color: '#8B5CF6' },
  hermes: { label: 'Hermes', color: '#EC4899' },
}

export const PROVIDER_COLORS: Record<string, string> = {
  anthropic: '#D4915D', openai: '#00A67E', gemini: '#4285F4', custom: '#94A3B8',
}

export const ALL_TOOLS = ['read_file', 'write_file', 'search_files', 'terminal', 'edit', 'grep', 'list_files', 'web_fetch']

export const DEFAULT_PROVIDERS: Provider[] = []

export const MOCK_PROJECTS: Project[] = [
  { id: 'p1', name: 'MYT Client', path: 'C:\\Users\\xzy\\Desktop\\gs\\pc-client\\MYT', initial: 'M', lastUsed: '2m ago', running: true },
  { id: 'p2', name: 'AgentHub', path: 'C:\\Users\\xzy\\Desktop\\my\\AgentHub', initial: 'A', lastUsed: 'Just now', running: false },
  { id: 'p3', name: 'Blog', path: 'C:\\Users\\xzy\\Desktop\\my\\blog', initial: 'B', lastUsed: '3d ago', running: false },
]

export const MOCK_CONFIGS: Record<string, ProjectConfig> = {
  p1: {
    agentType: 'claude-code',
    providerId: 'anthropic', model: 'claude-sonnet-4-20250514', smallModel: 'claude-haiku-3-20250514', advisorModel: '',
    claudeMd: '# MYT Project\n- Wails v3 + Go + React\n- Test: go test ./...\n- Build: wails3 build',
    permissionMode: 'auto',
    mcpServers: [{ id: 'fs', name: 'filesystem', command: 'npx', args: '-y @modelcontextprotocol/server-filesystem ./src', enabled: true }],
    skills: [{ id: 's1', name: 'Code Reviewer', prompt: 'Expert code reviewer focused on security and performance', model: 'claude-sonnet-4-20250514', tools: ['read_file', 'search_files'] }],
    hooks: { preToolUse: '', postToolUse: '', notification: "notify-send 'MYT' '$NOTIFICATION'", stop: '' },
  },
  p2: {
    agentType: 'claude-code',
    providerId: 'openrouter', model: 'openrouter/google/gemini-2.5-pro', smallModel: '', advisorModel: '',
    claudeMd: '# AgentHub\n- Tauri v2 + React + Rust\n- pnpm install',
    permissionMode: 'default', mcpServers: [], skills: [],
    hooks: { preToolUse: '', postToolUse: '', notification: '', stop: '' },
  },
  p3: {
    agentType: 'claude-code',
    providerId: 'anthropic', model: 'claude-haiku-3-20250514', smallModel: '', advisorModel: '',
    claudeMd: '', permissionMode: 'default', mcpServers: [], skills: [],
    hooks: { preToolUse: '', postToolUse: '', notification: '', stop: '' },
  },
}

export const STORAGE_KEY_PROVIDERS = 'agenthub_providers'
export const STORAGE_KEY_CONFIGS = 'agenthub_configs'
export const STORAGE_KEY_PROJECTS = 'agenthub_projects'

export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

export function saveToStorage<T>(key: string, data: T) {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch {}
}
