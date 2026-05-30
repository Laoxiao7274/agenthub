import { useState, useEffect, useCallback } from 'react'
import {
  Database, Loader2, RefreshCw, Trash2, AlertCircle,
} from 'lucide-react'
import { useI18n } from '../i18n'
import { tauri } from '../tauri'
import type { QdrantCollectionInfo, QdrantPoint } from '../tauri'
import { useAppStore } from '../hooks/useAppStore'

export function QdrantSection() {
  const { t } = useI18n()
  const { serverConfig } = useAppStore()

  const [collections, setCollections] = useState<QdrantCollectionInfo[]>([])
  const [collectionsLoading, setCollectionsLoading] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [points, setPoints] = useState<QdrantPoint[]>([])
  const [pointsLoading, setPointsLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const hasConfig = serverConfig.qdrantUrl && serverConfig.qdrantApiKey

  const loadCollections = useCallback(async () => {
    if (!hasConfig) return
    setCollectionsLoading(true)
    try {
      const names = await tauri.qdrantListCollections(serverConfig.qdrantUrl, serverConfig.qdrantApiKey)
      const details = await Promise.all(
        names.map((name) =>
          tauri.qdrantGetCollection(serverConfig.qdrantUrl, serverConfig.qdrantApiKey, name)
            .catch(() => null),
        ),
      )
      setCollections(details.filter((d): d is QdrantCollectionInfo => d !== null))
    } catch {
      setCollections([])
    } finally {
      setCollectionsLoading(false)
    }
  }, [hasConfig, serverConfig.qdrantUrl, serverConfig.qdrantApiKey])

  const loadPoints = useCallback(async (collection: string) => {
    setPointsLoading(true)
    try {
      const pts = await tauri.qdrantScrollPoints(
        serverConfig.qdrantUrl,
        serverConfig.qdrantApiKey,
        collection,
        50,
      )
      setPoints(pts)
    } catch {
      setPoints([])
    } finally {
      setPointsLoading(false)
    }
  }, [serverConfig.qdrantUrl, serverConfig.qdrantApiKey])

  useEffect(() => { loadCollections() }, [loadCollections])

  useEffect(() => {
    if (selectedCollection) loadPoints(selectedCollection)
  }, [selectedCollection, loadPoints])

  const handleDelete = async (id: string) => {
    if (!selectedCollection) return
    setDeleteTarget(id)
    try {
      await tauri.qdrantDeletePoints(
        serverConfig.qdrantUrl,
        serverConfig.qdrantApiKey,
        selectedCollection,
        [id],
      )
      setPoints((prev) => prev.filter((p) => p.id !== id))
    } catch { /* error visible from UI state */ } finally {
      setDeleteTarget(null)
    }
  }

  const extractPayloadPreview = (point: QdrantPoint): string => {
    const p = point.payload
    if (typeof p.memory === 'string') return p.memory
    if (typeof p.text === 'string') return p.text
    if (typeof p.data === 'string') return p.data
    return JSON.stringify(p).slice(0, 150)
  }

  if (!hasConfig) {
    return (
      <div className="section">
        <div className="section-header">
          <div className="section-title"><Database size={17} className="section-icon" /> Qdrant</div>
        </div>
        <div className="hint-bar">
          <AlertCircle size={13} />
          {t('qdrant.noConfig')}
        </div>
      </div>
    )
  }

  return (
    <div className="section">
      <div className="section-header">
        <div className="section-title"><Database size={17} className="section-icon" /> Qdrant</div>
        <button className="btn" onClick={loadCollections} disabled={collectionsLoading}>
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Collection grid */}
      {collectionsLoading && <div className="memory-empty"><Loader2 size={14} className="spin" /></div>}
      {!collectionsLoading && collections.length === 0 && <div className="memory-empty">{t('qdrant.noCollections')}</div>}

      <div className="qdrant-grid">
        {collections.map((col) => (
          <div
            key={col.name}
            className={`qdrant-collection-card ${selectedCollection === col.name ? 'active' : ''}`}
            onClick={() => setSelectedCollection(col.name)}
          >
            <div className="qdrant-collection-name">
              <Database size={12} style={{ color: 'var(--purple)' }} />
              {col.name}
            </div>
            <div className="qdrant-collection-stats">
              <span className="qdrant-stat">{t('qdrant.vectors')}: {col.vector_count}</span>
              <span className="qdrant-stat">{t('qdrant.dimension')}: {col.dimension}</span>
              <span className="data-badge data-badge-status">{col.status}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Points in selected collection */}
      {selectedCollection && (
        <>
          <div className="section-divider-label">
            {t('qdrant.browsing')}: {selectedCollection}
          </div>
          {pointsLoading && <div className="memory-empty"><Loader2 size={14} className="spin" /></div>}
          {!pointsLoading && points.length === 0 && <div className="memory-empty">{t('memory.empty')}</div>}
          <div className="memory-list">
            {points.map((point) => (
              <div key={point.id} className="data-card">
                <div className="data-card-accent" />
                <div className="data-card-body">
                  <div className="data-card-text">{extractPayloadPreview(point)}</div>
                  <div className="data-card-meta">
                    {point.payload?.user_id && (
                      <span className="data-badge data-badge-user">{point.payload.user_id as string}</span>
                    )}
                    {point.payload?.created_at && (
                      <span className="data-card-time">
                        {new Date(point.payload.created_at as string).toLocaleDateString()}
                      </span>
                    )}
                    <div className="data-card-actions">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDelete(point.id)}
                        disabled={deleteTarget === point.id}
                        title={t('memory.delete')}
                      >
                        {deleteTarget === point.id ? <Loader2 size={11} className="spin" /> : <Trash2 size={11} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
