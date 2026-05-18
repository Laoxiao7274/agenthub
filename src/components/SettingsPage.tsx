import { Globe, RefreshCw, Info, ExternalLink } from 'lucide-react'
import { useI18n, LANG_OPTIONS } from '../i18n'
import type { Lang } from '../i18n'
import CustomSelect from './Select'

export function SettingsPage() {
  const { t, lang, setLang } = useI18n()

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
    </div>
  )
}
