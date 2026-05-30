import { useState } from 'react'
import { Plus, X, FolderOpen, FolderPlus, AlertTriangle } from 'lucide-react'
import { useI18n } from '../i18n'

type Mode = 'open' | 'new'

const hasNonAscii = (s: string) => /[^\x00-\x7f]/.test(s)

export function AddProjectModal({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd: (name: string, path: string, isExisting: boolean, initSkills: boolean) => void
}) {
  const { t } = useI18n()
  const [mode, setMode] = useState<Mode>('open')

  // Open mode
  const [folderPath, setFolderPath] = useState('')
  const [initSkills, setInitSkills] = useState(false)

  // New mode
  const [name, setName] = useState('')
  const [parentPath, setParentPath] = useState('')

  const sep = folderPath.includes('\\') ? '\\' : '/'
  const folderName = folderPath ? folderPath.split(/[/\\]/).filter(Boolean).pop() || '' : ''

  const newProjectPath = parentPath && name.trim()
    ? parentPath.replace(/[/\\]+$/, '') + sep + name.trim()
    : ''

  const pathWarning = mode === 'open'
    ? (hasNonAscii(folderPath) ? t('projects.nonAsciiWarning') : '')
    : (hasNonAscii(newProjectPath) ? t('projects.nonAsciiWarning') : '')

  const browseFolder = async (target: 'open' | 'parent') => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({ directory: true, title: t('projects.selectFolder') })
      if (selected && typeof selected === 'string') {
        if (target === 'open') setFolderPath(selected)
        else setParentPath(selected)
      }
    } catch { /* dialog not available */ }
  }

  const handleSubmit = () => {
    if (mode === 'open') {
      if (!folderPath.trim()) return
      onAdd(folderName, folderPath, true, initSkills)
    } else {
      if (!name.trim() || !newProjectPath) return
      onAdd(name.trim(), newProjectPath, false, true)
    }
  }

  const canSubmit = mode === 'open' ? !!folderPath.trim() : !!(name.trim() && parentPath.trim())

  return (
    <div className="modal-overlay">
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div className="modal-title"><Plus size={17} /> {t('projects.add')}</div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="add-project-tabs">
            <button className={`add-project-tab ${mode === 'open' ? 'active' : ''}`} onClick={() => setMode('open')}>
              <FolderOpen size={14} /> {t('projects.openFolder')}
            </button>
            <button className={`add-project-tab ${mode === 'new' ? 'active' : ''}`} onClick={() => setMode('new')}>
              <FolderPlus size={14} /> {t('projects.createNew')}
            </button>
          </div>

          {mode === 'open' && (
            <>
              <div className="field-row">
                <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                  <input
                    className="input"
                    type="text"
                    placeholder={t('projects.folderPlaceholder')}
                    value={folderPath}
                    onChange={(e) => setFolderPath(e.target.value)}
                    style={{ flex: 1 }}
                    autoFocus
                  />
                  <button className="btn" onClick={() => browseFolder('open')}><FolderOpen size={12} /></button>
                </div>
              </div>
              {folderPath && (
                <>
                  <div className="add-project-preview">
                    {t('projects.projectName')}: <strong>{folderName}</strong>
                  </div>
                  {pathWarning && (
                    <div className="hint-bar" style={{ color: 'var(--danger, #ef4444)', fontSize: 12 }}>
                      <AlertTriangle size={12} /> {pathWarning}
                    </div>
                  )}
                  <label className="add-project-check">
                    <span className={`mcsm-check ${initSkills ? 'checked' : ''}`} onClick={() => setInitSkills(!initSkills)}>
                      {initSkills && <span style={{ fontSize: 10, color: 'white' }}>✓</span>}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-body)' }}>{t('projects.initSkills')}</span>
                  </label>
                </>
              )}
            </>
          )}

          {mode === 'new' && (
            <>
              <div className="field-row">
                <span className="field-label">{t('projects.parentFolder')}</span>
                <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                  <input
                    className="input"
                    type="text"
                    placeholder={t('projects.parentPlaceholder')}
                    value={parentPath}
                    onChange={(e) => setParentPath(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button className="btn" onClick={() => browseFolder('parent')}><FolderPlus size={12} /></button>
                </div>
              </div>
              <div className="field-row">
                <span className="field-label">{t('projects.name')}</span>
                <input
                  className="input"
                  type="text"
                  placeholder={t('projects.namePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              {newProjectPath && (
                <>
                  <div className="add-project-preview">
                    {t('projects.willCreate')}: {newProjectPath}
                  </div>
                  {pathWarning && (
                    <div className="hint-bar" style={{ color: 'var(--danger, #ef4444)', fontSize: 12 }}>
                      <AlertTriangle size={12} /> {pathWarning}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>{t('provider.cancel')}</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
            <Plus size={13} /> {t('projects.add')}
          </button>
        </div>
      </div>
    </div>
  )
}
