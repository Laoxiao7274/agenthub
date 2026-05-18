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
};
