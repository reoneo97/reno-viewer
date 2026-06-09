import { useState } from 'react'
import type { Anchor, CandidateImage } from '../types'
import { anchorColor, formatDims } from '../types'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface Props {
  anchor: Anchor
  onClose: () => void
  onEdit?: () => void
}

function ImageGallery({ urls }: { urls: string[] }) {
  const [active, setActive] = useState(0)
  if (urls.length === 0) return <div className="view-candidate-no-img">No image</div>
  return (
    <div className="gallery">
      <img src={urls[active]} alt="" className="gallery-main" />
      {urls.length > 1 && (
        <div className="gallery-thumbs">
          {urls.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className={`gallery-thumb ${i === active ? 'active' : ''}`}
              onClick={() => setActive(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function CandidateViewModal({ anchor, onClose, onEdit }: Props) {
  const color = anchorColor(anchor.category)
  useEscapeKey(onClose)

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
          {anchor.candidates.length === 0 ? (
            <p className="view-modal-empty">No candidates added to this anchor yet.</p>
          ) : (
            <div className="view-candidate-grid">
              {anchor.candidates.map((c: CandidateImage) => {
                const dims = formatDims(c.width, c.height, c.depth)
                return (
                  <div key={c.id} className={`view-candidate-card ${c.chosen ? 'chosen' : ''}`}>
                    <div className="view-candidate-img-wrap">
                      <ImageGallery urls={c.urls} />
                      {c.chosen && <span className="view-candidate-chosen-badge" title="Chosen">★ Chosen</span>}
                    </div>
                    <div className="view-candidate-info">
                      <p className="view-candidate-name">{c.name}</p>
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
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
