import { describe, it, expect } from 'vitest'
import { buildCsvContent } from './csvExport'
import type { Anchor } from '../types'

const makeAnchor = (overrides: Partial<Anchor> = {}): Anchor => ({
  id: '1', x: 50, y: 50, label: 'Sofa Area', category: 'Furniture', notes: 'Check wall clearance',
  candidates: [],
  ...overrides,
})

const makeCandidate = (name: string, price = '500', extra = {}) => ({
  id: crypto.randomUUID(), urls: [], description: '',
  width: '80', height: '70', depth: '50', link: 'https://example.com', sharedWith: [], chosen: false,
  name, price,
  ...extra,
})

describe('buildCsvContent', () => {
  it('outputs a header row as the first line', () => {
    const csv = buildCsvContent([])
    const header = csv.split('\n')[0]
    expect(header).toContain('Anchor')
    expect(header).toContain('Category')
    expect(header).toContain('Notes')
    expect(header).toContain('Candidate')
    expect(header).toContain('Price')
    expect(header).toContain('Link')
  })

  it('produces one data row per candidate', () => {
    const anchor = makeAnchor({ candidates: [makeCandidate('Chair'), makeCandidate('Sofa')] })
    const rows = buildCsvContent([anchor]).split('\n')
    expect(rows).toHaveLength(3) // header + 2 candidates
  })

  it('produces one row for an anchor with no candidates', () => {
    const rows = buildCsvContent([makeAnchor()]).split('\n')
    expect(rows).toHaveLength(2) // header + 1 empty row
  })

  it('includes anchor label and category in each row', () => {
    const csv = buildCsvContent([makeAnchor({ candidates: [makeCandidate('Chair')] })])
    expect(csv).toContain('Sofa Area')
    expect(csv).toContain('Furniture')
  })

  it('includes anchor notes in each row', () => {
    const csv = buildCsvContent([makeAnchor({ candidates: [makeCandidate('Chair')] })])
    expect(csv).toContain('Check wall clearance')
  })

  it('includes candidate name and price', () => {
    const csv = buildCsvContent([makeAnchor({ candidates: [makeCandidate('Herman Miller', '1200')] })])
    expect(csv).toContain('Herman Miller')
    expect(csv).toContain('1200')
  })

  it('quotes values that contain commas', () => {
    const csv = buildCsvContent([makeAnchor({ label: 'Living Room, Main' })])
    expect(csv).toContain('"Living Room, Main"')
  })

  it('quotes values that contain double-quotes and escapes them', () => {
    const csv = buildCsvContent([makeAnchor({ label: 'The "Big" Sofa' })])
    expect(csv).toContain('"The ""Big"" Sofa"')
  })

  it('quotes values that contain newlines', () => {
    const csv = buildCsvContent([makeAnchor({ notes: 'Line one\nLine two' })])
    expect(csv).toContain('"Line one\nLine two"')
  })

  it('handles multiple anchors in order', () => {
    const anchors = [
      makeAnchor({ id: '1', label: 'Alpha', candidates: [makeCandidate('X')] }),
      makeAnchor({ id: '2', label: 'Beta', candidates: [makeCandidate('Y')] }),
    ]
    const rows = buildCsvContent(anchors).split('\n')
    expect(rows[1]).toContain('Alpha')
    expect(rows[2]).toContain('Beta')
  })
})
