import { useState, useEffect, useRef } from 'react'
import {
  FolderKanban, Key, Plug, Users, Play, Plus, Box, Settings,
  Trash2, Save, Loader2, FileText, Shield, Webhook, Cpu, Brain,
  ChevronDown, MessageSquare, BookOpen, Database,
} from 'lucide-react'
import { I18nContext, createI18n } from './i18n'
import type { Lang } from './i18n'
import type { DetailTab, AgentType } from './types'
import { APP_TYPE_BADGE } from './types'
import { ConfirmDialog } from './components/ConfirmDialog'
import { AgentSection } from './components/AgentSection'
import { ProviderSection } from './components/ProviderSection'
import { McpSection } from './components/McpSection'
import { SkillsSection } from './components/SkillsSection'
import { ClaudeMdSection, PermissionsSection, HooksSection } from './components/ProjectDetailTabs'
import { MemorySection } from './components/MemorySection'
import { MemoryPage } from './components/MemoryPage'
import { AnythingLLMSection } from './components/AnythingLLMSection'
import { SettingsPage } from './components/SettingsPage'
import { AddProjectModal } from './components/AddProjectModal'
import { useAppStore } from './hooks/useAppStore'
import { tauri } from './tauri'
import type { ClaudeSession } from './tauri'

const DETAIL_TABS: { key: DetailTab, icon: React.ReactNode, agents?: AgentType[] }[] = [
  { key: 'agent', icon: <Cpu size={13} /> },
  { key: 'provider', icon: <Key size={13} />, agents: ['claude-code', 'codex', 'gemini-cli', 'opencode'] },
  { key: 'mcp', icon: <Plug size={13} />, agents: ['claude-code', 'opencode'] },
  { key: 'skills', icon: <Users size={13} />, agents: ['claude-code'] },
  { key: 'claudeMd', icon: <FileText size={13} />, agents: ['claude-code', 'codex', 'gemini-cli'] },
  { key: 'permissions', icon: <Shield size={13} />, agents: ['claude-code', 'codex'] },
  { key: 'hooks', icon: <Webhook size={13} />, agents: ['claude-code'] },
  { key: 'memory', icon: <Brain size={13} />, agents: ['claude-code'] },
  { key: 'knowledge', icon: <BookOpen size={13} />, agents: ['claude-code'] },
]

// Tab label keys mapping
const TAB_LABEL_KEYS: Record<DetailTab, string> = {
  agent: 'agent.tab',
  provider: 'tab.provider',
  mcp: 'tab.mcp',
  skills: 'tab.skills',
  claudeMd: 'tab.claudeMd',
  permissions: 'tab.permissions',
  hooks: 'tab.hooks',
  memory: 'tab.memory',
  knowledge: 'tab.knowledge',
}

