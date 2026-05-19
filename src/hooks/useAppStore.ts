import { useState, useRef } from 'react'
import { tauri } from '../tauri'
import type { Project, Provider, ProjectConfig, Page, DetailTab } from '../types'
import {
  DEFAULT_PROVIDERS, MOCK_PROJECTS, MOCK_CONFIGS,
  STORAGE_KEY_PROVIDERS, STORAGE_KEY_CONFIGS, STORAGE_KEY_PROJECTS,
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

  const activeProject = projects.find((p) => p.id === activeProjectId)
  const activeConfig = activeProjectId ? configs[activeProjectId] : null

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
        buildConfigInput(activeProject.path, activeConfig, providers),
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
        activeProject.path,
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
      await tauri.initAgent(activeProject.path)
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
      await writeConfigSilent(activeProject.path, config, providers)
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

  const addProject = async (name: string, path: string) => {
    const id = `p-${Date.now()}`
    const initial = name.charAt(0).toUpperCase()
    const newProject: Project = { id, name, path, initial, lastUsed: 'Just now', running: false, initializing: true }
    const newConfig: ProjectConfig = {
      agentType: 'claude-code', providerId: '', model: '', smallModel: '', advisorModel: '',
      claudeMd: '', permissionMode: 'default', mcpServers: [], skills: [],
      hooks: { preToolUse: '', postToolUse: '', notification: '', stop: '' },
    }
    // Add project to UI immediately (with initializing flag)
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
    // Run init in background (download skills)
    try {
      await tauri.ensureFolder(path)
      await writeConfigSilent(path, newConfig, providers)
      await tauri.initProject(path)
      showToast('✅ Project ready')
    } catch {
      showToast('⚠️ Project init partially failed')
    } finally {
      // Mark as initialized
      setProjects((prev) => {
        const next = prev.map((p) => p.id === id ? { ...p, initializing: false } : p)
        saveToStorage(STORAGE_KEY_PROJECTS, next)
        return next
      })
    }
    // Open project detail
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
      const disk = await tauri.readProjectConfig(project.path)
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

      setConfigs((prev) => {
        const next = { ...prev, [id]: updated }
        saveToStorage(STORAGE_KEY_CONFIGS, next)
        return next
      })
    } catch {
      // Silently ignore read errors — use stored config as fallback
    }
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
  }
}
