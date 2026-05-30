import { useState, useEffect, useRef } from 'react'
import { Globe, RefreshCw, Info, ExternalLink, FileText, Trash2, FolderOpen, Server, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { useI18n, LANG_OPTIONS } from '../i18n'
import type { Lang } from '../i18n'
import CustomSelect from './Select'
import { tauri } from '../tauri'
import type { ServerConfig } from '../types'
import { useAppStore } from '../hooks/useAppStore'

export function SettingsPage() {
  const { t, lang, setLang } = useI18n()
  const { serverConfig, updateServerConfig } = useAppStore()

  // Server connection tests
  const [qdrantStatus, setQdrantStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [wikiStatus, setWikiStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')

  // Logs viewer
  const [logs, setLogs] = useState('')
  const [logsLoading, setLogsLoading] = useState(false)
  const logRef = useRef<HTMLPreElement>(null)

  const updateField = (field: keyof ServerConfig, value: string) => {
    updateServerConfig({ ...serverConfig, [field]: value })
  }

  const testQdrant = async () => {
    setQdrantStatus('testing')
    try {
      await tauri.qdrantHealth(serverConfig.qdrantUrl, serverConfig.qdrantApiKey)
      setQdrantStatus('ok')
    } catch {
      setQdrantStatus('fail')
    }
  }

  const testWiki = async () => {
    setWikiStatus('testing')
    try {
      await tauri.anythingLLMHealth(serverConfig.anythingLLMUrl, serverConfig.anythingLLMApiKey)
      setWikiStatus('ok')
    } catch {
      setWikiStatus('fail')
    }
  }

  const loadLogs = async () => {
    setLogsLoading(true)
    try {
      const text = await tauri.getLogs(500)
      setLogs(text)
    } catch { /* empty */ } finally {
      setLogsLoading(false)
    }
  }

  const handleClearLogs = async () => {
    try {
      await tauri.clearLogs()
      setLogs('')
    } catch { /* empty */ }
  }

  const handleOpenLogDir = async () => {
    try { await tauri.openLogDir() } catch { /* empty */ }
  }

  useEffect(() => {
    if (logs && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div style={{ maxWidth: 740 }}>
      <div className="section">
        <div className="section-header">
          <div className="section-title"><Globe size={17} className="section-icon" /> {t('settings.general')}</div>
        </div>
        <div className="field-row">
          <span className="field-label">{t('settings.language')}</span>
          <CustomSelect
            value={lang}
            onChange={(v) => setLang(v as Lang)}
            options={LANG_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
          />
        </div>
        <div className="field-row">
          <span className="field-label">{t('settings.theme')}</span>
          <CustomSelect
            value="light"
            onChange={() => {}}
            options={[
              { value: 'light', label: t('settings.themeLight') },
              { value: 'dark', label: t('settings.themeDark') },
              { value: 'system', label: t('settings.themeSystem') },
            ]}
          />
        </div>
        <div className="field-row">
          <span className="field-label">{t('settings.autoStart')}</span>
          <label className="toggle-wrap"><input type="checkbox" defaultChecked /><span className="toggle-track" /></label>
        </div>
        <div className="field-row">
          <span className="field-label">{t('settings.minimizeToTray')}</span>
          <label className="toggle-wrap"><input type="checkbox" defaultChecked /><span className="toggle-track" /></label>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <div className="section-title"><Server size={17} className="section-icon" /> {t('settings.server')}</div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 2px', marginBottom: 10 }}>
          {t('settings.serverDesc')}
        </div>

        <div className="field-row">
          <span className="field-label">Qdrant URL</span>
          <input
            className="memory-input"
            type="text"
            value={serverConfig.qdrantUrl}
            onChange={(e) => updateField('qdrantUrl', e.target.value)}
            placeholder="http://..."
          />
        </div>
        <div className="field-row">
          <span className="field-label">Qdrant API Key</span>
          <input
            className="memory-input"
            type="password"
            value={serverConfig.qdrantApiKey}
            onChange={(e) => updateField('qdrantApiKey', e.target.value)}
            placeholder="API Key"
          />
          <button className="btn" onClick={testQdrant} disabled={qdrantStatus === 'testing'}>
            {qdrantStatus === 'testing' ? <Loader2 size={12} className="spin" /> : t('settings.testConnection')}
          </button>
          {qdrantStatus === 'ok' && <CheckCircle size={14} style={{ color: 'var(--green)' }} />}
          {qdrantStatus === 'fail' && <XCircle size={14} style={{ color: 'var(--red)' }} />}
        </div>
        <div className="field-row">
          <span className="field-label">{t('settings.defaultCollection')}</span>
          <input
            className="memory-input"
            type="text"
            value={serverConfig.qdrantCollection}
            onChange={(e) => updateField('qdrantCollection', e.target.value)}
            placeholder="mem0"
          />
        </div>
        <div className="field-row">
          <span className="field-label">AnythingLLM URL</span>
          <input
            className="memory-input"
            type="text"
            value={serverConfig.anythingLLMUrl}
            onChange={(e) => updateField('anythingLLMUrl', e.target.value)}
            placeholder="http://..."
          />
        </div>
        <div className="field-row">
          <span className="field-label">AnythingLLM API Key</span>
          <input
            className="memory-input"
            type="password"
            value={serverConfig.anythingLLMApiKey}
            onChange={(e) => updateField('anythingLLMApiKey', e.target.value)}
            placeholder="API Key"
          />
          <button className="btn" onClick={testWiki} disabled={wikiStatus === 'testing'}>
            {wikiStatus === 'testing' ? <Loader2 size={12} className="spin" /> : t('settings.testConnection')}
          </button>
          {wikiStatus === 'ok' && <CheckCircle size={14} style={{ color: 'var(--green)' }} />}
          {wikiStatus === 'fail' && <XCircle size={14} style={{ color: 'var(--red)' }} />}
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <div className="section-title"><RefreshCw size={17} className="section-icon" /> {t('settings.updates')}</div>
        </div>
        <div className="field-row">
          <span className="field-label">{t('settings.checkNow')}</span>
          <button className="btn">{t('settings.checkNow')}</button>
        </div>
        <div className="field-row">
          <span className="field-label">{t('settings.autoUpdate')}</span>
          <label className="toggle-wrap"><input type="checkbox" defaultChecked /><span className="toggle-track" /></label>
        </div>
        <div className="field-row">
          <span className="field-label">{t('settings.updateChannel')}</span>
          <CustomSelect
            value="stable"
            onChange={() => {}}
            options={[
              { value: 'stable', label: t('settings.channelStable') },
              { value: 'beta', label: t('settings.channelBeta') },
            ]}
          />
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <div className="section-title"><Info size={17} className="section-icon" /> {t('settings.about')}</div>
        </div>
        <div className="field-row">
          <span className="field-label">{t('settings.version')}</span>
          <span style={{ fontSize: 13, color: 'var(--text-body)' }}>0.1.0</span>
        </div>
        <div className="field-row">
          <span className="field-label">{t('settings.runtime')}</span>
          <span style={{ fontSize: 13, color: 'var(--text-body)' }}>Tauri v2 / React 19</span>
        </div>
        <div className="field-row">
          <span className="field-label">GitHub</span>
          <a href="https://github.com" target="_blank" rel="noreferrer" className="link-icon">
            <ExternalLink size={13} /> GitHub
          </a>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <div className="section-title"><FileText size={17} className="section-icon" /> {t('settings.developerLogs')}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn" onClick={loadLogs} disabled={logsLoading} title={t('settings.refreshLogs')}>
              <RefreshCw size={12} />
            </button>
            <button className="btn" onClick={handleOpenLogDir} title={t('settings.openLogDir')}>
              <FolderOpen size={12} />
            </button>
            <button className="btn" onClick={handleClearLogs} title={t('settings.clearLogs')}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>
        <pre ref={logRef} className="log-viewer" onClick={loadLogs}>
          {logs || t('settings.logsHint')}
        </pre>
      </div>
    </div>
  )
}
