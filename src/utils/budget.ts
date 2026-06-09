import type { Anchor } from '../types'

export interface BudgetLine {
  category: string
  candidateCount: number   // number of priced options seen
  total: number            // sum of all priced options (exploratory)
  chosenTotal: number      // sum of priced chosen candidates (committed)
}

export interface BudgetSummary {
  lines: BudgetLine[]
  grand: number            // exploratory grand total (all options)
  chosenGrand: number      // committed grand total (chosen only)
  undecidedAnchors: number // anchors with candidates but none marked chosen
}

const priceOf = (p: string): number => {
  const n = parseFloat(p)
  return isNaN(n) ? 0 : n
}

// Budget reports two figures per category: the full "all options" total
// (exploratory) and the "chosen" total (committed). Anchors that have options
// but no chosen one are reported as "undecided".
export function computeBudget(anchors: Anchor[]): BudgetSummary {
  const map = new Map<string, { count: number; total: number; chosenTotal: number }>()
  let undecidedAnchors = 0

  for (const anchor of anchors) {
    const priced = anchor.candidates.filter((c) => priceOf(c.price) > 0)
    if (priced.length === 0) continue

    if (!anchor.candidates.some((c) => c.chosen)) undecidedAnchors++

    const key = anchor.category || 'Uncategorised'
    const entry = map.get(key) ?? { count: 0, total: 0, chosenTotal: 0 }
    for (const c of priced) {
      entry.count++
      entry.total += priceOf(c.price)
      if (c.chosen) entry.chosenTotal += priceOf(c.price)
    }
    map.set(key, entry)
  }

  const lines: BudgetLine[] = [...map.entries()]
    .map(([category, v]) => ({ category, candidateCount: v.count, total: v.total, chosenTotal: v.chosenTotal }))
    .sort((a, b) => b.total - a.total)

  const grand = lines.reduce((sum, l) => sum + l.total, 0)
  const chosenGrand = lines.reduce((sum, l) => sum + l.chosenTotal, 0)
  return { lines, grand, chosenGrand, undecidedAnchors }
}
