import type { Anchor } from '../types'

export interface BudgetLine {
  category: string
  candidateCount: number
  total: number
}

export interface BudgetSummary {
  lines: BudgetLine[]
  grand: number
  unpricedAnchors: number
}

export function computeBudget(anchors: Anchor[]): BudgetSummary {
  const map = new Map<string, { count: number; total: number }>()
  let unpricedAnchors = 0

  for (const anchor of anchors) {
    const pricedCandidates = anchor.candidates.filter((c) => {
      const n = parseFloat(c.price)
      return !isNaN(n) && n > 0
    })

    if (pricedCandidates.length === 0) {
      unpricedAnchors++
      continue
    }

    const key = anchor.category || 'Uncategorised'
    const entry = map.get(key) ?? { count: 0, total: 0 }
    for (const c of pricedCandidates) {
      entry.count++
      entry.total += parseFloat(c.price)
    }
    map.set(key, entry)
  }

  const lines: BudgetLine[] = [...map.entries()]
    .map(([category, { count, total }]) => ({ category, candidateCount: count, total }))
    .sort((a, b) => b.total - a.total)

  const grand = lines.reduce((sum, l) => sum + l.total, 0)
  return { lines, grand, unpricedAnchors }
}