export default function App() {
  const [lang, setLang] = useState<Lang>('zh-CN')
  const i18n = createI18n(lang, setLang)
  const { t } = i18n

  const store = useAppStore()

  return (
    <I18nContext.Provider value={i18n}>
      <div className="app-layout">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-brand">
            <div className="brand-mark">A</div>
            <span className="brand-text">AgentHub</span>
          </div>

          <div className="sidebar-nav">
            <button
              className={`nav-item ${store.page === 'projects' && !store.activeProjectId ? 'active' : ''}`}
              onClick={() => { store.setPage('projects'); store.setActiveProjectId(null); }}
            >
              <FolderKanban size={17} className="nav-icon" /> {t('nav.projects')}
            </button>

            {store.activeProject && (
              <div className="nav-group">
                <div className="nav-group-label">
                  <Box size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
                  {store.activeProject.name}
                </div>
              </div>
            )}

            <button
              className={`nav-item ${store.page === 'memory' ? 'active' : ''}`}
              onClick={() => { store.setPage('memory'); store.setActiveProjectId(null); }}
            >
              <Brain size={17} className="nav-icon" /> {t('nav.memory')}
            </button>

            <button
              className={`nav-item ${store.page === 'wiki' ? 'active' : ''}`}
              onClick={() => { store.setPage('wiki'); store.setActiveProjectId(null); }}
            >
              <Database size={17} className="nav-icon" /> {t('nav.wiki')}
            </button>

            <div style={{ flex: 1 }} />
            <button
              className={`nav-item ${store.page === 'settings' ? 'active' : ''}`}
              onClick={() => { store.setPage('settings'); store.setActiveProjectId(null); }}
            >
              <Settings size={17} className="nav-icon" /> {t('nav.settings')}
            </button>
          </div>

          <div className="sidebar-footer">
            <div className="version-label">AgentHub v0.1.0</div>
          </div>
        </div>

        {/* Main */}
        <div className="main-content">
          <TopBar t={t} store={store} />
          <TabBar t={t} store={store} />
          <div className="page-content">
            <PageContent t={t} store={store} />
          </div>
        </div>
      </div>

      {store.showAddProject && (
        <AddProjectModal
          onClose={() => store.setShowAddProject(false)}
          onAdd={(name, path, isExisting, initSkills) => { store.addProject(name, path, isExisting, initSkills); store.setShowAddProject(false); }}
        />
      )}
      {store.toast && <div className="toast">{store.toast}</div>}
      {store.confirmAction && (
        <ConfirmDialog
          message={store.confirmAction.message}
          onConfirm={store.confirmAction.onConfirm}
          onCancel={() => store.setConfirmAction(null)}
          checkboxLabel={store.confirmAction.checkboxLabel}
        />
      )}
    </I18nContext.Provider>
  )
}

function TopBar({ t, store }: { t: (k: string, params?: Record<string, string>) => string; store: ReturnType<typeof useAppStore> }) {
  return (
    <div className="top-bar">
      <div className="top-bar-title">
        {store.page === 'projects' && !store.activeProjectId && <><FolderKanban size={15} /> {t('projects.title')}</>}
        {store.page === 'settings' && <><Settings size={15} /> {t('settings.title')}</>}
        {store.page === 'memory' && <><Brain size={15} /> {t('nav.memory')}</>}
        {store.page === 'project-detail' && store.activeProject && (
          <><Box size={15} /> {store.activeProject.name}</>
        )}
      </div>
      {store.page === 'projects' && !store.activeProjectId && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn" onClick={() => store.setShowAddProject(true)}>
            <Plus size={12} /> {t('projects.add')}
          </button>
        </div>
      )}
      {store.page === 'project-detail' && store.activeProject && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span
            className="top-bar-path"
            style={{ cursor: 'pointer' }}
            onClick={() => tauri.openFolder(store.activeProject!.path).catch(() => {})}
            title={t('projects.openFolder') || 'Open in explorer'}
          >
            {store.activeProject.path}
          </span>
          <button
            className="btn"
            onClick={store.runInit}
            disabled={store.initRunning}
            title={t('projects.initAgent') || 'Initialize agent'}
          >
            {store.initRunning ? <Loader2 size={12} className="spin" /> : <Cpu size={12} />}
            {store.initRunning ? t('projects.initAgentRunning') : t('projects.initAgent')}
          </button>
          <button
            className="btn"
            onClick={store.saveConfig}
            disabled={store.saving || store.initRunning || !store.activeConfig?.providerId}
            title={t('agent.saveConfig') || 'Save config to disk'}
          >
            {store.saving ? <Loader2 size={12} className="spin" /> : <Save size={12} />}
            {t('agent.saveConfig') || 'Save'}
          </button>
          <StartButton t={t} store={store} />
        </div>
      )}
    </div>
  )
}

