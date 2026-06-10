import { useState } from 'react'
import type { CandidateImage, CandidateStatus } from '../types'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { Lightbox } from './Lightbox'
import { StatusPicker } from './StatusBadge'

interface Props {
  title: string
  candidates: CandidateImage[]
  onSetStatus: (candidateId: string, status: CandidateStatus) => void
  onClose: () => void
}

const parsePrice = (p: string) => {
  const n = parseFloat(p)
  return !isNaN(n) && n > 0 ? n : null
}

// Side-by-side comparison of 2–4 candidates: the screen you huddle over
// when deciding. The lowest price is highlighted.
export function CompareView({ title, candidates, onSetStatus, onClose }: Props) {
  const [lightbox, setLightbox] = useState<CandidateImage | null>(null)

  useEscapeKey(() => onClose(), lightbox === null)

  const prices = candidates.map((c) => parsePrice(c.price))
  const validPrices = prices.filter((p): p is number => p !== null)
  const minPrice = validPrices.length > 1 ? Math.min(...validPrices) : null

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="compare-modal">
        <div className="view-modal-header">
          <div className="view-modal-title">
            <h2>Compare — {title}</h2>
          </div>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
        </div>

        <div className="compare-body">
          {candidates.map((c, i) => {
            const price = prices[i]
            const isCheapest = minPrice !== null && price === minPrice
            return (
              <div key={c.id} className={`compare-col ${c.status === 'chosen' ? 'compare-col-chosen' : ''}`}>
                <button
                  className="compare-img-wrap"
                  onClick={() => c.urls.length > 0 && setLightbox(c)}
                  title={c.urls.length > 0 ? 'View full size' : undefined}
                >
                  {c.urls[0]
                    ? <img src={c.urls[0]} alt={c.name} />
                    : <span className="view-candidate-no-img">No image</span>
                  }
                  {c.urls.length > 1 && <span className="compare-img-count">{c.urls.length} photos</span>}
                </button>

                <div className="compare-col-info">
                  <p className="compare-name">{c.name}</p>

                  <p className={`compare-price ${isCheapest ? 'compare-price-best' : ''}`}>
                    {price !== null ? `$${c.price}` : '—'}
                    {isCheapest && <span className="compare-best-tag">lowest</span>}
                  </p>

                  <dl className="compare-dims">
                    <div><dt>W</dt><dd>{c.width || '—'}</dd></div>
                    <div><dt>H</dt><dd>{c.height || '—'}</dd></div>
                    <div><dt>D</dt><dd>{c.depth || '—'}</dd></div>
                  </dl>

                  {c.description && <p className="compare-desc">{c.description}</p>}

                  {c.link && (
                    <a className="view-candidate-link" href={c.link} target="_blank" rel="noreferrer">
                      View product ↗
                    </a>
                  )}

                  <div className="compare-status">
                    <StatusPicker status={c.status} onChange={(s) => onSetStatus(c.id, s)} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {lightbox && (
        <Lightbox
          images={lightbox.urls}
          caption={lightbox.name}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}
