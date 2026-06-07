import type { Anchor } from '../types'
import { anchorColor } from '../types'

interface Props {
  anchors: Anchor[]
}

export function ItemizedSidebar({ anchors }: Props) {
  if (anchors.length === 0) {
    return (
      <div className="app-sidebar">
        <p className="app-sidebar-empty">No anchors placed yet.</p>
      </div>
    )
  }

  return (
    <div className="app-sidebar">
      {anchors.map((anchor) => {
        const color = anchorColor(anchor.category)
        return (
          <div key={anchor.id} className="app-sidebar-anchor">
            <div className="app-sidebar-anchor-header" style={{ borderLeftColor: color }}>
              <span className="app-sidebar-dot" style={{ background: color }} />
              <span className="app-sidebar-anchor-name">{anchor.label}</span>
              {anchor.category && (
                <span className="app-sidebar-tag">{anchor.category}</span>
              )}
            </div>

            {anchor.candidates.length > 0 ? (
              <div className="app-sidebar-candidates">
                {anchor.candidates.map((c) => {
                  const dims = [c.width, c.height, c.depth].filter(Boolean).join(' × ') || '—'
                  const price = c.price ? `$${c.price}` : '—'
                  return (
                    <div key={c.id} className="app-sidebar-candidate">
                      {c.urls[0]
                        ? <img src={c.urls[0]} alt={c.name} />
                        : <div className="app-sidebar-no-img" />
                      }
                      <div className="app-sidebar-candidate-info">
                        <span className="app-sidebar-candidate-name">{c.name}</span>
                        {c.description && <span className="app-sidebar-candidate-desc">{c.description}</span>}
                        <span className="app-sidebar-candidate-dims">{dims}</span>
                        <span className="app-sidebar-candidate-price">{price}</span>
                        {c.link && (
                          <a
                            className="app-sidebar-candidate-link"
                            href={c.link}
                            target="_blank"
                            rel="noreferrer"
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
              <p className="app-sidebar-no-candidates">No candidates</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
