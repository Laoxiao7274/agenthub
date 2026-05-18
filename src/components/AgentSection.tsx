import { Cpu } from 'lucide-react'
import { useI18n } from '../i18n'
import type { ProjectConfig } from '../types'
import { AGENT_TYPES } from '../types'

export function AgentSection({
  config,
  onChange,
}: {
  config: ProjectConfig
  onChange: (c: ProjectConfig) => void
}) {
  const { t } = useI18n()

  return (
    <div className="section">
      <div className="section-header">
        <div className="section-title"><Cpu size={17} className="section-icon" /> {t('agent.title')}</div>
      </div>
      <div className="mcsm-grid">
        {AGENT_TYPES.map((agent) => (
          <div
            key={agent.value}
            className={`mcsm-card ${config.agentType === agent.value ? 'active' : ''} ${agent.disabled ? 'disabled' : ''}`}
            onClick={() => !agent.disabled && onChange({ ...config, agentType: agent.value })}
          >
            <div className="mcsm-card-icon">
              <img
                src={new URL(`../assets/${agent.icon}`, import.meta.url).href}
                alt={agent.label}
                style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'contain' }}
                onError={(e) => {
                  const target = e.currentTarget
                  target.style.display = 'none'
                  target.nextElementSibling && ((target.nextElementSibling as HTMLElement).style.display = 'flex')
                }}
              />
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: agent.color, display: 'none',
                alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 13, fontWeight: 600,
              }}>
                {agent.label.charAt(0)}
              </div>
            </div>
            <div className="mcsm-card-name">{agent.label}</div>
            <div className="mcsm-card-status">
              {agent.disabled
                ? <span className="mcsm-status-soon">{t('agent.comingSoon')}</span>
                : config.agentType === agent.value
                  ? <span className="mcsm-status-active">{t('provider.active')}</span>
                  : <span className="mcsm-status-idle">{t('provider.switch')}</span>
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
