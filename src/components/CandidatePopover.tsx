import type { Anchor } from '../types'
import { formatDims } from '../types'

interface Props {
  anchor: Anchor
}

export function CandidatePopover({ anchor }: Props) {
  return (
    <div className="candidate-popover">
      <div className="popover-header">
        {anchor.label}
        {anchor.category && <span className="popover-category">{anchor.category}</span>}
      </div>

      {anchor.candidates.length > 0 ? (
        <div className="candidate-grid">
          {anchor.candidates.map((c) => {
            const dims = formatDims(c.width, c.height, c.depth)
            return (
              <div key={c.id} className={`candidate-card ${c.chosen ? 'chosen' : ''}`}>
                {c.urls[0] && <img src={c.urls[0]} alt={c.name} />}
                {c.chosen && <span className="candidate-chosen-corner" title="Chosen">★</span>}
                <div className="candidate-overlay">
                  <p className="candidate-name">{c.name}</p>
                  {dims && <p className="candidate-meta">{dims}</p>}
                  {c.price && <p className="candidate-price">${c.price}</p>}
                  {c.link && (
                    <a
                      className="candidate-link"
                      href={c.link}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View ↗
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="popover-empty">No candidates added</p>
      )}
    </div>
  )
}
