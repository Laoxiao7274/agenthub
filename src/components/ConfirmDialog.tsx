import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useI18n } from '../i18n'

export function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  checkboxLabel,
  onCheckboxResult,
}: {
  message: string
  onConfirm: (checkboxResult: boolean) => void
  onCancel: () => void
  checkboxLabel?: string
  onCheckboxResult?: (v: boolean) => void
}) {
  const { t } = useI18n()
  const [checked, setChecked] = useState(false)
  const handleConfirm = () => {
    onCheckboxResult?.(checked)
    onConfirm(checked)
    onCancel()
  }
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
        <div className="modal-header">
          <div className="modal-title"><AlertTriangle size={17} style={{ color: 'var(--danger, #ef4444)' }} /> {t('confirm.title')}</div>
          <button className="modal-close" onClick={onCancel}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{message}</p>
          {checkboxLabel && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              {checkboxLabel}
            </label>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onCancel}>{t('confirm.cancel')}</button>
          <button className="btn btn-danger" onClick={handleConfirm}>{t('confirm.delete')}</button>
        </div>
      </div>
    </div>
  )
}
