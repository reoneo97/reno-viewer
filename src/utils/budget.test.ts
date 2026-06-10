import { describe, it, expect } from 'vitest'
import { computeBudget } from './budget'
import type { Anchor } from '../types'

const makeAnchor = (overrides: Partial<Anchor> = {}): Anchor => ({
  id: '1', x: 50, y: 50, label: 'Test', category: 'Furniture', notes: '',
  candidates: [],
  ...overrides,
})

const makeCandidate = (price: string, extra = {}) => ({
  id: crypto.randomUUID(), name: 'Item', urls: [], description: '',
  width: '', height: '', depth: '', link: '',
  status: '' as const, sharedWith: [],
  price,
  ...extra,
})

describe('computeBudget', () => {
  it('returns empty summary for no anchors', () => {
    const { lines, grand, unpricedAnchors } = computeBudget([])
    expect(lines).toHaveLength(0)
    expect(grand).toBe(0)
    expect(unpricedAnchors).toBe(0)
  })

  it('sums candidate prices within a category', () => {
    const anchors = [
      makeAnchor({ candidates: [makeCandidate('500'), makeCandidate('300')] }),
    ]
    const { grand } = computeBudget(anchors)
    expect(grand).toBe(800)
  })

  it('groups by anchor category', () => {
    const anchors = [
      makeAnchor({ id: '1', category: 'Furniture', candidates: [makeCandidate('400')] }),
      makeAnchor({ id: '2', category: 'Appliances', candidates: [makeCandidate('200')] }),
    ]
    const { lines, grand } = computeBudget(anchors)
    expect(grand).toBe(600)
    expect(lines).toHaveLength(2)
    expect(lines.find((l) => l.category === 'Furniture')?.total).toBe(400)
    expect(lines.find((l) => l.category === 'Appliances')?.total).toBe(200)
  })

  it('ignores candidates with empty prices', () => {
    const anchors = [
      makeAnchor({ candidates: [makeCandidate(''), makeCandidate('100')] }),
    ]
    const { grand, lines } = computeBudget(anchors)
    expect(grand).toBe(100)
    expect(lines[0].candidateCount).toBe(1)
  })

  it('ignores candidates with non-numeric prices', () => {
    const anchors = [
      makeAnchor({ candidates: [makeCandidate('TBC'), makeCandidate('250')] }),
    ]
    expect(computeBudget(anchors).grand).toBe(250)
  })

  it('counts anchor as unpriced when no candidates have prices', () => {
    const anchors = [
      makeAnchor({ id: '1', candidates: [makeCandidate('')] }),
      makeAnchor({ id: '2', candidates: [makeCandidate('100')] }),
    ]
    const { unpricedAnchors } = computeBudget(anchors)
    expect(unpricedAnchors).toBe(1)
  })

  it('counts anchor with no candidates as unpriced', () => {
    const { unpricedAnchors } = computeBudget([makeAnchor({ candidates: [] })])
    expect(unpricedAnchors).toBe(1)
  })

  it('uses "Uncategorised" for anchors with no category', () => {
    const anchors = [makeAnchor({ category: '', candidates: [makeCandidate('50')] })]
    const { lines } = computeBudget(anchors)
    expect(lines[0].category).toBe('Uncategorised')
  })

  it('chosenOnly counts only candidates marked chosen', () => {
    const anchors = [
      makeAnchor({
        candidates: [
          makeCandidate('500', { status: 'chosen' }),
          makeCandidate('300', { status: 'shortlisted' }),
          makeCandidate('200'),
        ],
      }),
    ]
    expect(computeBudget(anchors, true).grand).toBe(500)
    expect(computeBudget(anchors).grand).toBe(1000)
  })

  it('chosenOnly counts anchors without chosen candidates as unpriced', () => {
    const anchors = [makeAnchor({ candidates: [makeCandidate('100', { status: 'shortlisted' })] })]
    const { unpricedAnchors, grand } = computeBudget(anchors, true)
    expect(grand).toBe(0)
    expect(unpricedAnchors).toBe(1)
  })

  it('sorts lines by total descending', () => {
    const anchors = [
      makeAnchor({ id: '1', category: 'Lights and Fans', candidates: [makeCandidate('50')] }),
      makeAnchor({ id: '2', category: 'Furniture', candidates: [makeCandidate('900')] }),
    ]
    const { lines } = computeBudget(anchors)
    expect(lines[0].category).toBe('Furniture')
  })
})
