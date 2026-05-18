import { FileText, Shield, Webhook } from 'lucide-react'
import { useI18n } from '../i18n'
import type { ProjectConfig } from '../types'

export function ClaudeMdSection({ config, onChange }: {
  config: ProjectConfig
  onChange: (c: ProjectConfig) => void
}) {
  const { t } = useI18n()
  return (
    <div className="section">
      <div className="section-header">
        <div className="section-title"><FileText size={17} className="section-icon" /> {t('claudeMd.title')}</div>
      </div>
      <div className="section-subtitle">{t('claudeMd.subtitle')}</div>
      <textarea
        className="textarea"
        value={config.claudeMd}
        onChange={(e) => onChange({ ...config, claudeMd: e.target.value })}
        placeholder={t('claudeMd.placeholder')}
      />
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
