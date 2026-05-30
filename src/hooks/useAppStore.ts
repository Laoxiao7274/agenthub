import { useState, useRef, useEffect } from 'react'
import { tauri } from '../tauri'
import type { Project, Provider, ProjectConfig, Page, DetailTab, ServerConfig } from '../types'
import {
  DEFAULT_PROVIDERS, MOCK_PROJECTS, MOCK_CONFIGS,
  STORAGE_KEY_PROVIDERS, STORAGE_KEY_CONFIGS, STORAGE_KEY_PROJECTS,
  STORAGE_KEY_SERVER_CONFIG, DEFAULT_SERVER_CONFIG,
  loadFromStorage, saveToStorage,
} from '../types'
import { buildConfigInput, writeConfigSilent } from '../lib/project-config'

export interface ConfirmState {
  message: string
  onConfirm: (checkboxResult?: boolean) => void
  checkboxLabel?: string
}

export function useAppStore() {
  const [page, setPage] = useState<Page>('projects')
  const [projects, setProjects] = useState<Project[]>(() =>
    loadFromStorage(STORAGE_KEY_PROJECTS, MOCK_PROJECTS),
  )
  const [configs, setConfigs] = useState<Record<string, ProjectConfig>>(() =>
    loadFromStorage(STORAGE_KEY_CONFIGS, MOCK_CONFIGS),
  )
  const [providers, setProviders] = useState<Provider[]>(() =>
    loadFromStorage(STORAGE_KEY_PROVIDERS, DEFAULT_PROVIDERS),
  )
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<DetailTab>('provider')
  const [showAddProject, setShowAddProject] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [agentBusy, setAgentBusy] = useState(false)
  const [initRunning, setInitRunning] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmState | null>(null)
  const [serverConfig, setServerConfig] = useState<ServerConfig>(() =>
    loadFromStorage(STORAGE_KEY_SERVER_CONFIG, DEFAULT_SERVER_CONFIG),
  )

  const activeProject = projects.find((p) => p.id === activeProjectId)
  const activeConfig = activeProjectId ? configs[activeProjectId] : null

  // Migrate existing projects: fix paths, ensure launchPath
  useEffect(() => {
    const FOLDER_RENAMES: Record<string, string> = {
      'agent编辑大师': 'agent-editor',
      '实施助手': 'impl-assistant',
    }

    const migrate = async () => {
      let changed = false
      const updated = await Promise.all(projects.map(async (p) => {
        let newPath = p.path
        // Check if path was renamed
        for (const [zh, en] of Object.entries(FOLDER_RENAMES)) {
          if (newPath.includes(zh)) {
            newPath = newPath.replace(zh, en)
            changed = true
            break
          }
        }
        // Ensure launchPath
        const needsLink = !p.launchPath || (/[^\x00-\x7f]/.test(newPath) && !p.launchPath.includes('agenthub-'))
        const launchPath = needsLink ? await tauri.ensureProjectLink(newPath).catch(() => newPath) : p.launchPath
        if (newPath !== p.path || launchPath !== p.launchPath) changed = true
        return { ...p, path: newPath, launchPath: launchPath || newPath }
      }))
      if (changed) {
        setProjects(updated)
        saveToStorage(STORAGE_KEY_PROJECTS, updated)
      }
    }
    migrate()
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const confirmThen = (message: string, fn: () => void) => {
    setConfirmAction({ message, onConfirm: () => fn() })
  }

  // Save config to disk (explicit)
  const saveConfig = async () => {
    if (!activeProjectId || !activeProject || !activeConfig) return
    setSaving(true)
    try {
      await tauri.writeProjectConfig(
        buildConfigInput(activeProject.launchPath, activeConfig, providers),
      )
      showToast('✅ Config saved')
    } catch (e: any) {
      showToast('❌ ' + (e?.toString() || 'Save failed'))
    } finally {
      setSaving(false)
    }
  }

  // Start agent (fire and forget)
  const startAgent = async () => {
    if (!activeProject || !activeConfig) return
    setAgentBusy(true)
    try {
      const provider = providers.find((p) => p.id === activeConfig.providerId)
      const pid = await tauri.startAgent(
        activeProject.launchPath,
        activeConfig.agentType,
        activeConfig.model,
        activeConfig.smallModel,
        activeConfig.permissionMode,
        provider?.apiKey || '',
      )
      showToast(`🚀 Agent started (PID: ${pid})`)
    } catch (e: any) {
      showToast('❌ ' + (e?.toString() || 'Start failed'))
    } finally {
      setAgentBusy(false)
    }
  }

  const runInit = async () => {
    if (!activeProject || !activeConfig) return
    // Pre-checks
    const provider = providers.find((p) => p.id === activeConfig.providerId)
    if (!activeConfig.providerId || !provider) {
      showToast('❌ 请先选择服务商')
      return
    }
    if (!provider.apiKey || !provider.baseUrl || !provider.model) {
      showToast('❌ 服务商配置不完整（需要 Base URL、API Key、Model）')
      return
    }
    setInitRunning(true)
    try {
      await tauri.initAgent(activeProject.launchPath)
      showToast('✅ Agent initialized')
    } catch (e: any) {
      showToast('❌ ' + (e?.toString() || 'Init failed'))
    } finally {
      setInitRunning(false)
    }
  }

  // Debounced auto-save to disk
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSaveConfig = (config: ProjectConfig) => {
    if (!activeProject) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      await writeConfigSilent(activeProject.launchPath, config, providers)
    }, 800)
  }

  const updateConfig = (c: ProjectConfig) => {
    if (!activeProjectId) return
    setConfigs((prev) => {
      const next = { ...prev, [activeProjectId]: c }
      saveToStorage(STORAGE_KEY_CONFIGS, next)
      return next
    })
    autoSaveConfig(c)
  }

  const handleProvidersChange = (updatedProviders: Provider[]) => {
    setProviders(updatedProviders)
    saveToStorage(STORAGE_KEY_PROVIDERS, updatedProviders)
    if (activeProjectId && activeConfig?.providerId) {
      autoSaveConfig(activeConfig)
    }
  }

  const addProject = async (name: string, path: string, isExisting: boolean = false, initSkills: boolean = false) => {
    const id = `p-${Date.now()}`
    const initial = name.charAt(0).toUpperCase()
    // Create junction for non-ASCII paths so Claude Code gets unique project directories
    const launchPath = await tauri.ensureProjectLink(path).catch(() => path)
    const newProject: Project = { id, name, path, launchPath, initial, lastUsed: 'Just now', running: false, initializing: true }
    const newConfig: ProjectConfig = {
      agentType: 'claude-code', providerId: '', model: '', smallModel: '', advisorModel: '',
      claudeMd: '', permissionMode: 'default', mcpServers: [], skills: [],
      hooks: { preToolUse: '', postToolUse: '', notification: '', stop: '' },
    }
    setProjects((prev) => {
      const next = [...prev, newProject]
      saveToStorage(STORAGE_KEY_PROJECTS, next)
      return next
    })
    setConfigs((prev) => {
      const next = { ...prev, [id]: newConfig }
      saveToStorage(STORAGE_KEY_CONFIGS, next)
      return next
    })
    if (isExisting && !initSkills) {
      // Open existing folder: only write config, no init
      try {
        await writeConfigSilent(path, newConfig, providers)
        showToast('✅ Project ready')
      } catch {
        showToast('⚠️ Failed to write config')
      } finally {
        setProjects((prev) => {
          const next = prev.map((p) => p.id === id ? { ...p, initializing: false } : p)
          saveToStorage(STORAGE_KEY_PROJECTS, next)
          return next
        })
      }
    } else {
      // New project or existing with init: create folder + init (download skills)
      try {
        if (!isExisting) await tauri.ensureFolder(path)
        await writeConfigSilent(path, newConfig, providers)
        await tauri.initProject(path)
        showToast('✅ Project ready')
      } catch {
        showToast('⚠️ Project init partially failed')
      } finally {
        setProjects((prev) => {
          const next = prev.map((p) => p.id === id ? { ...p, initializing: false } : p)
          saveToStorage(STORAGE_KEY_PROJECTS, next)
          return next
        })
      }
    }
    setActiveProjectId(id)
    setPage('project-detail')
    setDetailTab('provider')
  }

  const removeProject = (id: string, deleteFolder: boolean) => {
    const project = projects.find((p) => p.id === id)
    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== id)
      saveToStorage(STORAGE_KEY_PROJECTS, next)
      return next
    })
    setConfigs((prev) => {
      const { [id]: _, ...rest } = prev
      saveToStorage(STORAGE_KEY_CONFIGS, rest)
      return rest
    })
    if (activeProjectId === id) {
      setActiveProjectId(null)
      setPage('projects')
    }
    if (deleteFolder && project?.path) {
      tauri.deleteFolder(project.path).catch(() => {})
    }
  }

  const openProject = async (id: string) => {
    const project = projects.find((p) => p.id === id)
    if (!project) return
    setActiveProjectId(id)
    setPage('project-detail')
    setDetailTab('agent')
    // Read config from disk and merge into state
    try {
      const disk = await tauri.readProjectConfig(project.launchPath)
      const existing = configs[id]
      if (!existing) return
      let updated = { ...existing }

      // CLAUDE.md
      if (disk.claudeMd && typeof disk.claudeMd === 'string') {
        updated.claudeMd = disk.claudeMd
      }
      // Model from settings.local.json env
      if (disk.localSettings?.env) {
        const env = disk.localSettings.env
        if (env.ANTHROPIC_MODEL) updated.model = env.ANTHROPIC_MODEL
        if (env.ANTHROPIC_SMALL_FAST_MODEL) updated.smallModel = env.ANTHROPIC_SMALL_FAST_MODEL
        if (env.ANTHROPIC_BASE_URL) {
          // Try to match provider by baseUrl
          const match = providers.find((p) => p.baseUrl === env.ANTHROPIC_BASE_URL)
          if (match) updated.providerId = match.id
        }
      }
      // Permission mode from settings.json
      if (disk.settings?.permissions?.defaultMode) {
        updated.permissionMode = disk.settings.permissions.defaultMode
      }
      // MCP servers from settings.json
      if (disk.settings?.mcpServers) {
        const mcpObj = disk.settings.mcpServers as Record<string, any>
        const servers = Object.entries(mcpObj).map(([name, val]: [string, any]) => ({
          id: `mcp-${name}`,
          name,
          command: val.command || '',
          args: (val.args || []).join(' '),
          enabled: true,
        }))
        if (servers.length > 0) updated.mcpServers = servers
      }
      // MCP servers from .mcp.json / .claude/mcp.json (project-level)
      if (disk.mcpConfig?.mcpServers) {
        const mcpObj = disk.mcpConfig.mcpServers as Record<string, any>
        const servers = Object.entries(mcpObj).map(([name, val]: [string, any]) => ({
          id: `mcp-${name}`,
          name,
          command: val.command || '',
          args: (val.args || []).join(' '),
          enabled: true,
        }))
        // Merge: add new servers not already in list
        const existingNames = new Set(updated.mcpServers.map((s: any) => s.name))
        for (const s of servers) {
          if (!existingNames.has(s.name)) updated.mcpServers = [...updated.mcpServers, s]
        }
      }
      // Hooks from settings.json
      if (disk.settings?.hooks) {
        const hooks = disk.settings.hooks as Record<string, any>
        if (hooks.PreToolUse?.[0]?.command) updated.hooks.preToolUse = hooks.PreToolUse[0].command
        if (hooks.PostToolUse?.[0]?.command) updated.hooks.postToolUse = hooks.PostToolUse[0].command
        if (hooks.Notification?.[0]?.command) updated.hooks.notification = hooks.Notification[0].command
        if (hooks.Stop?.[0]?.command) updated.hooks.stop = hooks.Stop[0].command
      }
      // Advisor model from global settings
      if (disk.settings?.advisorModel) {
        updated.advisorModel = disk.settings.advisorModel
      }
      // Skills from .claude/skills/*/SKILL.md
      if (Array.isArray(disk.skills) && disk.skills.length > 0) {
        const diskSkills = disk.skills.map((s: any) => ({
          id: `skill-${s.name}`,
          name: s.name,
          prompt: s.content || '',
          model: '',
          tools: [],
        }))
        const existingNames = new Set(updated.skills.map((s: any) => s.name))
        for (const s of diskSkills) {
          if (!existingNames.has(s.name)) updated.skills = [...updated.skills, s]
        }
      }

      setConfigs((prev) => {
        const next = { ...prev, [id]: updated }
        saveToStorage(STORAGE_KEY_CONFIGS, next)
        return next
      })
    } catch {
      // Silently ignore read errors — use stored config as fallback
    }
  }

  const updateServerConfig = (config: ServerConfig) => {
    setServerConfig(config)
    saveToStorage(STORAGE_KEY_SERVER_CONFIG, config)
  }

  return {
    page, setPage,
    projects, configs, providers,
    activeProjectId, setActiveProjectId,
    activeProject, activeConfig,
    detailTab, setDetailTab,
    showAddProject, setShowAddProject,
    saving, toast, agentBusy, initRunning,
    confirmAction, setConfirmAction,
    confirmThen, showToast,
    saveConfig, startAgent, runInit, updateConfig,
    handleProvidersChange, addProject, removeProject, openProject,
    serverConfig, updateServerConfig,
  }
}
