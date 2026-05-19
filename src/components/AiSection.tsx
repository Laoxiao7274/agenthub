import { useState, useRef, useEffect } from 'react'
import { Bot, Sparkles, Send, Loader2, Check, FileText, Cpu, Eye } from 'lucide-react'
import { useI18n } from '../i18n'
import type { ProjectConfig, Provider, Project } from '../types'
import { tauri } from '../tauri'
import type { ChatMessage } from '../tauri'

type AiMode = 'chat' | 'analyze' | 'update'

interface PendingChange {
  target: string
  content: string
  preview: string
}

export function AiSection({
  config,
  providers,
  activeProject,
  confirmThen,
  showToast,
}: {
  config: ProjectConfig
  providers: Provider[]
  activeProject: Project | null | undefined
  confirmThen: (msg: string, fn: () => void) => void
  showToast: (msg: string) => void
}) {
  const { t, lang } = useI18n()
  const [mode, setMode] = useState<AiMode>('chat')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null)
  const [applying, setApplying] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const provider = providers.find((p) => p.id === config.providerId)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const getApiConfig = () => {
    if (!provider || !provider.apiKey || !provider.baseUrl || !provider.model) {
      showToast(t('ai.noProvider'))
      return null
    }
    return {
      base_url: provider.baseUrl,
      api_key: provider.apiKey,
      model: config.model || provider.model,
    }
  }

  // Chat
  const handleSend = async () => {
    if (!input.trim() || loading) return
    const apiConfig = getApiConfig()
    if (!apiConfig) return

    const userMsg: ChatMessage = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const systemPrompt = `You are an AI assistant helping the user manage their coding project "${activeProject?.name || ''}".
The project is located at: ${activeProject?.path || ''}.
Agent type: ${config.agentType}.
Help the user with questions about project configuration, CLAUDE.md, skills, MCP servers, and best practices.
Answer concisely and practically.`

      const res = await tauri.aiChat({
        ...apiConfig,
        messages: newMessages,
        system: systemPrompt,
        lang,
      })
      setMessages([...newMessages, { role: 'assistant', content: res.reply }])
    } catch (e: any) {
      setMessages([...newMessages, { role: 'assistant', content: `Error: ${e?.toString() || 'Failed'}` }])
    } finally {
      setLoading(false)
    }
  }

  // Analyze
  const handleAnalyze = async (target: string) => {
    if (loading || !activeProject) return
    const apiConfig = getApiConfig()
    if (!apiConfig) return

    setLoading(true)
    try {
      const res = await tauri.aiAnalyze({
        ...apiConfig,
        project_path: activeProject.path,
        target,
        lang,
      })

      if (target === 'claude_md') {
        setPendingChange({ target: 'claude_md', content: res.result, preview: res.result })
        setMode('update')
      } else {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: target === 'skills_summary'
            ? `**Skills Summary:**\n\n${res.result}`
            : `**Project Overview:**\n\n${res.result}`,
        }])
        setMode('chat')
      }
    } catch (e: any) {
      showToast(`❌ ${e?.toString() || 'Analysis failed'}`)
    } finally {
      setLoading(false)
    }
  }

  // Update
  const handleUpdate = async () => {
    if (loading || !activeProject) return
    const apiConfig = getApiConfig()
    if (!apiConfig) return

    const updateInput = input.trim()
    if (!updateInput) return

    setLoading(true)
    try {
      const target = pendingChange ? pendingChange.target : 'claude_md'
      const currentContent = pendingChange?.content || config.claudeMd

      const res = await tauri.aiUpdate({
        ...apiConfig,
        project_path: activeProject.path,
        target,
        user_request: updateInput,
        current_content: currentContent,
        lang,
      })

      setPendingChange({
        target,
        content: res.result,
        preview: res.result,
      })
      setInput('')
    } catch (e: any) {
      showToast(`❌ ${e?.toString() || 'Update failed'}`)
    } finally {
      setLoading(false)
    }
  }

  // Apply
  const handleApply = () => {
    if (!pendingChange || !activeProject) return

    confirmThen(t('ai.confirmApply'), async () => {
      setApplying(true)
      try {
        if (pendingChange.target === 'claude_md') {
          await tauri.aiApply(activeProject.path, 'claude_md', pendingChange.content)
          showToast(t('ai.applied'))
          setPendingChange(null)
          setMode('chat')
        } else if (pendingChange.target === 'skills') {
          // For skills, content is the SKILL.md text; wrap in JSON for backend
          const skillData = JSON.stringify({
            name: 'ai-generated-skill',
            content: pendingChange.content,
          })
          await tauri.aiApply(activeProject.path, 'skills', skillData)
          showToast(t('ai.applied'))
          setPendingChange(null)
          setMode('chat')
        }
      } catch (e: any) {
        showToast(`❌ ${t('ai.applyFailed')}: ${e?.toString() || ''}`)
      } finally {
        setApplying(false)
      }
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (mode === 'update' && pendingChange) {
        handleUpdate()
      } else {
        handleSend()
      }
    }
  }

  return (
    <div className="section ai-section">
      {/* Mode Tabs */}
      <div className="ai-mode-tabs">
        <button
          className={`ai-mode-tab ${mode === 'chat' ? 'active' : ''}`}
          onClick={() => setMode('chat')}
        >
          <Bot size={14} /> {t('ai.title')}
        </button>
        <button
          className={`ai-mode-tab ${mode === 'analyze' ? 'active' : ''}`}
          onClick={() => { setMode('analyze'); setPendingChange(null) }}
          disabled={loading}
        >
          <Sparkles size={14} /> {t('ai.analyze')}
        </button>
        <button
          className={`ai-mode-tab ${mode === 'update' ? 'active' : ''}`}
          onClick={() => setMode('update')}
          disabled={loading}
        >
          <Eye size={14} /> {t('ai.update')}
        </button>
      </div>

      {/* Analyze Mode */}
      {mode === 'analyze' && (
        <div className="ai-analyze-panel">
          <div className="ai-analyze-actions">
            <button
              className="btn"
              onClick={() => handleAnalyze('claude_md')}
              disabled={loading}
            >
              {loading ? <Loader2 size={12} className="spin" /> : <FileText size={12} />}
              {t('ai.analyzeClaudeMd')}
            </button>
            <button
              className="btn"
              onClick={() => handleAnalyze('skills_summary')}
              disabled={loading}
            >
              {loading ? <Loader2 size={12} className="spin" /> : <Cpu size={12} />}
              {t('ai.analyzeSkills')}
            </button>
            <button
              className="btn"
              onClick={() => handleAnalyze('project_overview')}
              disabled={loading}
            >
              {loading ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
              {t('ai.analyzeOverview')}
            </button>
          </div>
          {loading && (
            <div className="ai-loading">
              <Loader2 size={16} className="spin" /> {t('ai.analyzing')}
            </div>
          )}
        </div>
      )}

      {/* Chat Mode */}
      {mode === 'chat' && (
        <div className="ai-chat-panel">
          <div className="ai-messages">
            {messages.length === 0 && (
              <div className="ai-empty">
                <Bot size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  {t('ai.chatPlaceholder')}
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`ai-message ai-message-${msg.role}`}>
                <div className="ai-message-avatar">
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="ai-message-content">
                  {msg.content.split('\n').map((line, j) => (
                    <span key={j}>
                      {line.startsWith('**') && line.endsWith('**')
                        ? <strong>{line.slice(2, -2)}</strong>
                        : line}
                      {j < msg.content.split('\n').length - 1 && <br />}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {loading && (
              <div className="ai-message ai-message-assistant">
                <div className="ai-message-avatar">🤖</div>
                <div className="ai-message-content">
                  <Loader2 size={14} className="spin" /> {t('ai.thinking')}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="ai-input-bar">
            <input
              className="input ai-input"
              type="text"
              placeholder={t('ai.chatPlaceholder')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button
              className="btn btn-primary ai-send-btn"
              onClick={handleSend}
              disabled={loading || !input.trim()}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Update Mode */}
      {mode === 'update' && (
        <div className="ai-update-panel">
          {pendingChange && (
            <div className="ai-preview-panel">
              <div className="ai-preview-header">
                <Eye size={14} /> {t('ai.preview')}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
                  {pendingChange.target === 'claude_md' ? 'CLAUDE.md' : 'Skill'}
                </span>
              </div>
              <pre className="ai-preview-content">{pendingChange.preview}</pre>
              <div className="ai-preview-actions">
                <button
                  className="btn"
                  onClick={() => { setPendingChange(null) }}
                  disabled={applying}
                >
                  {t('ai.cancel')}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleApply}
                  disabled={applying}
                >
                  {applying ? <Loader2 size={12} className="spin" /> : <Check size={12} />}
                  {t('ai.apply')}
                </button>
              </div>
            </div>
          )}

          <div className="ai-update-input">
            <div className="ai-update-target">
              <button
                className={`btn btn-sm ${!pendingChange || pendingChange.target === 'claude_md' ? 'active' : ''}`}
                onClick={() => setPendingChange(prev => prev ? { ...prev, target: 'claude_md' } : { target: 'claude_md', content: config.claudeMd, preview: '' })}
              >
                <FileText size={12} /> {t('ai.updateClaudeMd')}
              </button>
              <button
                className={`btn btn-sm ${pendingChange?.target === 'skills' ? 'active' : ''}`}
                onClick={() => setPendingChange(prev => prev ? { ...prev, target: 'skills' } : { target: 'skills', content: '', preview: '' })}
              >
                <Cpu size={12} /> {t('ai.updateSkill')}
              </button>
            </div>
            <div className="ai-input-bar">
              <input
                className="input ai-input"
                type="text"
                placeholder={t('ai.updatePlaceholder')}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
              />
              <button
                className="btn btn-primary ai-send-btn"
                onClick={handleUpdate}
                disabled={loading || !input.trim()}
              >
                {loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
