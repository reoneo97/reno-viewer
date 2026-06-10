import { useState } from 'react'
import type { Anchor } from '../types'
import { anchorColor } from '../types'

interface Props {
  anchors: Anchor[]
}

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function anchorSubtotal(anchor: Anchor): number {
  return anchor.candidates.reduce((sum, c) => {
    const n = parseFloat(c.price)
    return !isNaN(n) && n > 0 ? sum + n : sum
  }, 0)
}

function matchesQuery(anchor: Anchor, q: string): boolean {
  if (anchor.label.toLowerCase().includes(q)) return true
  if (anchor.category.toLowerCase().includes(q)) return true
  return anchor.candidates.some(
    (c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
  )
}

export function ItemizedSidebar({ anchors }: Props) {
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const filtered = q ? anchors.filter((a) => matchesQuery(a, q)) : anchors

  return (
    <div className="app-sidebar">
      <div className="app-sidebar-header">
        <span className="app-sidebar-title">Items</span>
        <span className="app-sidebar-count">
          {q ? `${filtered.length} of ${anchors.length}` : anchors.length}
        </span>
      </div>

      {anchors.length > 0 && (
        <input
          className="text-input app-sidebar-search"
          type="search"
          placeholder="Search items…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search items"
        />
      )}

      {anchors.length === 0 ? (
        <p className="app-sidebar-empty">No anchors placed yet.</p>
      ) : filtered.length === 0 ? (
        <p className="app-sidebar-empty">Nothing matches “{query.trim()}”.</p>
      ) : (
        filtered.map((anchor) => {
          const color = anchorColor(anchor.category)
          const subtotal = anchorSubtotal(anchor)
          return (
            <div key={anchor.id} className="app-sidebar-anchor">
              <div className="app-sidebar-anchor-header" style={{ borderLeftColor: color }}>
                <span className="app-sidebar-dot" style={{ background: color }} />
                <span className="app-sidebar-anchor-name">{anchor.label}</span>
                {anchor.category && (
                  <span className="app-sidebar-tag">{anchor.category}</span>
                )}
                {subtotal > 0 && (
                  <span className="app-sidebar-subtotal" title="Sum of priced candidates">
                    ${fmt(subtotal)}
                  </span>
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
                          ? <img src={c.urls[0]} alt={c.name} loading="lazy" />
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
        })
      )}
    </div>
  )
}
