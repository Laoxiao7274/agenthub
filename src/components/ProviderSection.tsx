import { useState, Fragment } from 'react'
import { Key, Plus, Download, Settings, Trash2 } from 'lucide-react'
import { useI18n } from '../i18n'
import type { ProjectConfig, Provider, CcSwitchProvider } from '../types'
import { CcSwitchImportModal } from './CcSwitchImportModal'

export function ProviderSection({
  config,
  onChange,
  providers,
  onProvidersChange,
  confirmThen,
}: {
  config: ProjectConfig
  onChange: (c: ProjectConfig) => void
  providers: Provider[]
  onProvidersChange: (p: Provider[]) => void
  confirmThen: (msg: string, fn: () => void) => void
}) {
  const { t } = useI18n()
  const [showCcSwitch, setShowCcSwitch] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const handleCcSwitchImport = (items: CcSwitchProvider[]) => {
    const newProviders = [...providers]
    for (const item of items) {
      const exists = newProviders.some((p) => p.ccswitchId === `${item.id}::${item.app_type}`)
      if (exists) continue

      const id = `ccswitch-${item.id}-${item.app_type}`
      newProviders.push({
        id,
        name: item.name,
        apiKey: item.api_key,
        baseUrl: item.base_url,
        model: item.model || '',
        smallModel: '',
        advisorModel: '',
        source: 'ccswitch',
        ccswitchId: `${item.id}::${item.app_type}`,
      })

      if (item.is_current) {
        onChange({ ...config, providerId: id, model: item.model || '', smallModel: '', advisorModel: '' })
      }
    }
    onProvidersChange(newProviders)
  }

  const addCustomProvider = () => {
    const id = `custom-${Date.now()}`
    const newProviders = [...providers, {
      id, name: 'Custom', apiKey: '', baseUrl: '', model: '', smallModel: '', advisorModel: '', source: 'manual' as const,
    }]
    onProvidersChange(newProviders)
    setEditingId(id)
  }

  const updateProvider = (id: string, field: keyof Provider, value: string | string[]) => {
    onProvidersChange(providers.map((p) => p.id === id ? { ...p, [field]: value } : p))
  }

  const removeProvider = (id: string) => {
    onProvidersChange(providers.filter((p) => p.id !== id))
    if (config.providerId === id) onChange({ ...config, providerId: '', model: '' })
    if (editingId === id) setEditingId(null)
  }

  const selectProvider = (id: string) => {
    const p = providers.find((x) => x.id === id)
    onChange({ ...config, providerId: id, model: p?.model || '', smallModel: p?.smallModel || '', advisorModel: p?.advisorModel || '' })
    setEditingId(null)
  }

  return (
    <div className="section">
      <div className="section-header">
        <div className="section-title"><Key size={17} className="section-icon" /> {t('provider.title')}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn" onClick={addCustomProvider}><Plus size={12} /> {t('provider.addCustom')}</button>
          <button className="btn" onClick={() => setShowCcSwitch(true)}>
            <Download size={12} /> {t('ccswitch.import')}
          </button>
        </div>
      </div>

      <div className="mcsm-grid">
        {providers.length === 0 && (
          <div className="mcsm-empty">{t('provider.addCustom')}</div>
        )}
        {providers.map((p) => {
          const isActive = config.providerId === p.id
          const isEditing = editingId === p.id
          return (
            <Fragment key={p.id}>
              <div
                className={`mcsm-card ${isActive ? 'active' : ''}`}
                onClick={() => { selectProvider(p.id); setEditingId(null); }}
              >
                <div className="mcsm-card-actions">
                  <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setEditingId(isEditing ? null : p.id); }}>
                    <Settings size={12} />
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); confirmThen(t('confirm.deleteProvider', { name: p.name }), () => removeProvider(p.id)); }}>
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className="mcsm-card-icon"><Key size={20} style={{ color: 'var(--purple)' }} /></div>
                <div className="mcsm-card-name">{p.name}</div>
                <div className="mcsm-card-status">
                  {isActive
                    ? <span className="mcsm-status-active">{t('provider.active')}</span>
                    : <span className="mcsm-status-idle">{t('provider.switch')}</span>
                  }
                  {p.model && <span className="mcsm-status-idle">{p.model}</span>}
                  {p.source === 'ccswitch' && <span className="mcsm-badge-source">CC</span>}
                </div>
              </div>
              {isEditing && (
                <div className="mcsm-edit-panel">
                  <div className="field-row">
                    <span className="field-label">{t('provider.service')}</span>
                    <input className="input" type="text" value={p.name} onChange={(e) => updateProvider(p.id, 'name', e.target.value)} />
                  </div>
                  <div className="field-row">
                    <span className="field-label">{t('provider.apiKey')}</span>
                    <input className="input" type="password" placeholder={t('provider.apiKeyPlaceholder', { name: p.name })} value={p.apiKey} onChange={(e) => updateProvider(p.id, 'apiKey', e.target.value)} />
                  </div>
                  <div className="field-row">
                    <span className="field-label">{t('provider.baseUrl')}</span>
                    <input className="input" type="text" placeholder="https://api.example.com/v1" value={p.baseUrl} onChange={(e) => updateProvider(p.id, 'baseUrl', e.target.value)} />
                  </div>
                  <div className="field-row">
                    <span className="field-label">{t('provider.model')}</span>
                    <input className="input" type="text" placeholder="claude-sonnet-4-20250514" value={p.model} onChange={(e) => updateProvider(p.id, 'model', e.target.value)} />
                  </div>
                  <div className="field-row">
                    <span className="field-label">{t('provider.smallModel')}</span>
                    <input className="input" type="text" placeholder="claude-haiku-3-20250514" value={p.smallModel} onChange={(e) => updateProvider(p.id, 'smallModel', e.target.value)} />
                  </div>
                  <div className="field-row">
                    <span className="field-label">{t('provider.advisorModel')}</span>
                    <input className="input" type="text" placeholder="claude-opus-4-20250514" value={p.advisorModel} onChange={(e) => updateProvider(p.id, 'advisorModel', e.target.value)} />
                  </div>
                </div>
              )}
            </Fragment>
          )
        })}
      </div>

      {showCcSwitch && (
        <CcSwitchImportModal
          onClose={() => setShowCcSwitch(false)}
          onImport={handleCcSwitchImport}
        />
      )}
    </div>
  )
}
