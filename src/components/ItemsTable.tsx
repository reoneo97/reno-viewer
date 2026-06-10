import { useState } from 'react'
import type { Anchor, CandidateImage, CandidateStatus } from '../types'
import { anchorColor } from '../types'
import { updateCandidate } from '../api'
import { toast } from './Toast'
import { AnchorEditModal } from './AnchorEditModal'
import { Lightbox } from './Lightbox'
import { StatusPicker } from './StatusBadge'

interface Props {
  anchors: Anchor[]
  onRefresh: () => void
}

interface Row {
  anchor: Anchor
  candidate: CandidateImage
}

type SortKey = 'name' | 'anchor' | 'category' | 'price' | 'status'

const STATUS_RANK: Record<CandidateStatus, number> = {
  chosen: 0, shortlisted: 1, '': 2, rejected: 3,
}

const priceOf = (c: CandidateImage) => {
  const n = parseFloat(c.price)
  return !isNaN(n) && n > 0 ? n : null
}

// Spreadsheet-style view of every candidate across the project — the
// research-phase companion to the floor plan.
export function ItemsTable({ anchors, onRefresh }: Props) {
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('anchor')
  const [sortAsc, setSortAsc] = useState(true)
  const [editAnchor, setEditAnchor] = useState<Anchor | null>(null)
  const [lightbox, setLightbox] = useState<CandidateImage | null>(null)
  const [statusOverrides, setStatusOverrides] = useState<Record<string, CandidateStatus>>({})

  const rows: Row[] = anchors.flatMap((anchor) =>
    anchor.candidates.map((c) => ({
      anchor,
      candidate: statusOverrides[c.id] !== undefined ? { ...c, status: statusOverrides[c.id] } : c,
    })),
  )

  const q = query.trim().toLowerCase()
  const filtered = q
    ? rows.filter(({ anchor, candidate }) =>
        candidate.name.toLowerCase().includes(q) ||
        candidate.description.toLowerCase().includes(q) ||
        anchor.label.toLowerCase().includes(q) ||
        anchor.category.toLowerCase().includes(q))
    : rows

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    switch (sortKey) {
      case 'name': cmp = a.candidate.name.localeCompare(b.candidate.name); break
      case 'anchor': cmp = a.anchor.label.localeCompare(b.anchor.label); break
      case 'category': cmp = a.anchor.category.localeCompare(b.anchor.category); break
      case 'price': cmp = (priceOf(a.candidate) ?? -1) - (priceOf(b.candidate) ?? -1); break
      case 'status': cmp = STATUS_RANK[a.candidate.status] - STATUS_RANK[b.candidate.status]; break
    }
    return sortAsc ? cmp : -cmp
  })

  const setSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc((v) => !v)
    else { setSortKey(key); setSortAsc(true) }
  }

  const setStatus = async (candidateId: string, status: CandidateStatus) => {
    setStatusOverrides((prev) => ({ ...prev, [candidateId]: status }))
    try {
      await updateCandidate(candidateId, { status })
      onRefresh()
    } catch {
      toast.error('Failed to update status')
      setStatusOverrides((prev) => {
        const next = { ...prev }
        delete next[candidateId]
        return next
      })
    }
  }

  const emptyAnchors = anchors.filter((a) => a.candidates.length === 0)

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : ''

  const header = (key: SortKey, label: string, right = false) => (
    <th className={`budget-th ${right ? 'budget-th-right' : ''}`}>
      <button className="table-sort-btn" onClick={() => setSort(key)}>
        {label}{sortIndicator(key)}
      </button>
    </th>
  )

  return (
    <div className="items-table-view">
      <div className="items-table-toolbar">
        <h2 className="items-table-heading">All Items</h2>
        <span className="app-sidebar-count">
          {q ? `${sorted.length} of ${rows.length}` : rows.length} item{rows.length !== 1 ? 's' : ''}
        </span>
        <input
          className="text-input items-table-search"
          type="search"
          placeholder="Search items, anchors, categories…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search items"
        />
      </div>

      {rows.length === 0 ? (
        <p className="view-modal-empty">
          No candidates yet. Switch to the Plan view, enter Edit Plan, and add candidates to your anchors.
        </p>
      ) : sorted.length === 0 ? (
        <p className="view-modal-empty">Nothing matches “{query.trim()}”.</p>
      ) : (
        <div className="items-table-scroll">
          <table className="budget-table items-table">
            <thead>
              <tr>
                <th className="budget-th" />
                {header('name', 'Item')}
                {header('anchor', 'Anchor')}
                {header('category', 'Category')}
                <th className="budget-th">Dimensions</th>
                {header('price', 'Price', true)}
                {header('status', 'Status')}
                <th className="budget-th" />
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ anchor, candidate: c }) => {
                const dims = [c.width, c.height, c.depth].filter(Boolean).join(' × ') || '—'
                return (
                  <tr key={`${anchor.id}-${c.id}`} className={`budget-row ${c.status === 'rejected' ? 'row-rejected' : ''}`}>
                    <td className="budget-td items-table-thumb-cell">
                      {c.urls[0] ? (
                        <button className="items-table-thumb-btn" onClick={() => setLightbox(c)} title="View full size">
                          <img src={c.urls[0]} alt={c.name} className="items-table-thumb" loading="lazy" />
                        </button>
                      ) : (
                        <div className="items-table-thumb items-table-no-thumb" />
                      )}
                    </td>
                    <td className="budget-td items-table-name">
                      {c.name}
                      {c.link && (
                        <a className="view-candidate-link" href={c.link} target="_blank" rel="noreferrer" style={{ marginLeft: 6 }}>↗</a>
                      )}
                    </td>
                    <td className="budget-td">
                      <span className="items-table-anchor">
                        <span className="app-sidebar-dot" style={{ background: anchorColor(anchor.category) }} />
                        {anchor.label}
                      </span>
                    </td>
                    <td className="budget-td">{anchor.category || '—'}</td>
                    <td className="budget-td items-table-dims">{dims}</td>
                    <td className="budget-td budget-td-right budget-amount">
                      {priceOf(c) !== null ? `$${c.price}` : '—'}
                    </td>
                    <td className="budget-td">
                      <StatusPicker status={c.status} onChange={(s) => setStatus(c.id, s)} />
                    </td>
                    <td className="budget-td">
                      <button className="btn-secondary btn-compact" onClick={() => setEditAnchor(anchor)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {emptyAnchors.length > 0 && (
        <p className="budget-note">
          {emptyAnchors.length} anchor{emptyAnchors.length !== 1 ? 's have' : ' has'} no candidates yet:{' '}
          {emptyAnchors.map((a) => a.label).join(', ')}
        </p>
      )}

      {editAnchor && (
        <AnchorEditModal
          anchor={editAnchor}
          onSave={() => { onRefresh(); setEditAnchor(null) }}
        />
      )}

      {lightbox && (
        <Lightbox images={lightbox.urls} caption={lightbox.name} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}
