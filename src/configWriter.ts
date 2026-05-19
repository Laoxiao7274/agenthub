import type { Provider, ProjectConfig } from './types'
import { tauri } from './tauri'

export interface WriteConfigInput {
  project_path: string
  model: string
  small_model: string
  advisor_model: string
  api_key: string
  base_url: string
  permission_mode: string
  claude_md: string
  mcp_servers: {
    name: string
    command: string
    args: string[]
    env: Record<string, string>
  }[]
  hooks: {
    pre_tool_use: string | null
    post_tool_use: string | null
    notification: string | null
    stop: string | null
  }
  skills: {
    name: string
    prompt: string
    model: string
    tools: string[]
  }[]
}

export function buildWriteConfigInput(
  projectPath: string,
  config: ProjectConfig,
  providers: Provider[],
): WriteConfigInput {
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

export async function writeProjectConfig(
  projectPath: string,
  config: ProjectConfig,
  providers: Provider[],
) {
  const input = buildWriteConfigInput(projectPath, config, providers)
  await tauri.writeProjectConfig(input)
}
