import { useState } from 'react'
import { FileText, Shield, Webhook, Sparkles, Loader2 } from 'lucide-react'
import { useI18n } from '../i18n'
import type { ProjectConfig, Provider, Project } from '../types'
import { tauri } from '../tauri'

export function ClaudeMdSection({
  config,
  onChange,
  providers,
  activeProject,
  showToast,
}: {
  config: ProjectConfig
  onChange: (c: ProjectConfig) => void
  providers: Provider[]
  activeProject: Project | null | undefined
  showToast: (msg: string) => void
}) {
  const { t, lang } = useI18n()
  const [aiLoading, setAiLoading] = useState(false)

  const provider = providers.find((p) => p.id === config.providerId)
  const getApiConfig = () => {
    if (!provider || !provider.apiKey || !provider.baseUrl || !provider.model) {
      showToast(t('ai.noProvider'))
      return null
    }
    return { base_url: provider.baseUrl, api_key: provider.apiKey, model: config.model || provider.model }
  }

  const handleAiAnalyze = async () => {
    const apiConfig = getApiConfig()
    if (!apiConfig || !activeProject) return
    setAiLoading(true)
    try {
      const res = await tauri.aiChat({
        ...apiConfig,
        lang,
        messages: [
          { role: 'user', content: `Analyze this CLAUDE.md file in 3-5 concise sentences. What project rules, conventions, and key information does it define?\n\n${config.claudeMd || '(empty)'}` },
        ],
      })
      onChange({ ...config, claudeMdSummary: res.reply })
      showToast(t('ai.applied'))
    } catch (e: any) {
      showToast(`❌ ${e?.toString() || 'Failed'}`)
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="section">
      <div className="section-header">
        <div className="section-title"><FileText size={17} className="section-icon" /> {t('claudeMd.title')}</div>
        <button
          className="btn"
          onClick={handleAiAnalyze}
          disabled={aiLoading || !config.claudeMd}
        >
          {aiLoading ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
          {t('ai.analyze')}
        </button>
      </div>
      {config.claudeMdSummary && (
        <div className="ai-insight-card">
          <div className="ai-insight-header"><Sparkles size={13} /> AI {t('ai.analyze')}</div>
          <div className="ai-insight-body">{config.claudeMdSummary}</div>
        </div>
      )}
      <div className="section-subtitle">{t('claudeMd.subtitle')}</div>
      {config.claudeMd ? (
        <div className="skill-prompt-view">
          <pre className="skill-prompt-content" style={{ maxHeight: 400 }}>{config.claudeMd}</pre>
        </div>
      ) : (
        <div className="mcsm-empty" style={{ padding: 16 }}>{t('claudeMd.placeholder')}</div>
      )}
    </div>
  )
}

export function PermissionsSection({ config, onChange }: {
  config: ProjectConfig
  onChange: (c: ProjectConfig) => void
}) {
  const { t } = useI18n()
  const modes = [
    { value: 'default', label: t('permissions.default'), desc: t('permissions.defaultDesc'), level: 'safe' },
    { value: 'plan', label: t('permissions.plan'), desc: t('permissions.planDesc'), level: 'safe' },
    { value: 'auto', label: t('permissions.auto'), desc: t('permissions.autoDesc'), level: 'warn' },
    { value: 'bypassPermissions', label: t('permissions.bypass'), desc: t('permissions.bypassDesc'), level: 'danger' },
  ] as const

  return (
    <div className="section">
      <div className="section-header">
        <div className="section-title"><Shield size={17} className="section-icon" /> {t('permissions.title')}</div>
      </div>
      <div className="perm-cards">
        {modes.map((mode) => (
          <div
            key={mode.value}
            className={`perm-card ${config.permissionMode === mode.value ? 'active' : ''}`}
            onClick={() => onChange({ ...config, permissionMode: mode.value })}
          >
            <div className={`perm-indicator perm-${mode.level}`} />
            <div className="perm-dot" />
            <div className="perm-info">
              <strong>{mode.label}</strong>
              <span>{mode.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function HooksSection({ config, onChange }: {
  config: ProjectConfig
  onChange: (c: ProjectConfig) => void
}) {
  const { t } = useI18n()
  const hookKeys = [
    { key: 'preToolUse' as const, label: t('hooks.preToolUse') },
    { key: 'postToolUse' as const, label: t('hooks.postToolUse') },
    { key: 'notification' as const, label: t('hooks.notification') },
    { key: 'stop' as const, label: t('hooks.stop') },
  ]

  return (
    <div className="section">
      <div className="section-header">
        <div className="section-title"><Webhook size={17} className="section-icon" /> {t('hooks.title')}</div>
      </div>
      <div className="section-subtitle">{t('hooks.subtitle')}</div>
      {hookKeys.map(({ key, label }) => (
        <div key={key} className="hook-row">
          <span className="hook-label">{label}</span>
          <input
            className="hook-input"
            type="text"
            placeholder={t('hooks.placeholder')}
            value={config.hooks[key]}
            onChange={(e) => onChange({ ...config, hooks: { ...config.hooks, [key]: e.target.value } })}
          />
        </div>
      ))}
    </div>
  )
}
