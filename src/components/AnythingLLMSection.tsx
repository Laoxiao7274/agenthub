import { useState, useEffect, useCallback } from 'react'
import {
  Database, Search, FileText, Loader2, RefreshCw,
  AlertCircle, Plus, Trash2, MessageSquare, FolderOpen, Send, Upload,
} from 'lucide-react'
import { useI18n } from '../i18n'
import { tauri } from '../tauri'
import type { AnythingLLMWorkspace, AnythingLLMDocument, AnythingLLMSearchResult } from '../tauri'
import { useAppStore } from '../hooks/useAppStore'

export function AnythingLLMSection() {
  const { t } = useI18n()
  const { serverConfig, showToast } = useAppStore()

  const [tab, setTab] = useState<'workspaces' | 'search' | 'chat'>('workspaces')

  // Workspaces
  const [workspaces, setWorkspaces] = useState<AnythingLLMWorkspace[]>([])
  const [workspacesLoading, setWorkspacesLoading] = useState(false)
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('')

  // Documents
  const [documents, setDocuments] = useState<AnythingLLMDocument[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(false)

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<AnythingLLMSearchResult[]>([])
  const [searching, setSearching] = useState(false)

  // Chat
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  // Create workspace
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [creating, setCreating] = useState(false)

  const hasConfig = serverConfig.anythingLLMUrl && serverConfig.anythingLLMApiKey

  const loadWorkspaces = useCallback(async () => {
    if (!hasConfig) return
    setWorkspacesLoading(true)
    try {
      const data = await tauri.anythingLLMListWorkspaces(
        serverConfig.anythingLLMUrl,
        serverConfig.anythingLLMApiKey,
      )
      setWorkspaces(data)
      if (data.length > 0 && !selectedWorkspace) {
        setSelectedWorkspace(data[0].slug || '')
      }
    } catch {
      setWorkspaces([])
    } finally {
      setWorkspacesLoading(false)
    }
  }, [hasConfig, serverConfig])

  const loadDocuments = useCallback(async () => {
    if (!hasConfig || !selectedWorkspace) return
    setDocumentsLoading(true)
    try {
      const data = await tauri.anythingLLMListDocuments(
        serverConfig.anythingLLMUrl,
        serverConfig.anythingLLMApiKey,
        selectedWorkspace,
      )
      setDocuments(data)
    } catch {
      setDocuments([])
    } finally {
      setDocumentsLoading(false)
    }
  }, [hasConfig, serverConfig, selectedWorkspace])

  const handleCreateWorkspace = async () => {
    if (!hasConfig || !newWorkspaceName.trim()) return
    setCreating(true)
    try {
      await tauri.anythingLLMCreateWorkspace(
        serverConfig.anythingLLMUrl,
        serverConfig.anythingLLMApiKey,
        newWorkspaceName.trim(),
      )
      setNewWorkspaceName('')
      showToast(t('anythingllm.created') || 'Workspace created')
      await loadWorkspaces()
    } catch (e) {
      showToast('❌ ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteWorkspace = async (slug: string) => {
    if (!hasConfig) return
    try {
      await tauri.anythingLLMDeleteWorkspace(
        serverConfig.anythingLLMUrl,
        serverConfig.anythingLLMApiKey,
        slug,
      )
      showToast(t('anythingllm.deleted') || 'Workspace deleted')
      if (selectedWorkspace === slug) {
        setSelectedWorkspace('')
        setDocuments([])
      }
      await loadWorkspaces()
    } catch (e) {
      showToast('❌ ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const handleUpload = async () => {
    if (!hasConfig || !selectedWorkspace) return
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        multiple: true,
        filters: [{ name: 'Documents', extensions: ['pdf', 'docx', 'txt', 'md', 'csv', 'json'] }],
      })
      if (!selected) return

      const files = Array.isArray(selected) ? selected : [selected]
      showToast(t('anythingllm.uploading') || 'Uploading...')

      const docPaths: string[] = []
      for (const filePath of files) {
        const result = await tauri.anythingLLMUploadDocument(
          serverConfig.anythingLLMUrl,
          serverConfig.anythingLLMApiKey,
          filePath,
        )
        if (result?.documents?.[0]?.location) {
          docPaths.push(result.documents[0].location)
        }
      }

      if (docPaths.length > 0) {
        await tauri.anythingLLMAddToWorkspace(
          serverConfig.anythingLLMUrl,
          serverConfig.anythingLLMApiKey,
          selectedWorkspace,
          docPaths,
        )
        showToast(t('anythingllm.uploaded') || 'Documents uploaded')
        await loadDocuments()
      }
    } catch (e) {
      showToast('❌ ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const handleSearch = async () => {
    if (!hasConfig || !searchQuery.trim()) return
    setSearching(true)
    try {
      const results = await tauri.anythingLLMSearch(
        serverConfig.anythingLLMUrl,
        serverConfig.anythingLLMApiKey,
        searchQuery,
        selectedWorkspace || undefined,
      )
      setSearchResults(results)
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleChat = async () => {
    if (!hasConfig || !selectedWorkspace || !chatInput.trim()) return
    const userMsg = chatInput.trim()
    setChatInput('')
    setChatMessages((prev) => [...prev, { role: 'user', content: userMsg }])
    setChatLoading(true)
    try {
      const response = await tauri.anythingLLMChat(
        serverConfig.anythingLLMUrl,
        serverConfig.anythingLLMApiKey,
        selectedWorkspace,
        userMsg,
      )
      setChatMessages((prev) => [...prev, { role: 'assistant', content: response.textResponse || 'No response' }])
    } catch (e) {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: 'Error: ' + (e instanceof Error ? e.message : String(e)) }])
    } finally {
      setChatLoading(false)
    }
  }

  useEffect(() => {
    if (hasConfig && workspaces.length === 0) loadWorkspaces()
  }, [hasConfig, loadWorkspaces, workspaces.length])

  useEffect(() => {
    if (tab === 'workspaces' && selectedWorkspace) loadDocuments()
  }, [tab, selectedWorkspace, loadDocuments])

  if (!hasConfig) {
    return (
      <div className="section">
        <div className="section-header">
          <div className="section-title"><Database size={17} className="section-icon" /> AnythingLLM</div>
        </div>
        <div className="hint-bar">
          <AlertCircle size={13} />
          {t('anythingllm.noConfig') || 'Please configure AnythingLLM API Key in Settings'}
        </div>
      </div>
    )
  }

  const selectedWs = workspaces.find((w) => w.slug === selectedWorkspace)

  return (
    <div className="section">
      <div className="section-header">
        <div className="section-title"><Database size={17} className="section-icon" /> AnythingLLM</div>
        <button className="btn btn-ghost btn-sm" onClick={loadWorkspaces} disabled={workspacesLoading} title="Refresh">
          {workspacesLoading ? <Loader2 size={12} className="spin" /> : <RefreshCw size={12} />}
        </button>
      </div>

      {/* Workspace selector bar */}
      <div className="mem-layout" style={{ marginBottom: 8 }}>
        <div className="mem-sidebar" style={{ minWidth: 180, maxWidth: 200 }}>
          <div className="mem-sidebar-count">{workspaces.length} {t('anythingllm.workspaces')?.toLowerCase() || 'workspaces'}</div>
          <div className="mem-sidebar-list">
            {workspaces.map((ws) => (
              <div
                key={ws.slug}
                className={`mem-sidebar-item ${selectedWorkspace === ws.slug ? 'active' : ''}`}
                onClick={() => {
                  setSelectedWorkspace(ws.slug || '')
                  setDocuments([])
                  setSearchResults([])
                  setChatMessages([])
                }}
              >
                <div className="mem-sidebar-item-title">
                  <FolderOpen size={11} style={{ verticalAlign: -1, marginRight: 4, color: 'var(--purple)', flexShrink: 0 }} />
                  {ws.name}
                </div>
                <div className="mem-sidebar-item-meta">
                  {ws.docCount !== undefined && (
                    <span className="data-badge" style={{ fontSize: 10 }}>{ws.docCount}</span>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: 2 }}
                    onClick={(e) => { e.stopPropagation(); handleDeleteWorkspace(ws.slug || '') }}
                    title="Delete"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {/* Create workspace */}
          <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                className="memory-input"
                type="text"
                placeholder={t('anythingllm.newWorkspace') || 'New...'}
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateWorkspace() }}
                style={{ fontSize: 11, padding: '4px 6px', flex: 1 }}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={handleCreateWorkspace}
                disabled={creating || !newWorkspaceName.trim()}
                style={{ padding: '4px 6px' }}
              >
                {creating ? <Loader2 size={10} className="spin" /> : <Plus size={10} />}
              </button>
            </div>
          </div>
        </div>

        <div className="mem-detail">
          {/* Tab bar */}
          <div className="memory-scope-bar" style={{ margin: 0, borderBottom: '1px solid var(--border)', borderRadius: 0 }}>
            <button className={`memory-scope-btn ${tab === 'workspaces' ? 'active' : ''}`} onClick={() => setTab('workspaces')}>
              <FileText size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
              {t('anythingllm.documents') || 'Documents'}
            </button>
            <button className={`memory-scope-btn ${tab === 'search' ? 'active' : ''}`} onClick={() => setTab('search')}>
              <Search size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
              {t('anythingllm.search') || 'Search'}
            </button>
            <button className={`memory-scope-btn ${tab === 'chat' ? 'active' : ''}`} onClick={() => setTab('chat')}>
              <MessageSquare size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
              {t('anythingllm.chat') || 'Chat'}
            </button>
          </div>

          {/* ===== Documents ===== */}
          {tab === 'workspaces' && (
            <div style={{ padding: 12 }}>
              {!selectedWorkspace && (
                <div className="memory-empty">{t('anythingllm.selectWorkspace') || 'Select a workspace'}</div>
              )}
              {selectedWorkspace && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-heading)' }}>
                      {selectedWs?.name || selectedWorkspace}
                    </div>
                    <button className="btn btn-sm" onClick={handleUpload}>
                      <Upload size={12} style={{ marginRight: 4 }} />
                      {t('anythingllm.upload') || 'Upload'}
                    </button>
                  </div>
                  {documentsLoading && <div className="memory-empty"><Loader2 size={14} className="spin" /></div>}
                  {!documentsLoading && documents.length === 0 && (
                    <div className="memory-empty">{t('anythingllm.noDocuments') || 'No documents in this workspace'}</div>
                  )}
                  {!documentsLoading && documents.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {documents.map((doc, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                          background: 'var(--bg-secondary, #f8f9fa)', borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                        }}>
                          <FileText size={14} style={{ color: 'var(--green)', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {doc.name}
                            </div>
                            {doc.description && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {doc.description}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ===== Search ===== */}
          {tab === 'search' && (
            <div style={{ padding: 12 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <input
                  className="input"
                  type="text"
                  placeholder={t('anythingllm.searchPlaceholder') || 'Search documents...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" onClick={handleSearch} disabled={searching}>
                  {searching ? <Loader2 size={12} className="spin" /> : <Search size={12} />}
                </button>
              </div>

              {!searching && searchResults.length === 0 && (
                <div className="memory-empty">{t('anythingllm.searchHint') || 'Enter keywords to search'}</div>
              )}

              {searchResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {searchResults.map((r, i) => (
                    <div key={i} style={{
                      padding: '10px 12px', background: 'var(--bg-secondary, #f8f9fa)',
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-heading)', marginBottom: 4 }}>
                        {r.id || `Result ${i + 1}`}
                      </div>
                      {r.text && (
                        <div style={{ fontSize: 12, color: 'var(--text-body)', lineHeight: 1.5, marginBottom: 6 }}>
                          {r.text}
                        </div>
                      )}
                      {r.score !== undefined && (
                        <span className="data-badge data-badge-score" style={{ fontSize: 10 }}>
                          Score: {r.score.toFixed(2)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== Chat ===== */}
          {tab === 'chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
                {chatMessages.length === 0 && (
                  <div className="memory-empty">{t('anythingllm.chatHint') || 'Start a conversation'}</div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {chatMessages.map((msg, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    }}>
                      <div style={{
                        maxWidth: '80%', padding: '8px 12px', borderRadius: 12,
                        background: msg.role === 'user' ? 'var(--purple)' : 'var(--bg-secondary, #f0f0f0)',
                        color: msg.role === 'user' ? '#fff' : 'var(--text-body)',
                        fontSize: 13, lineHeight: 1.5,
                        borderBottomRightRadius: msg.role === 'user' ? 4 : 12,
                        borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 12,
                      }}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <div style={{
                        padding: '8px 12px', borderRadius: 12,
                        background: 'var(--bg-secondary, #f0f0f0)',
                        borderBottomLeftRadius: 4,
                      }}>
                        <Loader2 size={14} className="spin" style={{ color: 'var(--text-muted)' }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{
                padding: '10px 12px', borderTop: '1px solid var(--border)',
                display: 'flex', gap: 6,
              }}>
                <input
                  className="input"
                  type="text"
                  placeholder={t('anythingllm.chatPlaceholder') || 'Ask a question...'}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleChat() }}
                  style={{ flex: 1 }}
                  disabled={!selectedWorkspace}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleChat}
                  disabled={chatLoading || !chatInput.trim() || !selectedWorkspace}
                >
                  <Send size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
