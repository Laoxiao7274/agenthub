import { tauri } from '../tauri'
import type { ProjectConfig, Provider } from '../types'

/**
 * Serialize ProjectConfig into the shape expected by Rust writeProjectConfig.
 * Shared by saveConfig, autoSaveConfig, and saveConfigForProject.
 */
export function buildConfigInput(
  projectPath: string,
  config: ProjectConfig,
  providers: Provider[],
) {
  const provider = providers.find((p) => p.id === config.providerId)
  const mcpServers = config.mcpServers
    .filter((s) => s.enabled)
    .map((s) => ({
      name: s.name,
      command: s.command,
      args: s.args ? s.args.split(/\s+/).filter(Boolean) : [],
      env: {} as Record<string, string>,
    }))

  return {
    project_path: projectPath,
    model: config.model,
    small_model: config.smallModel,
    advisor_model: config.advisorModel,
    api_key: provider?.apiKey || '',
    base_url: provider?.baseUrl || '',
    permission_mode: config.permissionMode,
    claude_md: config.claudeMd,
    mcp_servers: mcpServers,
    hooks: {
      pre_tool_use: config.hooks.preToolUse || null,
      post_tool_use: config.hooks.postToolUse || null,
      notification: config.hooks.notification || null,
      stop: config.hooks.stop || null,
    },
    skills: config.skills.map((s) => ({
      name: s.name,
      prompt: s.prompt,
      model: s.model,
      tools: s.tools,
    })),
  }
}

/** Write project config to disk (best-effort, silent on error) */
export async function writeConfigSilent(
  projectPath: string,
  config: ProjectConfig,
  providers: Provider[],
) {
  try {
    await tauri.writeProjectConfig(buildConfigInput(projectPath, config, providers))
  } catch {
    // silent — best effort
  }
}
