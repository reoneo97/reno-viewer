import { useState } from 'react'
import type { Anchor, CandidateImage, CandidateStatus } from '../types'
import { anchorColor } from '../types'
import { setCandidateStatus } from '../api'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { toast } from './Toast'
import { Lightbox } from './Lightbox'
import { CompareView } from './CompareView'
import { StatusBadge, StatusPicker } from './StatusBadge'

interface Props {
  anchor: Anchor
  onRefresh?: () => void
  onClose: () => void
  onEdit?: () => void
}

export function CandidateViewModal({ anchor, onRefresh, onClose, onEdit }: Props) {
  const color = anchorColor(anchor.category)
  const [lightbox, setLightbox] = useState<CandidateImage | null>(null)
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set())
  const [comparing, setComparing] = useState(false)
  // Optimistic status overrides so chips respond instantly; the API call and
  // refresh catch up in the background.
  const [statusOverrides, setStatusOverrides] = useState<Record<string, CandidateStatus>>({})

  useEscapeKey(onClose, lightbox === null && !comparing)

  const candidates = anchor.candidates.map((c) =>
    statusOverrides[c.id] !== undefined ? { ...c, status: statusOverrides[c.id] } : c,
  )

  const setStatus = async (candidateId: string, status: CandidateStatus) => {
    setStatusOverrides((prev) => {
      const next = { ...prev, [candidateId]: status }
      // 'chosen' is radio-style per anchor — mirror the server-side clear.
      if (status === 'chosen') {
        for (const c of anchor.candidates) {
          if (c.id !== candidateId && (next[c.id] ?? c.status) === 'chosen') next[c.id] = ''
        }
      }
      return next
    })
    try {
      await setCandidateStatus(anchor.id, candidateId, status)
      onRefresh?.()
    } catch {
      toast.error('Failed to update status')
      setStatusOverrides((prev) => {
        const next = { ...prev }
        delete next[candidateId]
        return next
      })
    }
  }

  const toggleCompare = (id: string) =>
    setCompareIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < 4) {
        next.add(id)
      } else {
        toast.info('Compare up to 4 candidates at a time')
      }
      return next
    })

  const compareCandidates = candidates.filter((c) => compareIds.has(c.id))
  const canCompare = candidates.length > 1

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="view-modal">
        <div className="view-modal-header" style={{ borderBottomColor: color }}>
          <div className="view-modal-title">
            <span className="view-modal-dot" style={{ background: color }} />
            <h2>{anchor.label}</h2>
            {anchor.category && (
              <span className="popover-category">{anchor.category}</span>
            )}
          </div>
          {onEdit && (
            <button className="btn-secondary" style={{ fontSize: '0.78rem', padding: '5px 12px' }} onClick={onEdit}>
              Edit
            </button>
          )}
          <button className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
        </div>

        <div className="view-modal-body">
          {candidates.length === 0 ? (
            <p className="view-modal-empty">No candidates added to this anchor yet.</p>
          ) : (
            <div className="view-candidate-grid">
              {candidates.map((c) => {
                const dims = [c.width, c.height, c.depth].filter(Boolean).join(' × ')
                const selected = compareIds.has(c.id)
                return (
                  <div
                    key={c.id}
                    className={`view-candidate-card ${selected ? 'compare-selected' : ''} ${c.status === 'rejected' ? 'view-candidate-rejected' : ''}`}
                  >
                    <button
                      className="view-candidate-img-wrap"
                      onClick={() => c.urls.length > 0 && setLightbox(c)}
                      title={c.urls.length > 0 ? 'View full size' : undefined}
                    >
                      {c.urls[0]
                        ? <img src={c.urls[0]} alt={c.name} loading="lazy" />
                        : <span className="view-candidate-no-img">No image</span>
                      }
                      {c.urls.length > 1 && (
                        <span className="view-candidate-img-count">+{c.urls.length - 1}</span>
                      )}
                    </button>

                    {canCompare && (
                      <label className="compare-check" title="Select to compare">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleCompare(c.id)}
                        />
                        Compare
                      </label>
                    )}

                    <div className="view-candidate-info">
                      <p className="view-candidate-name">
                        {c.name} <StatusBadge status={c.status} />
                      </p>
                      {c.description && <p className="view-candidate-desc">{c.description}</p>}
                      {dims && <p className="view-candidate-dims">{dims}</p>}
                      {c.price && <p className="view-candidate-price">${c.price}</p>}
                      {c.link && (
                        <a
                          className="view-candidate-link"
                          href={c.link}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View product ↗
                        </a>
                      )}
                      <StatusPicker status={c.status} onChange={(s) => setStatus(c.id, s)} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {compareIds.size > 0 && (
          <div className="compare-bar">
            <span className="compare-bar-label">
              {compareIds.size} selected{compareIds.size < 2 ? ' — pick at least 2' : ''}
            </span>
            <button className="btn-secondary" onClick={() => setCompareIds(new Set())}>
              Clear
            </button>
            <button
              className="btn-primary"
              disabled={compareIds.size < 2}
              onClick={() => setComparing(true)}
            >
              Compare side-by-side
            </button>
          </div>
        )}
      </div>

      {lightbox && (
        <Lightbox
          images={lightbox.urls}
          caption={lightbox.name}
          onClose={() => setLightbox(null)}
        />
      )}

      {comparing && (
        <CompareView
          title={anchor.label}
          candidates={compareCandidates}
          onSetStatus={setStatus}
          onClose={() => setComparing(false)}
        />
      )}
    </div>
  )
}
