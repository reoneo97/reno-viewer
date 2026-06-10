import { useState } from 'react'
import type { Anchor } from '../types'
import { computeBudget } from '../utils/budget'

interface Props {
  projectId: string
  anchors: Anchor[]
}

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const targetKey = (projectId: string) => `reno-budget-target-${projectId}`

function loadTarget(projectId: string): string {
  return localStorage.getItem(targetKey(projectId)) ?? ''
}

// Full budget screen: target tracking, decided-vs-considering split by
// category, and a per-anchor breakdown showing where decisions stand.
// The target budget is kept locally (per project, per browser).
export function BudgetView({ projectId, anchors }: Props) {
  const [target, setTarget] = useState(() => loadTarget(projectId))

  const all = computeBudget(anchors)
  const chosen = computeBudget(anchors, true)
  const chosenByCategory = new Map(chosen.lines.map((l) => [l.category, l]))

  const targetNum = parseFloat(target)
  const hasTarget = !isNaN(targetNum) && targetNum > 0
  const remaining = hasTarget ? targetNum - chosen.grand : 0
  const usedPct = hasTarget ? Math.min((chosen.grand / targetNum) * 100, 100) : 0
  const overBudget = hasTarget && remaining < 0

  const handleTarget = (value: string) => {
    setTarget(value)
    if (value.trim()) localStorage.setItem(targetKey(projectId), value.trim())
    else localStorage.removeItem(targetKey(projectId))
  }

  const decidedAnchors = anchors.filter((a) => a.candidates.some((c) => c.status === 'chosen'))

  return (
    <div className="budget-view">
      <div className="budget-view-inner">
        <h2 className="items-table-heading">Budget</h2>

        {/* ── Target tracker ──────────────────────────────── */}
        <div className="budget-target-card">
          <div className="budget-target-row">
            <label className="field-label" htmlFor="budget-target" style={{ marginBottom: 0 }}>
              Target budget
            </label>
            <div className="budget-target-input-wrap">
              <span className="dim-label">$</span>
              <input
                id="budget-target"
                className="text-input budget-target-input"
                inputMode="decimal"
                placeholder="e.g. 25000"
                value={target}
                onChange={(e) => handleTarget(e.target.value)}
              />
            </div>
          </div>

          <div className="budget-figures">
            <div className="budget-figure">
              <span className="budget-figure-label">Decided</span>
              <span className="budget-figure-value budget-figure-chosen">${fmt(chosen.grand)}</span>
            </div>
            <div className="budget-figure">
              <span className="budget-figure-label">Considering</span>
              <span className="budget-figure-value">${fmt(all.grand)}</span>
            </div>
            {hasTarget && (
              <div className="budget-figure">
                <span className="budget-figure-label">{overBudget ? 'Over budget' : 'Remaining'}</span>
                <span className={`budget-figure-value ${overBudget ? 'budget-figure-over' : ''}`}>
                  ${fmt(Math.abs(remaining))}
                </span>
              </div>
            )}
          </div>

          {hasTarget && (
            <div className="budget-bar" role="progressbar" aria-valuenow={Math.round(usedPct)} aria-valuemin={0} aria-valuemax={100}>
              <div
                className={`budget-bar-fill ${overBudget ? 'budget-bar-over' : ''}`}
                style={{ width: `${usedPct}%` }}
              />
            </div>
          )}

          <p className="budget-note">
            “Decided” counts only candidates marked <strong>Chosen</strong>. “Considering” sums every
            priced candidate. The target is saved on this device.
          </p>
        </div>

        {/* ── By category ─────────────────────────────────── */}
        {all.lines.length === 0 ? (
          <p className="view-modal-empty">
            No candidate prices entered yet. Add prices to candidates to see a budget breakdown.
          </p>
        ) : (
          <>
            <h3 className="budget-section-heading">By category</h3>
            <table className="budget-table">
              <thead>
                <tr>
                  <th className="budget-th">Category</th>
                  <th className="budget-th budget-th-right">Items</th>
                  <th className="budget-th budget-th-right">Considering</th>
                  <th className="budget-th budget-th-right">Decided</th>
                </tr>
              </thead>
              <tbody>
                {all.lines.map((line) => {
                  const c = chosenByCategory.get(line.category)
                  return (
                    <tr key={line.category} className="budget-row">
                      <td className="budget-td">{line.category}</td>
                      <td className="budget-td budget-td-right">{line.candidateCount}</td>
                      <td className="budget-td budget-td-right budget-amount">${fmt(line.total)}</td>
                      <td className="budget-td budget-td-right budget-amount budget-amount-chosen">
                        {c ? `$${fmt(c.total)}` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="budget-total-row">
                  <td className="budget-td budget-total-label" colSpan={2}>Total</td>
                  <td className="budget-td budget-td-right budget-amount">${fmt(all.grand)}</td>
                  <td className="budget-td budget-td-right budget-total-amount">${fmt(chosen.grand)}</td>
                </tr>
              </tfoot>
            </table>

            {/* ── By anchor ───────────────────────────────── */}
            <h3 className="budget-section-heading">By anchor</h3>
            <table className="budget-table">
              <thead>
                <tr>
                  <th className="budget-th">Anchor</th>
                  <th className="budget-th">Decision</th>
                  <th className="budget-th budget-th-right">Decided</th>
                </tr>
              </thead>
              <tbody>
                {anchors.map((a) => {
                  const chosenC = a.candidates.find((c) => c.status === 'chosen')
                  const n = chosenC ? parseFloat(chosenC.price) : NaN
                  return (
                    <tr key={a.id} className="budget-row">
                      <td className="budget-td">{a.label}</td>
                      <td className="budget-td">
                        {chosenC
                          ? <span className="budget-decided">✓ {chosenC.name}</span>
                          : <span className="budget-undecided">{a.candidates.length} option{a.candidates.length !== 1 ? 's' : ''}, undecided</span>
                        }
                      </td>
                      <td className="budget-td budget-td-right budget-amount">
                        {chosenC && !isNaN(n) && n > 0 ? `$${fmt(n)}` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {decidedAnchors.length < anchors.length && (
              <p className="budget-note">
                {anchors.length - decidedAnchors.length} of {anchors.length} anchors still undecided —
                mark a candidate as “Chosen” to count it in the decided total.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
