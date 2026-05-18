import { Plug, Plus, Trash2 } from 'lucide-react'
import { useI18n } from '../i18n'
import type { ProjectConfig, McpServer } from '../types'

export function McpSection({
  config,
  onChange,
  confirmThen,
}: {
  config: ProjectConfig
  onChange: (c: ProjectConfig) => void
  confirmThen: (msg: string, fn: () => void) => void
}) {
  const { t } = useI18n()
  const addMcp = () => {
    onChange({ ...config, mcpServers: [...config.mcpServers, { id: Date.now().toString(), name: '', command: '', args: '', enabled: true }] })
  }
  const removeMcp = (id: string) => onChange({ ...config, mcpServers: config.mcpServers.filter((s) => s.id !== id) })
  const updateMcp = (id: string, field: keyof McpServer, value: string | boolean) => {
    onChange({ ...config, mcpServers: config.mcpServers.map((s) => s.id === id ? { ...s, [field]: value } : s) })
  }

  return (
    <div className="section">
      <div className="section-header">
        <div className="section-title"><Plug size={17} className="section-icon" /> {t('mcp.title')}</div>
        <button className="btn" onClick={addMcp}><Plus size={12} /> {t('mcp.add')}</button>
      </div>
      {config.mcpServers.length === 0 && <div className="mcsm-empty">{t('mcp.empty')}</div>}
      <div className="mcsm-grid">
        {config.mcpServers.map((server) => (
          <div key={server.id} className={`mcsm-card ${server.enabled ? 'active' : ''}`} onClick={() => updateMcp(server.id, 'enabled', !server.enabled)}>
            <div className="mcsm-card-actions">
              <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); confirmThen(t('confirm.deleteMcp', { name: server.name || 'unnamed' }), () => removeMcp(server.id)); }}>
                <Trash2 size={12} />
              </button>
            </div>
            <div className="mcsm-card-icon"><Plug size={20} style={{ color: 'var(--purple)' }} /></div>
            <div className="mcsm-card-name">{server.name || t('mcp.namePlaceholder')}</div>
            <div className="mcsm-card-status">
              {server.enabled
                ? <span className="mcsm-status-active">{t('provider.active')}</span>
                : <span className="mcsm-status-idle">{t('provider.switch')}</span>
              }
            </div>
          </div>
        ))}
      </div>
      {config.mcpServers.map((server) => (
        <div key={`edit-${server.id}`} className="config-card" style={{ marginTop: 8 }}>
          <div className="config-card-header">
            <input className="input" style={{ flex: 1, fontWeight: 600 }} type="text" placeholder={t('mcp.namePlaceholder')} value={server.name} onChange={(e) => updateMcp(server.id, 'name', e.target.value)} />
          </div>
          <div className="config-card-fields">
            <div className="field-row"><span className="field-label">{t('mcp.command')}</span><input className="input" type="text" placeholder={t('mcp.commandPlaceholder')} value={server.command} onChange={(e) => updateMcp(server.id, 'command', e.target.value)} /></div>
            <div className="field-row"><span className="field-label">{t('mcp.args')}</span><input className="input" type="text" placeholder={t('mcp.argsPlaceholder')} value={server.args} onChange={(e) => updateMcp(server.id, 'args', e.target.value)} /></div>
          </div>
        </div>
      ))}
    </div>
  )
}
