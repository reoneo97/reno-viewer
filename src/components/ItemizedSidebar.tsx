import { useState } from 'react'
import type { Anchor } from '../types'
import { anchorColor, formatDims } from '../types'

interface Props {
  anchors: Anchor[]
}

export function ItemizedSidebar({ anchors }: Props) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  // When searching: keep anchors whose label matches (show all their candidates),
  // or anchors with at least one matching candidate (show only those candidates).
  const filtered = !q
    ? anchors
    : anchors
        .map((a) => {
          const labelMatch = a.label.toLowerCase().includes(q)
          const matchedCandidates = a.candidates.filter((c) =>
            c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
          if (labelMatch) return a
          if (matchedCandidates.length > 0) return { ...a, candidates: matchedCandidates }
          return null
        })
        .filter((a): a is Anchor => a !== null)

  return (
    <div className="app-sidebar">
      <input
        className="text-input app-sidebar-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search items…"
      />

      {filtered.length === 0 ? (
        <p className="app-sidebar-empty">{anchors.length === 0 ? 'No anchors placed yet.' : 'No matches.'}</p>
      ) : filtered.map((anchor) => {
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
                  const dims = formatDims(c.width, c.height, c.depth) || '—'
                  const price = c.price ? `$${c.price}` : '—'
                  return (
                    <div key={c.id} className={`app-sidebar-candidate ${c.chosen ? 'chosen' : ''}`}>
                      {c.urls[0]
                        ? <img src={c.urls[0]} alt={c.name} />
                        : <div className="app-sidebar-no-img" />
                      }
                      <div className="app-sidebar-candidate-info">
                        <span className="app-sidebar-candidate-name">
                          {c.chosen && <span className="app-sidebar-chosen-star" title="Chosen">★ </span>}
                          {c.name}
                        </span>
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
