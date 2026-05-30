import { useState } from 'react'
import { Users, Trash2, X, Sparkles, Loader2 } from 'lucide-react'
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
  const [aiLoading, setAiLoading] = useState<Set<string>>(new Set())

  const provider = providers.find((p) => p.id === config.providerId)
  const getApiConfig = () => {
    if (!provider || !provider.apiKey || !provider.baseUrl || !provider.model) {
      showToast(t('ai.noProvider'))
      return null
    }
    return { base_url: provider.baseUrl, api_key: provider.apiKey, model: config.model || provider.model }
  }

  const removeSkill = (id: string) => {
    onChange({ ...config, skills: config.skills.filter((s) => s.id !== id) })
    if (editingSkill?.id === id) setEditingSkill(null)
  }

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

  return (
    <div className="section">
      <div className="section-header">
        <div className="section-title"><Users size={17} className="section-icon" /> {t('skills.title')}</div>
      </div>
      {config.skills.length === 0 && <div className="mcsm-empty">{t('skills.empty')}</div>}
      <div className="mcsm-grid">
        {config.skills.map((skill) => (
          <div key={skill.id} className="mcsm-card" onClick={() => setEditingSkill(skill)}>
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

      {editingSkill && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div className="modal-title"><Users size={17} /> {editingSkill.name || t('skills.namePlaceholder')}</div>
              <button className="modal-close" onClick={() => setEditingSkill(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
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
              {editingSkill.summary ? (
                <div className="ai-insight-card">
                  <div className="ai-insight-header"><Sparkles size={12} /> AI {t('ai.analyze')}</div>
                  <div className="ai-insight-body">{editingSkill.summary}</div>
                </div>
              ) : (
                <div className="mcsm-empty" style={{ padding: 16 }}>{t('skills.noPrompt') || 'No prompt'}</div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setEditingSkill(null)}>{t('skills.done') || 'Done'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
