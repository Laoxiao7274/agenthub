import { useState, useEffect, useMemo } from 'react'
import {
  Brain, Loader2, FileText, Sparkles, MessageSquare, Trash2, AlertCircle, Clock, Tag, Download,
} from 'lucide-react'
import { useI18n } from '../i18n'
import type { Project } from '../types'
import { tauri } from '../tauri'
import type { ClaudeSession, SessionMessage, QdrantPoint } from '../tauri'
import { useAppStore } from '../hooks/useAppStore'

export function MemorySection({
  activeProject,
}: {
  activeProject: Project | null | undefined
}) {
  const { t } = useI18n()
  const { serverConfig, showToast, openProject, activeProjectId } = useAppStore()
  const [tab, setTab] = useState<'auto' | 'sessions' | 'shared'>('auto')

  const [autoMemories, setAutoMemories] = useState<{ name: string; content: string }[]>([])
  const [autoLoading, setAutoLoading] = useState(false)
  const [selectedAutoName, setSelectedAutoName] = useState<string | null>(null)

  const [sharedPoints, setSharedPoints] = useState<QdrantPoint[]>([])
  const [sharedLoading, setSharedLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [filterUser, setFilterUser] = useState<string | null>(null)

  const [sessions, setSessions] = useState<ClaudeSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [sessionMessages, setSessionMessages] = useState<SessionMessage[]>([])
  const [sessionLoading, setSessionLoading] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (!activeProject) return
    setAutoLoading(true)
    tauri.readClaudeMemory(activeProject.path).then((data: any) => {
      setAutoMemories(data.autoMemories || [])
    }).catch(() => setAutoMemories([]))
    .finally(() => setAutoLoading(false))
  }, [activeProject])

  const loadSharedMemory = async () => {
    if (!serverConfig.qdrantUrl || !serverConfig.qdrantApiKey) return
    setSharedLoading(true)
    try {
      const points = await tauri.qdrantScrollPoints(
        serverConfig.qdrantUrl, serverConfig.qdrantApiKey,
        serverConfig.qdrantCollection, 100,
      )
      setSharedPoints(points)
    } catch { setSharedPoints([]) } finally { setSharedLoading(false) }
  }

  useEffect(() => { if (tab === 'shared') loadSharedMemory() }, [tab, serverConfig.qdrantUrl])

  useEffect(() => {
    if (!activeProject) return
    setSessionsLoading(true)
    tauri.listClaudeSessions(activeProject.path).then(setSessions).catch(() => setSessions([]))
    .finally(() => setSessionsLoading(false))
  }, [activeProject])

  useEffect(() => {
    if (!selectedSessionId || !activeProject) { setSessionMessages([]); return }
    setSessionLoading(true)
    tauri.readClaudeSession(activeProject.path, selectedSessionId)
      .then(setSessionMessages).catch(() => setSessionMessages([]))
      .finally(() => setSessionLoading(false))
  }, [selectedSessionId, activeProject])

  const handleDelete = async (id: string) => {
    setDeleteTarget(id)
    try {
      await tauri.qdrantDeletePoints(
        serverConfig.qdrantUrl, serverConfig.qdrantApiKey,
        serverConfig.qdrantCollection, [id],
      )
      setSharedPoints((prev) => prev.filter((p) => p.id !== id))
      if (selectedId === id) setSelectedId(null)
    } catch { /* */ } finally { setDeleteTarget(null) }
  }

  const formatTime = (ts: string) => {
    if (!ts) return ''
    try { return new Date(ts).toLocaleString() } catch { return ts }
  }

  const formatDate = (ts: string) => {
    if (!ts) return ''
    try { return new Date(ts).toLocaleDateString() } catch { return ts }
  }

  const extractText = (p: QdrantPoint): string => {
    const payload = p.payload
    if (typeof payload.memory === 'string') return payload.memory
    if (typeof payload.text === 'string') return payload.text
    if (typeof payload.data === 'string') return payload.data
    return JSON.stringify(payload).slice(0, 300)
  }

  const hasQdrantConfig = serverConfig.qdrantUrl && serverConfig.qdrantApiKey

  const userFilters = useMemo(() => {
    const users = new Set<string>()
    sharedPoints.forEach((p) => {
      if (p.payload?.user_id && typeof p.payload.user_id === 'string') users.add(p.payload.user_id)
    })
    return Array.from(users).sort()
  }, [sharedPoints])

  const filteredPoints = useMemo(() => {
    let pts = sharedPoints
    if (filterUser) pts = pts.filter((p) => p.payload?.user_id === filterUser)
    if (searchText.trim()) {
      const q = searchText.toLowerCase()
      pts = pts.filter((p) => extractText(p).toLowerCase().includes(q))
    }
    pts = [...pts].sort((a, b) => {
      const ta = a.payload?.created_at && typeof a.payload.created_at === 'string' ? a.payload.created_at : ''
      const tb = b.payload?.created_at && typeof b.payload.created_at === 'string' ? b.payload.created_at : ''
      return tb.localeCompare(ta)
    })
    return pts
  }, [sharedPoints, filterUser, searchText])

  const selectedPoint = selectedId ? sharedPoints.find((p) => p.id === selectedId) : null
  const selectedAuto = selectedAutoName ? autoMemories.find((m) => m.name === selectedAutoName) : null
  const selectedSession = selectedSessionId ? sessions.find((s) => s.id === selectedSessionId) : null

  const handleInstallMem0 = async () => {
    if (!activeProject) return
    setInstalling(true)
    try {
      await tauri.installAgentMem0(activeProject.launchPath, activeProject.name)
      showToast(t('memory.installMem0Done'))
      // Reload project config to reflect new MCP/Skill
      if (activeProjectId) openProject(activeProjectId)
    } catch (e) {
      showToast('❌ ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className="section">
      <div className="section-header">
        <div className="section-title"><Brain size={17} className="section-icon" /> {t('memory.title')}</div>
      </div>

      <div className="memory-scope-bar">
        <button className={`memory-scope-btn ${tab === 'auto' ? 'active' : ''}`} onClick={() => setTab('auto')}>
          <Sparkles size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
          {t('memory.autoMemory')}
        </button>
        <button className={`memory-scope-btn ${tab === 'shared' ? 'active' : ''}`} onClick={() => setTab('shared')}>
          <Brain size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
          {t('memory.sharedMemory')}
        </button>
        <button className={`memory-scope-btn ${tab === 'sessions' ? 'active' : ''}`} onClick={() => setTab('sessions')}>
          <MessageSquare size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
          {t('memory.sessions')}
        </button>
      </div>

      {/* ===== Auto Memory ===== */}
      {tab === 'auto' && (
        <>
          {autoLoading && <div className="memory-empty"><Loader2 size={14} className="spin" /></div>}
          {!autoLoading && autoMemories.length === 0 && <div className="memory-empty">{t('memory.empty')}</div>}
          {!autoLoading && autoMemories.length > 0 && (
            <div className="mem-layout">
              <div className="mem-sidebar">
                <div className="mem-sidebar-count">{autoMemories.length} files</div>
                <div className="mem-sidebar-list">
                  {autoMemories.map((m) => (
                    <div
                      key={m.name}
                      className={`mem-sidebar-item ${selectedAutoName === m.name ? 'active' : ''}`}
                      onClick={() => setSelectedAutoName(m.name)}
                    >
                      <div className="mem-sidebar-item-title">
                        <FileText size={11} style={{ verticalAlign: -1, marginRight: 4, color: 'var(--green)', flexShrink: 0 }} />
                        {m.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mem-detail">
                {selectedAuto ? (
                  <div className="mem-detail-body mono">{selectedAuto.content || <span className="text-muted-inline">{t('memory.empty')}</span>}</div>
                ) : (
                  <div className="mem-detail-empty">{t('memory.selectHint')}</div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== Shared Memory ===== */}
      {tab === 'shared' && (
        <>
          {!hasQdrantConfig && (
            <div className="hint-bar"><AlertCircle size={13} /> {t('memory.noServerConfig')}</div>
          )}
          {hasQdrantConfig && (
            <div className="memory-add-bar" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-sm" onClick={handleInstallMem0} disabled={installing} title={t('memory.installMem0Hint')}>
                {installing ? <Loader2 size={11} className="spin" /> : <Download size={11} />}
                {t('memory.installMem0')}
              </button>
            </div>
          )}
          {hasQdrantConfig && sharedLoading && <div className="memory-empty"><Loader2 size={14} className="spin" /></div>}
          {hasQdrantConfig && !sharedLoading && sharedPoints.length === 0 && (
            <div className="memory-empty">{t('memory.empty')}</div>
          )}
          {hasQdrantConfig && !sharedLoading && sharedPoints.length > 0 && (
            <div className="mem-layout">
              <div className="mem-sidebar">
                <div className="mem-sidebar-search">
                  <input
                    className="memory-input"
                    type="text"
                    placeholder={t('memory.searchPlaceholder')}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ fontSize: 12 }}
                  />
                </div>
                {userFilters.length > 1 && (
                  <div className="mem-sidebar-filters">
                    <button className={`mem-filter-btn ${!filterUser ? 'active' : ''}`} onClick={() => setFilterUser(null)}>All</button>
                    {userFilters.map((u) => (
                      <button key={u} className={`mem-filter-btn ${filterUser === u ? 'active' : ''}`} onClick={() => setFilterUser(u)}>
                        <Tag size={9} style={{ verticalAlign: -1, marginRight: 2 }} />{u}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mem-sidebar-count">{filteredPoints.length} {t('memory.sharedMemory').toLowerCase()}</div>
                <div className="mem-sidebar-list">
                  {filteredPoints.map((point) => (
                    <div
                      key={point.id}
                      className={`mem-sidebar-item ${selectedId === point.id ? 'active' : ''}`}
                      onClick={() => setSelectedId(point.id)}
                    >
                      <div className="mem-sidebar-item-title">{extractText(point)}</div>
                      <div className="mem-sidebar-item-meta">
                        {point.payload?.user_id && typeof point.payload.user_id === 'string' && (
                          <span className="data-badge data-badge-user">{point.payload.user_id}</span>
                        )}
                        {point.payload?.created_at && typeof point.payload.created_at === 'string' && (
                          <span className="mem-sidebar-item-time">
                            <Clock size={9} style={{ verticalAlign: -1, marginRight: 2 }} />{formatDate(point.payload.created_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredPoints.length === 0 && (
                    <div className="memory-empty" style={{ padding: '16px 0' }}>{t('memory.empty')}</div>
                  )}
                </div>
              </div>
              <div className="mem-detail">
                {selectedPoint ? (
                  <>
                    <div className="mem-detail-header">
                      <div className="mem-detail-meta">
                        {selectedPoint.payload?.user_id && typeof selectedPoint.payload.user_id === 'string' && (
                          <span className="data-badge data-badge-user">{selectedPoint.payload.user_id}</span>
                        )}
                        {selectedPoint.payload?.created_at && typeof selectedPoint.payload.created_at === 'string' && (
                          <span className="data-card-time"><Clock size={10} style={{ verticalAlign: -1, marginRight: 3 }} />{formatTime(selectedPoint.payload.created_at)}</span>
                        )}
                      </div>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDelete(selectedPoint.id)}
                        disabled={deleteTarget === selectedPoint.id}
                        title={t('memory.delete')}
                      >
                        {deleteTarget === selectedPoint.id ? <Loader2 size={11} className="spin" /> : <Trash2 size={12} />}
                      </button>
                    </div>
                    <div className="mem-detail-body">{extractText(selectedPoint)}</div>
                  </>
                ) : (
                  <div className="mem-detail-empty">{t('memory.selectHint')}</div>
                )}
              </div>
            </div>
          )}
          {hasQdrantConfig && sharedPoints.length > 0 && (
            <div className="hint-bar"><Sparkles size={12} /> {t('memory.addViaMcpHint')}</div>
          )}
        </>
      )}

      {/* ===== Sessions ===== */}
      {tab === 'sessions' && (
        <>
          {sessionsLoading && <div className="memory-empty"><Loader2 size={14} className="spin" /></div>}
          {!sessionsLoading && sessions.length === 0 && <div className="memory-empty">{t('memory.empty')}</div>}
          {!sessionsLoading && sessions.length > 0 && (
            <div className="mem-layout">
              <div className="mem-sidebar">
                <div className="mem-sidebar-count">{sessions.length} {t('memory.sessions').toLowerCase()}</div>
                <div className="mem-sidebar-list">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className={`mem-sidebar-item ${selectedSessionId === s.id ? 'active' : ''}`}
                      onClick={() => setSelectedSessionId(s.id)}
                    >
                      <div className="mem-sidebar-item-title">{s.firstMessage || t('memory.noFirstMessage')}</div>
                      <div className="mem-sidebar-item-meta">
                        <span className="mem-sidebar-item-time">
                          <Clock size={9} style={{ verticalAlign: -1, marginRight: 2 }} />{formatDate(s.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mem-detail">
                {selectedSession ? (
                  <>
                    <div className="mem-detail-header">
                      <div className="mem-detail-meta">
                        <span className="data-card-time"><Clock size={10} style={{ verticalAlign: -1, marginRight: 3 }} />{formatTime(selectedSession.timestamp)}</span>
                      </div>
                    </div>
                    <div className="mem-detail-body" style={{ padding: 0 }}>
                      {sessionLoading && <div className="memory-empty"><Loader2 size={14} className="spin" /></div>}
                      {!sessionLoading && sessionMessages.length === 0 && <div className="memory-empty">{t('memory.empty')}</div>}
                      {!sessionLoading && (
                        <div className="session-inline">
                          {sessionMessages.map((msg, i) => (
                            <div key={i} className={`session-msg session-msg-${msg.role}`}>
                              <div className="session-msg-role">{msg.role === 'user' ? 'You' : 'Claude'}</div>
                              <div className="session-msg-content">{msg.content}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="mem-detail-empty">{t('memory.selectHint')}</div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
