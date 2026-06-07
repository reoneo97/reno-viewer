import type { Anchor } from '../types'

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
            const dims = [c.width, c.height, c.depth].filter(Boolean).join(' × ')
            return (
              <div key={c.id} className="candidate-card">
                {c.urls[0] && <img src={c.urls[0]} alt={c.name} />}
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
