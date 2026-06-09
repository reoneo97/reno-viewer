import { describe, it, expect } from 'vitest'
import { computeBudget } from './budget'
import type { Anchor, CandidateImage } from '../types'

const makeAnchor = (overrides: Partial<Anchor> = {}): Anchor => ({
  id: '1', x: 50, y: 50, label: 'Test', category: 'Furniture', notes: '',
  candidates: [],
  ...overrides,
})

const makeCandidate = (price: string, extra: Partial<CandidateImage> = {}): CandidateImage => ({
  id: crypto.randomUUID(), name: 'Item', urls: [], description: '',
  width: '', height: '', depth: '', link: '', sharedWith: [], chosen: false,
  price,
  ...extra,
})

describe('computeBudget', () => {
  it('returns empty summary for no anchors', () => {
    const { lines, grand, undecidedAnchors } = computeBudget([])
    expect(lines).toHaveLength(0)
    expect(grand).toBe(0)
    expect(undecidedAnchors).toBe(0)
  })

  it('reports all-options total and chosen total separately', () => {
    const anchors = [
      makeAnchor({ candidates: [
        makeCandidate('500', { chosen: true }),
        makeCandidate('300'),
      ] }),
    ]
    const { grand, chosenGrand } = computeBudget(anchors)
    expect(grand).toBe(800)        // all priced options
    expect(chosenGrand).toBe(500)  // chosen only
  })

  it('groups items by anchor category', () => {
    const anchors = [
      makeAnchor({ id: '1', category: 'Furniture', candidates: [makeCandidate('400', { chosen: true })] }),
      makeAnchor({ id: '2', category: 'Appliances', candidates: [makeCandidate('200')] }),
    ]
    const { lines, grand, chosenGrand } = computeBudget(anchors)
    expect(grand).toBe(600)
    expect(chosenGrand).toBe(400)
    expect(lines).toHaveLength(2)
    expect(lines.find((l) => l.category === 'Furniture')?.chosenTotal).toBe(400)
    expect(lines.find((l) => l.category === 'Appliances')?.chosenTotal).toBe(0)
  })

  it('ignores candidates with non-numeric or empty prices', () => {
    const anchors = [
      makeAnchor({ candidates: [makeCandidate('TBC'), makeCandidate(''), makeCandidate('250', { chosen: true })] }),
    ]
    const { grand, chosenGrand, lines } = computeBudget(anchors)
    expect(grand).toBe(250)
    expect(chosenGrand).toBe(250)
    expect(lines[0].candidateCount).toBe(1)
  })

  it('counts an anchor with priced options but no chosen candidate as undecided', () => {
    const anchors = [
      makeAnchor({ id: '1', candidates: [makeCandidate('100'), makeCandidate('200')] }),
      makeAnchor({ id: '2', candidates: [makeCandidate('300', { chosen: true })] }),
    ]
    const { undecidedAnchors, chosenGrand } = computeBudget(anchors)
    expect(undecidedAnchors).toBe(1)
    expect(chosenGrand).toBe(300)
  })

  it('ignores anchors with no priced candidates entirely', () => {
    const { undecidedAnchors, grand } = computeBudget([makeAnchor({ candidates: [makeCandidate('')] })])
    expect(undecidedAnchors).toBe(0)
    expect(grand).toBe(0)
  })

  it('uses "Uncategorised" for anchors with no category', () => {
    const anchors = [makeAnchor({ category: '', candidates: [makeCandidate('50', { chosen: true })] })]
    const { lines } = computeBudget(anchors)
    expect(lines[0].category).toBe('Uncategorised')
  })

  it('sorts lines by all-options total descending', () => {
    const anchors = [
      makeAnchor({ id: '1', category: 'Lights and Fans', candidates: [makeCandidate('50', { chosen: true })] }),
      makeAnchor({ id: '2', category: 'Furniture', candidates: [makeCandidate('900', { chosen: true })] }),
    ]
    const { lines } = computeBudget(anchors)
    expect(lines[0].category).toBe('Furniture')
  })
})
