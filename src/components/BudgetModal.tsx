import type { Anchor } from '../types'
import { computeBudget } from '../utils/budget'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface Props {
  anchors: Anchor[]
  onClose: () => void
}

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function BudgetModal({ anchors, onClose }: Props) {
  useEscapeKey(onClose)
  const { lines, grand, chosenGrand, undecidedAnchors } = computeBudget(anchors)

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2>Budget Summary</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {lines.length === 0 ? (
            <p className="view-modal-empty">
              No candidate prices entered yet. Add prices in the anchor edit modal to see a budget breakdown.
            </p>
          ) : (
            <>
              <table className="budget-table">
                <thead>
                  <tr>
                    <th className="budget-th">Category</th>
                    <th className="budget-th budget-th-right">Items</th>
                    <th className="budget-th budget-th-right">All options</th>
                    <th className="budget-th budget-th-right budget-th-chosen">★ Chosen</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.category} className="budget-row">
                      <td className="budget-td">{line.category}</td>
                      <td className="budget-td budget-td-right">{line.candidateCount}</td>
                      <td className="budget-td budget-td-right budget-amount">${fmt(line.total)}</td>
                      <td className="budget-td budget-td-right budget-amount budget-chosen-cell">
                        {line.chosenTotal > 0 ? `$${fmt(line.chosenTotal)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="budget-total-row">
                    <td className="budget-td budget-total-label" colSpan={2}>Grand total</td>
                    <td className="budget-td budget-td-right budget-total-amount">${fmt(grand)}</td>
                    <td className="budget-td budget-td-right budget-total-amount budget-chosen-cell">${fmt(chosenGrand)}</td>
                  </tr>
                </tfoot>
              </table>

              {undecidedAnchors > 0 && (
                <p className="budget-note">
                  {undecidedAnchors} anchor{undecidedAnchors !== 1 ? 's' : ''} have options but no chosen candidate yet.
                </p>
              )}

              <p className="budget-note">
                <strong>All options</strong> sums every priced candidate; <strong>★ Chosen</strong> is the committed cost.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
