import { useState } from 'react'
import { Users, Plus, Trash2, X } from 'lucide-react'
import { useI18n } from '../i18n'
import type { ProjectConfig, AgentSkill } from '../types'
import { ALL_TOOLS } from '../types'

export function SkillsSection({
  config,
  onChange,
  confirmThen,
}: {
  config: ProjectConfig
  onChange: (c: ProjectConfig) => void
  confirmThen: (msg: string, fn: () => void) => void
}) {
  const { t } = useI18n()
  const [editingSkill, setEditingSkill] = useState<AgentSkill | null>(null)

  const addSkill = () => {
    const newSkill: AgentSkill = { id: Date.now().toString(), name: '', prompt: '', model: '', tools: [] }
    onChange({ ...config, skills: [...config.skills, newSkill] })
    setEditingSkill(newSkill)
  }
  const removeSkill = (id: string) => {
    onChange({ ...config, skills: config.skills.filter((s) => s.id !== id) })
    if (editingSkill?.id === id) setEditingSkill(null)
  }
  const updateSkill = (id: string, field: keyof AgentSkill, value: string | string[]) => {
    onChange({ ...config, skills: config.skills.map((s) => s.id === id ? { ...s, [field]: value } : s) })
  }
  const updateEditingSkill = (field: keyof AgentSkill, value: string | string[]) => {
    if (!editingSkill) return
    const updated = { ...editingSkill, [field]: value }
    setEditingSkill(updated)
    updateSkill(editingSkill.id, field, value)
  }
  const toggleTool = (tool: string) => {
    if (!editingSkill) return
    const tools = editingSkill.tools.includes(tool)
      ? editingSkill.tools.filter((t) => t !== tool)
      : [...editingSkill.tools, tool]
    updateEditingSkill('tools', tools)
  }

  return (
    <div className="section">
      <div className="section-header">
        <div className="section-title"><Users size={17} className="section-icon" /> {t('skills.title')}</div>
        <button className="btn" onClick={addSkill}><Plus size={12} /> {t('skills.add')}</button>
      </div>
      {config.skills.length === 0 && <div className="mcsm-empty">{t('skills.empty')}</div>}
      <div className="mcsm-grid">
        {config.skills.map((skill) => (
          <div key={skill.id} className="mcsm-card" onClick={() => { setEditingSkill(skill); }}>
            <div className="mcsm-card-actions">
              <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); confirmThen(t('confirm.deleteSkill', { name: skill.name || 'unnamed' }), () => removeSkill(skill.id)); }}>
                <Trash2 size={12} />
              </button>
            </div>
            <div className="mcsm-card-icon"><Users size={20} style={{ color: 'var(--purple)' }} /></div>
            <div className="mcsm-card-name">{skill.name || t('skills.namePlaceholder')}</div>
            <div className="mcsm-card-status">
              {skill.model
                ? <span className="mcsm-status-active">{skill.model}</span>
                : <span className="mcsm-status-idle">{t('skills.modelPlaceholder')}</span>
              }
            </div>
          </div>
        ))}
      </div>

      {editingSkill && (
        <div className="modal-overlay" onClick={() => setEditingSkill(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div className="modal-title"><Users size={17} /> {editingSkill.name || t('skills.namePlaceholder')}</div>
              <button className="modal-close" onClick={() => setEditingSkill(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="field-row">
                <span className="field-label">{t('skills.namePlaceholder')}</span>
                <input className="input" type="text" placeholder={t('skills.namePlaceholder')} value={editingSkill.name} onChange={(e) => updateEditingSkill('name', e.target.value)} autoFocus />
              </div>
              <div className="field-row">
                <span className="field-label">{t('skills.prompt')}</span>
                <textarea className="textarea" style={{ minHeight: 80 }} placeholder={t('skills.promptPlaceholder')} value={editingSkill.prompt} onChange={(e) => updateEditingSkill('prompt', e.target.value)} />
              </div>
              <div className="field-row">
                <span className="field-label">{t('skills.model')}</span>
                <input className="input" type="text" placeholder={t('skills.modelPlaceholder')} value={editingSkill.model} onChange={(e) => updateEditingSkill('model', e.target.value)} />
              </div>
              <div className="field-row">
                <span className="field-label">{t('skills.tools')}</span>
                <div className="tool-chips">
                  {ALL_TOOLS.map((tool) => <button key={tool} className={`tool-chip ${editingSkill.tools.includes(tool) ? 'active' : ''}`} onClick={() => toggleTool(tool)}>{tool}</button>)}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setEditingSkill(null)}>{t('provider.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
