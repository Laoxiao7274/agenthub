import { useState, useEffect } from 'react'
import { Download, X, Check, Loader2 } from 'lucide-react'
import { useI18n } from '../i18n'
import type { CcSwitchProvider } from '../types'
import { APP_TYPE_BADGE, PROVIDER_COLORS } from '../types'

export function CcSwitchImportModal({
  onClose,
  onImport,
}: {
  onClose: () => void
  onImport: (selected: CcSwitchProvider[]) => void
}) {
  const { t } = useI18n()
  const [ccProviders, setCcProviders] = useState<CcSwitchProvider[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        // @ts-ignore — Tauri invoke
        const result = await window.__TAURI_INTERNALS__.invoke('read_cc_switch_providers')
        setCcProviders(result as CcSwitchProvider[])
        // Pre-select current and non-official
        const preSelect = new Set<string>()
        ;(result as CcSwitchProvider[]).forEach((p) => {
          if (p.is_current || p.category !== 'official') preSelect.add(p.id)
        })
        setSelected(preSelect)
      } catch (e: any) {
        setError(e?.toString() || 'Failed to read CC Switch data')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (!ccProviders) return
    setSelected(new Set(ccProviders.map((p) => p.id)))
  }

  const deselectAll = () => setSelected(new Set())

  const handleImport = () => {
    if (!ccProviders) return
    const items = ccProviders.filter((p) => selected.has(p.id))
    onImport(items)
    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <div className="modal-title"><Download size={17} /> {t('ccswitch.title')}</div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {!loading && !error && ccProviders && ccProviders.length > 0 && (
            <div className="modal-desc">{t('ccswitch.desc')}</div>
          )}

          {loading && (
            <div className="ccswitch-loading">
              <Loader2 size={20} className="spin" /> {t('ccswitch.loading')}
            </div>
          )}

          {error && (
            <div className="ccswitch-error">
              <strong>{t('ccswitch.notFound')}</strong>
              <p>{t('ccswitch.notFoundDesc')}</p>
              <p className="ccswitch-error-detail">{error}</p>
            </div>
          )}

          {!loading && !error && ccProviders && ccProviders.length === 0 && (
            <div className="ccswitch-empty">{t('ccswitch.empty')}</div>
          )}

          {!loading && !error && ccProviders && ccProviders.length > 0 && (
            <>
              <div className="ccswitch-toolbar">
                <span className="ccswitch-count">{selected.size} / {ccProviders.length}</span>
                <button className="btn btn-ghost btn-sm" onClick={selectAll}>{t('ccswitch.selectAll')}</button>
                <button className="btn btn-ghost btn-sm" onClick={deselectAll}>{t('ccswitch.deselectAll')}</button>
              </div>
              <div className="mcsm-grid">
                {ccProviders.map((p) => {
                  const badge = APP_TYPE_BADGE[p.app_type]
                  const iconColor = p.icon ? (PROVIDER_COLORS[p.icon] || '#94A3B8') : '#94A3B8'
                  return (
                    <div
                      key={`${p.id}-${p.app_type}`}
                      className={`mcsm-card ${selected.has(p.id) ? 'active' : ''}`}
                      onClick={() => toggleSelect(p.id)}
                    >
                      <div className="mcsm-card-actions">
                        <div className={`mcsm-check ${selected.has(p.id) ? 'checked' : ''}`}>
                          {selected.has(p.id) && <Check size={12} />}
                        </div>
                      </div>
                      <div className="mcsm-card-icon"><div style={{ width: 24, height: 24, borderRadius: '50%', background: iconColor }} /></div>
                      <div className="mcsm-card-name">{p.name}</div>
                      <div className="mcsm-card-status">
                        {p.is_current && <span className="mcsm-status-active">{t('ccswitch.current')}</span>}
                        {!p.is_current && <span className="mcsm-status-idle">{badge?.label || p.app_type}</span>}
                        {badge && !p.is_current && (
                          <span className="mcsm-badge-source" style={{ color: badge.color, borderColor: badge.color + '40' }}>
                            {badge.label}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
        {!loading && !error && ccProviders && ccProviders.length > 0 && (
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>{t('provider.cancel') || 'Cancel'}</button>
            <button className="btn btn-primary" onClick={handleImport} disabled={selected.size === 0}>
              <Download size={13} /> {t('ccswitch.importBtn')} ({selected.size})
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
