import { useState } from 'react'
import {
  FolderKanban, Key, Plug, Users, Play, Plus, Box, Settings,
  Trash2, Save, Loader2, FileText, Shield, Webhook, Cpu,
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
import { SettingsPage } from './components/SettingsPage'
import { AddProjectModal } from './components/AddProjectModal'
import { useAppStore } from './hooks/useAppStore'
import { tauri } from './tauri'

const DETAIL_TABS: { key: DetailTab, icon: React.ReactNode, agents?: AgentType[] }[] = [
  { key: 'agent', icon: <Cpu size={13} /> },
  { key: 'provider', icon: <Key size={13} />, agents: ['claude-code', 'codex', 'gemini-cli', 'opencode'] },
  { key: 'mcp', icon: <Plug size={13} />, agents: ['claude-code', 'opencode'] },
  { key: 'skills', icon: <Users size={13} />, agents: ['claude-code'] },
  { key: 'claudeMd', icon: <FileText size={13} />, agents: ['claude-code', 'codex', 'gemini-cli'] },
  { key: 'permissions', icon: <Shield size={13} />, agents: ['claude-code', 'codex'] },
  { key: 'hooks', icon: <Webhook size={13} />, agents: ['claude-code'] },
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
          onAdd={(name, path) => { store.addProject(name, path); store.setShowAddProject(false); }}
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
          <button
            className="btn btn-primary"
            onClick={store.startAgent}
            disabled={store.agentBusy || store.initRunning || !store.activeConfig?.providerId}
            title={t('agent.startAgent') || 'Start agent'}
          >
            {store.agentBusy ? <Loader2 size={12} className="spin" /> : <Play size={12} />}
            {t('agent.startAgent') || 'Start'}
          </button>
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
          <ClaudeMdSection config={store.activeConfig} onChange={store.updateConfig} />
        )}
        {store.detailTab === 'permissions' && (
          <PermissionsSection config={store.activeConfig} onChange={store.updateConfig} />
        )}
        {store.detailTab === 'hooks' && (
          <HooksSection config={store.activeConfig} onChange={store.updateConfig} />
        )}
      </>
    )
  }

  return null
}
