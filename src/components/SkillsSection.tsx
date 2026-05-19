import { useState } from 'react'
import { Users, Plus, Trash2, X, Sparkles, Loader2, Check } from 'lucide-react'
import { useI18n } from '../i18n'
import type { ProjectConfig, AgentSkill, Provider, Project } from '../types'
import { tauri } from '../tauri'

export function SkillsSection({
  config,
  onChange,
  confirmThen,
  providers,
  activeProject,
  showToast,
}: {
  config: ProjectConfig
  onChange: (c: ProjectConfig) => void
  confirmThen: (msg: string, fn: () => void) => void
  providers: Provider[]
  activeProject: Project | null | undefined
  showToast: (msg: string) => void
}) {
  const { t, lang } = useI18n()
  const [editingSkill, setEditingSkill] = useState<AgentSkill | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [aiLoading, setAiLoading] = useState<Set<string>>(new Set())
  const [aiUpdateInput, setAiUpdateInput] = useState('')
  const [aiPreview, setAiPreview] = useState<{ skillId: string; content: string } | null>(null)

  const provider = providers.find((p) => p.id === config.providerId)
  const getApiConfig = () => {
    if (!provider || !provider.apiKey || !provider.baseUrl || !provider.model) {
      showToast(t('ai.noProvider'))
      return null
    }
    return { base_url: provider.baseUrl, api_key: provider.apiKey, model: config.model || provider.model }
  }

  const addSkill = () => {
    const newSkill: AgentSkill = { id: Date.now().toString(), name: '', prompt: '', model: '', tools: [] }
    setEditingSkill(newSkill)
    setIsAdding(true)
  }
  const confirmAdd = () => {
    if (!editingSkill || !editingSkill.name.trim()) return
    onChange({ ...config, skills: [...config.skills, editingSkill] })
    setEditingSkill(null)
    setIsAdding(false)
  }
  const cancelEdit = () => { setEditingSkill(null); setIsAdding(false); setAiPreview(null) }
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
    if (!isAdding) updateSkill(editingSkill.id, field, value)
  }

  // AI Summarize
  const handleAiSummarize = async (skill: AgentSkill) => {
    const apiConfig = getApiConfig()
    if (!apiConfig || !activeProject) return
    setAiLoading((prev) => new Set(prev).add(skill.id))
    try {
      const res = await tauri.aiChat({
        ...apiConfig,
        lang,
        messages: [
          { role: 'user', content: `Summarize this skill in 2-3 concise sentences. What does it do and when should it be used?\n\nSkill name: ${skill.name}\nSkill prompt: ${skill.prompt}\nTools: ${skill.tools.join(', ') || 'none'}` },
        ],
      })
      const updated = { ...skill, summary: res.reply }
      onChange({ ...config, skills: config.skills.map((s) => s.id === skill.id ? updated : s) })
      if (editingSkill?.id === skill.id) setEditingSkill(updated)
      showToast(t('ai.applied'))
    } catch (e: any) {
      showToast(`❌ ${e?.toString() || 'Failed'}`)
    } finally {
      setAiLoading((prev) => { const next = new Set(prev); next.delete(skill.id); return next })
    }
  }

  // AI Update
  const handleAiUpdate = async (skill: AgentSkill) => {
    const apiConfig = getApiConfig()
    if (!apiConfig || !activeProject) return
    if (!aiUpdateInput.trim()) return
    setAiLoading((prev) => new Set(prev).add(skill.id))
    try {
      const res = await tauri.aiUpdate({
        ...apiConfig,
        lang,
        project_path: activeProject.path,
        target: 'skills',
        user_request: aiUpdateInput,
        current_content: skill.prompt,
      })
      setAiPreview({ skillId: skill.id, content: res.result })
    } catch (e: any) {
      showToast(`❌ ${e?.toString() || 'Failed'}`)
    } finally {
      setAiLoading((prev) => { const next = new Set(prev); next.delete(skill.id); return next })
      setAiUpdateInput('')
    }
  }

  // Apply AI preview
  const applyAiPreview = (skillId: string) => {
    if (!aiPreview) return
    confirmThen(t('ai.confirmApply'), () => {
      updateSkill(skillId, 'prompt', aiPreview.content)
      updateSkill(skillId, 'summary', '')
      setAiPreview(null)
      showToast(t('ai.applied'))
    })
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
          <div key={skill.id} className="mcsm-card" onClick={() => { setEditingSkill(skill); setAiPreview(null) }}>
            <div className="mcsm-card-actions">
              <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); confirmThen(t('confirm.deleteSkill', { name: skill.name || 'unnamed' }), () => removeSkill(skill.id)); }}>
                <Trash2 size={12} />
              </button>
            </div>
            <div className="mcsm-card-icon"><Users size={20} style={{ color: 'var(--purple)' }} /></div>
            <div className="mcsm-card-name">{skill.name || t('skills.namePlaceholder')}</div>
            <div className="mcsm-card-status">
              {skill.summary
                ? <span className="mcsm-status-idle" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skill.summary}</span>
                : skill.prompt
                  ? <span className="mcsm-status-idle" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skill.prompt}</span>
                  : <span className="mcsm-status-idle">{t('skills.noPrompt') || 'No prompt'}</span>
              }
            </div>
          </div>
        ))}
      </div>

      {/* Edit modal with AI buttons inside */}
      {editingSkill && (
        <div className="modal-overlay" onClick={cancelEdit}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div className="modal-title"><Users size={17} /> {editingSkill.name || t('skills.namePlaceholder')}</div>
              <button className="modal-close" onClick={cancelEdit}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="field-row">
                <span className="field-label">{t('skills.namePlaceholder')}</span>
                <input className="input" type="text" placeholder={t('skills.namePlaceholder')} value={editingSkill.name} onChange={(e) => updateEditingSkill('name', e.target.value)} autoFocus />
              </div>

              {/* AI action buttons */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <button
                  className="btn"
                  onClick={() => handleAiSummarize(editingSkill)}
                  disabled={aiLoading.has(editingSkill.id)}
                >
                  {aiLoading.has(editingSkill.id) ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
                  {t('ai.analyze')}
                </button>
              </div>

              {/* AI Update input */}
              <div className="ai-input-bar" style={{ borderTop: 'none', paddingTop: 0, marginBottom: 12 }}>
                <input
                  className="input ai-input"
                  type="text"
                  placeholder={t('ai.updatePlaceholder')}
                  value={aiUpdateInput}
                  onChange={(e) => setAiUpdateInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAiUpdate(editingSkill) }}
                  disabled={aiLoading.has(editingSkill.id)}
                />
                <button
                  className="btn btn-primary ai-send-btn"
                  onClick={() => handleAiUpdate(editingSkill)}
                  disabled={aiLoading.has(editingSkill.id) || !aiUpdateInput.trim()}
                >
                  {aiLoading.has(editingSkill.id) ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                </button>
              </div>

              {/* AI Preview */}
              {aiPreview?.skillId === editingSkill.id && (
                <div className="skill-ai-preview" style={{ marginBottom: 12 }}>
                  <div className="ai-preview-header">
                    <Sparkles size={14} /> {t('ai.preview')}
                  </div>
                  <pre className="ai-preview-content">{aiPreview.content}</pre>
                  <div className="skill-ai-preview-actions">
                    <button className="btn btn-ghost" onClick={() => setAiPreview(null)}>{t('ai.cancel')}</button>
                    <button className="btn btn-primary" onClick={() => applyAiPreview(editingSkill.id)}>
                      <Check size={12} /> {t('ai.apply')}
                    </button>
                  </div>
                </div>
              )}

              {/* AI analysis */}
              {editingSkill.summary ? (
                <div className="skill-summary-modal">
                  <div className="skill-summary-label"><Sparkles size={12} /> AI {t('ai.analyze')}</div>
                  <div className="skill-summary-text">{editingSkill.summary}</div>
                </div>
              ) : (
                <div className="mcsm-empty" style={{ padding: 16 }}>{t('skills.noPrompt') || 'No prompt'}</div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={cancelEdit}>{t('provider.cancel')}</button>
              <button className="btn btn-primary" onClick={isAdding ? confirmAdd : cancelEdit} disabled={isAdding && !editingSkill.name.trim()}>{t('skills.done') || 'Done'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
