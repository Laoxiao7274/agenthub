import { useState } from 'react'
import { Plus, X, FolderKanban } from 'lucide-react'
import { useI18n } from '../i18n'

export function AddProjectModal({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd: (name: string, path: string) => void
}) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [parentPath, setParentPath] = useState('')

  // Final project path = parent + name
  const sep = parentPath.includes('\\') ? '\\' : '/'
  const projectPath = parentPath && name.trim()
    ? parentPath.replace(/[/\\]+$/, '') + sep + name.trim()
    : ''

  const handleBrowse = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({ directory: true, title: t('projects.selectParent') })
      if (selected && typeof selected === 'string') {
        setParentPath(selected)
      }
    } catch {
      // dialog not available — ignore
    }
  }

  const handleSubmit = () => {
    if (!name.trim() || !projectPath) return
    onAdd(name.trim(), projectPath)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div className="modal-title"><Plus size={17} /> {t('projects.add')}</div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
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
              <button className="btn" onClick={handleBrowse}><FolderKanban size={12} /></button>
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
              autoFocus
            />
          </div>
          {projectPath && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--bg-tertiary, #f1f5f9)', borderRadius: 6, fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all' }}>
              {t('projects.willCreate')}: {projectPath}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>{t('provider.cancel')}</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={!name.trim() || !parentPath.trim()}>
            <Plus size={13} /> {t('projects.add')}
          </button>
        </div>
      </div>
    </div>
  )
}
