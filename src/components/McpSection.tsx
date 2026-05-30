import { useState } from 'react'
import { Plug, Plus, Trash2, X } from 'lucide-react'
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
  const [editingServer, setEditingServer] = useState<McpServer | null>(null)

  const addMcp = () => {
    const newServer: McpServer = { id: Date.now().toString(), name: '', command: '', args: '', enabled: true }
    onChange({ ...config, mcpServers: [...config.mcpServers, newServer] })
    setEditingServer(newServer)
  }

  const removeMcp = (id: string) => {
    onChange({ ...config, mcpServers: config.mcpServers.filter((s) => s.id !== id) })
    if (editingServer?.id === id) setEditingServer(null)
  }

  const updateMcp = (id: string, field: keyof McpServer, value: string | boolean) => {
    const updated = { ...config, mcpServers: config.mcpServers.map((s) => s.id === id ? { ...s, [field]: value } : s) }
    onChange(updated)
    if (editingServer?.id === id) {
      setEditingServer(updated.mcpServers.find((s) => s.id === id) || null)
    }
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
          <div key={server.id} className="mcsm-card" onClick={() => setEditingServer(server)}>
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

      {editingServer && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div className="modal-title"><Plug size={17} /> {editingServer.name || t('mcp.namePlaceholder')}</div>
              <button className="modal-close" onClick={() => setEditingServer(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="field-row">
                <span className="field-label">{t('mcp.name')}</span>
                <input
                  className="input"
                  type="text"
                  placeholder={t('mcp.namePlaceholder')}
                  value={editingServer.name}
                  onChange={(e) => updateMcp(editingServer.id, 'name', e.target.value)}
                  autoFocus
                />
              </div>
              <div className="field-row">
                <span className="field-label">{t('mcp.command')}</span>
                <input
                  className="input"
                  type="text"
                  placeholder={t('mcp.commandPlaceholder')}
                  value={editingServer.command}
                  onChange={(e) => updateMcp(editingServer.id, 'command', e.target.value)}
                />
              </div>
              <div className="field-row">
                <span className="field-label">{t('mcp.args')}</span>
                <input
                  className="input"
                  type="text"
                  placeholder={t('mcp.argsPlaceholder')}
                  value={editingServer.args}
                  onChange={(e) => updateMcp(editingServer.id, 'args', e.target.value)}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={editingServer.enabled}
                  onChange={(e) => updateMcp(editingServer.id, 'enabled', e.target.checked)}
                />
                {t('provider.active')}
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setEditingServer(null)}>{t('mcp.done') || 'Done'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