function StartButton({ t, store }: { t: (k: string, params?: Record<string, string>) => string; store: ReturnType<typeof useAppStore> }) {
  const [open, setOpen] = useState(false)
  const [sessions, setSessions] = useState<ClaudeSession[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const handleOpen = () => {
    setOpen(!open)
    if (!open && store.activeProject) {
      setLoading(true)
      tauri.listClaudeSessions(store.activeProject.path).then(setSessions).catch(() => setSessions([]))
      .finally(() => setLoading(false))
    }
  }

  const handleNewSession = () => {
    setOpen(false)
    store.startAgent()
  }

  const handleResume = (sessionId: string) => {
    setOpen(false)
    if (!store.activeProject) return
    tauri.resumeClaudeSession(store.activeProject.path, sessionId, store.activeConfig?.model || '', '')
      .then(() => store.showToast(`🚀 ${t('memory.sessionResumed')}`))
      .catch((e: any) => store.showToast(`❌ ${e?.toString() || 'Resume failed'}`))
  }

  const formatTime = (ts: string) => {
    if (!ts) return ''
    try { return new Date(ts).toLocaleString() } catch { return ts }
  }

  const disabled = store.agentBusy || store.initRunning || !store.activeConfig?.providerId

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="btn btn-primary"
        onClick={handleOpen}
        disabled={disabled}
        title={t('agent.startAgent') || 'Start agent'}
      >
        {store.agentBusy ? <Loader2 size={12} className="spin" /> : <Play size={12} />}
        {t('agent.startAgent') || 'Start'} <ChevronDown size={11} />
      </button>
      {open && (
        <div className="start-dropdown">
          <button className="start-dropdown-item start-new" onClick={handleNewSession}>
            <Play size={13} /> {t('memory.newSession')}
          </button>
          {sessions.length > 0 && (
            <div className="start-dropdown-divider" />
          )}
          <div className="start-dropdown-section">
            {loading && <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}><Loader2 size={11} className="spin" /></div>}
            {sessions.slice(0, 8).map((s) => (
              <button key={s.id} className="start-dropdown-item" onClick={() => handleResume(s.id)}>
                <MessageSquare size={12} style={{ flexShrink: 0 }} />
                <span className="start-dropdown-item-text">{s.firstMessage || t('memory.noFirstMessage')}</span>
                <span className="start-dropdown-item-time">{formatTime(s.timestamp)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TabBar({ t, store }: { t: (k: string, params?: Record<string, string>) => string; store: ReturnType<typeof useAppStore> }) {
  if (store.page !== 'project-detail' || !store.activeConfig) return null
  return (
    <div className="tab-bar">
      {DETAIL_TABS
        .filter((tab) => !tab.agents || tab.agents.includes(store.activeConfig!.agentType))
        .map((tab) => (
          <button
            key={tab.key}
            className={`tab-item ${store.detailTab === tab.key ? 'active' : ''}`}
            onClick={() => store.setDetailTab(tab.key)}
          >
            {tab.icon} {t(TAB_LABEL_KEYS[tab.key])}
          </button>
        ))}
    </div>
  )
}

function PageContent({ t, store }: { t: (k: string, params?: Record<string, string>) => string; store: ReturnType<typeof useAppStore> }) {
  if (store.page === 'settings') return <SettingsPage />
  if (store.page === 'memory') return <MemoryPage projects={store.projects} />
  if (store.page === 'wiki') return <AnythingLLMSection />

  if (store.page === 'projects' && !store.activeProjectId) {
    return (
      <div className="mcsm-grid">
        {store.projects.map((project) => (
          <div
            key={project.id}
            className={`mcsm-card ${project.running ? 'active' : ''} ${project.initializing ? 'initializing' : ''}`}
            onClick={() => { if (!project.initializing) store.openProject(project.id) }}
            style={project.initializing ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
          >
            <div className="mcsm-card-actions">
              <button
                className="btn btn-ghost btn-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  tauri.openFolder(project.path).catch(() => {})
                }}
                title={t('projects.openFolder') || 'Open folder'}
              >
                <FolderKanban size={12} />
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  store.setConfirmAction({
                    message: t('confirm.deleteProject', { name: project.name }),
                    onConfirm: (deleteFolder?: boolean) => store.removeProject(project.id, !!deleteFolder),
                    checkboxLabel: t('confirm.deleteFolder', { path: project.path }),
                  })
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
            <div className="mcsm-card-header">
              <div className="mcsm-card-icon">
                <div className="project-avatar">{project.initial}</div>
              </div>
              <div className="mcsm-card-name">{project.name}</div>
            </div>
            <div
              className="mcsm-card-path"
              onClick={(e) => {
                e.stopPropagation()
                tauri.openFolder(project.path).catch(() => {})
              }}
              title={t('projects.openFolder') || 'Open folder'}
            >
              {project.path}
            </div>
            <div className="mcsm-card-status">
              {project.initializing ? (
                <>
                  <Loader2 size={10} className="spin" style={{ verticalAlign: -1 }} />
                  <span className="mcsm-status-idle" style={{ marginLeft: 4 }}>{t('projects.initializing') || 'Initializing...'}</span>
                </>
              ) : (
                <>
                  <span className={`status-dot ${project.running ? 'running' : 'stopped'}`} />
                  {project.running
                    ? <span className="mcsm-status-active">{t('projects.open')}</span>
                    : <span className="mcsm-status-idle">{project.lastUsed}</span>
                  }
                  {store.configs[project.id] && (() => {
                    const badge = APP_TYPE_BADGE[store.configs[project.id].agentType]
                    return badge ? (
                      <span style={{
                        fontSize: 9, fontWeight: 600, padding: '1px 5px',
                        borderRadius: 3, marginLeft: 'auto',
                        background: badge.color + '18', color: badge.color,
                        border: `1px solid ${badge.color}33`,
                      }}>{badge.label}</span>
                    ) : null
                  })()}
                </>
              )}
            </div>
          </div>
        ))}
        <div
          className="mcsm-card"
          style={{ borderStyle: 'dashed', opacity: 0.6 }}
          onClick={() => store.setShowAddProject(true)}
        >
          <div className="mcsm-card-icon"><Plus size={20} style={{ color: 'var(--text-muted)' }} /></div>
          <div className="mcsm-card-name">{t('projects.add')}</div>
          <div className="mcsm-card-status">
            <span className="mcsm-status-idle">{t('projects.addDesc')}</span>
          </div>
        </div>
      </div>
    )
  }

  if (store.page === 'project-detail' && store.activeConfig) {
    return (
      <>
        {store.detailTab === 'agent' && (
          <AgentSection config={store.activeConfig} onChange={store.updateConfig} />
        )}
        {store.detailTab === 'provider' && (
          <ProviderSection
            config={store.activeConfig}
            onChange={store.updateConfig}
            providers={store.providers}
            onProvidersChange={store.handleProvidersChange}
            confirmThen={store.confirmThen}
          />
        )}
        {store.detailTab === 'mcp' && (
          <McpSection config={store.activeConfig} onChange={store.updateConfig} confirmThen={store.confirmThen} />
        )}
        {store.detailTab === 'skills' && (
          <SkillsSection
            config={store.activeConfig}
            onChange={store.updateConfig}
            confirmThen={store.confirmThen}
            providers={store.providers}
            activeProject={store.activeProject}
            showToast={store.showToast}
          />
        )}
        {store.detailTab === 'claudeMd' && (
          <ClaudeMdSection
            config={store.activeConfig}
            onChange={store.updateConfig}
            providers={store.providers}
            activeProject={store.activeProject}
            showToast={store.showToast}
          />
        )}
        {store.detailTab === 'permissions' && (
          <PermissionsSection config={store.activeConfig} onChange={store.updateConfig} />
        )}
        {store.detailTab === 'hooks' && (
          <HooksSection config={store.activeConfig} onChange={store.updateConfig} />
        )}
        {store.detailTab === 'memory' && (
          <MemorySection activeProject={store.activeProject} />
        )}
        {store.detailTab === 'knowledge' && (
          <AnythingLLMSection />
        )}
      </>
    )
  }

  return null
}
