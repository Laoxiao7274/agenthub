import { FileText, Shield, Webhook } from 'lucide-react'
import { useI18n } from '../i18n'
import type { ProjectConfig, DetailTab, AgentType } from '../types'
import { AgentSection } from './AgentSection'
import { ProviderSection } from './ProviderSection'
import { McpSection } from './McpSection'
import { SkillsSection } from './SkillsSection'

export function ProjectDetailContent({
  activeConfig,
  detailTab,
  updateConfig,
  providers,
  handleProvidersChange,
  confirmThen,
}: {
  activeConfig: ProjectConfig
  detailTab: DetailTab
  updateConfig: (c: ProjectConfig) => void
  providers: import('../types').Provider[]
  handleProvidersChange: (p: import('../types').Provider[]) => void
  confirmThen: (msg: string, fn: () => void) => void
}) {
  const { t } = useI18n()

  return (
    <>
      {detailTab === 'agent' && (
        <AgentSection config={activeConfig} onChange={updateConfig} />
      )}
      {detailTab === 'provider' && (
        <ProviderSection
          config={activeConfig}
          onChange={updateConfig}
          providers={providers}
          onProvidersChange={handleProvidersChange}
          confirmThen={confirmThen}
        />
      )}
      {detailTab === 'mcp' && <McpSection config={activeConfig} onChange={updateConfig} confirmThen={confirmThen} />}
      {detailTab === 'skills' && <SkillsSection config={activeConfig} onChange={updateConfig} confirmThen={confirmThen} />}

      {detailTab === 'claudeMd' && (
        <div className="section">
          <div className="section-header">
            <div className="section-title"><FileText size={17} className="section-icon" /> {t('claudeMd.title')}</div>
          </div>
          <div className="section-subtitle">{t('claudeMd.subtitle')}</div>
          <textarea className="textarea" value={activeConfig.claudeMd} onChange={(e) => updateConfig({ ...activeConfig, claudeMd: e.target.value })} placeholder={t('claudeMd.placeholder')} />
        </div>
      )}

      {detailTab === 'permissions' && (
        <div className="section">
          <div className="section-header">
            <div className="section-title"><Shield size={17} className="section-icon" /> {t('permissions.title')}</div>
          </div>
          <div className="perm-cards">
            {([
              { value: 'default', label: t('permissions.default'), desc: t('permissions.defaultDesc'), level: 'safe' },
              { value: 'plan', label: t('permissions.plan'), desc: t('permissions.planDesc'), level: 'safe' },
              { value: 'auto', label: t('permissions.auto'), desc: t('permissions.autoDesc'), level: 'warn' },
              { value: 'bypassPermissions', label: t('permissions.bypass'), desc: t('permissions.bypassDesc'), level: 'danger' },
            ]).map((mode) => (
              <div key={mode.value} className={`perm-card ${activeConfig.permissionMode === mode.value ? 'active' : ''}`} onClick={() => updateConfig({ ...activeConfig, permissionMode: mode.value })}>
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
      )}

      {detailTab === 'hooks' && (
        <div className="section">
          <div className="section-header">
            <div className="section-title"><Webhook size={17} className="section-icon" /> {t('hooks.title')}</div>
          </div>
          <div className="section-subtitle">{t('hooks.subtitle')}</div>
          {([
            { key: 'preToolUse' as const, label: t('hooks.preToolUse') },
            { key: 'postToolUse' as const, label: t('hooks.postToolUse') },
            { key: 'notification' as const, label: t('hooks.notification') },
            { key: 'stop' as const, label: t('hooks.stop') },
          ]).map(({ key, label }) => (
            <div key={key} className="hook-row">
              <span className="hook-label">{label}</span>
              <input className="hook-input" type="text" placeholder={t('hooks.placeholder')} value={activeConfig.hooks[key]} onChange={(e) => updateConfig({ ...activeConfig, hooks: { ...activeConfig.hooks, [key]: e.target.value } })} />
            </div>
          ))}
        </div>
      )}
    </>
  )
}
