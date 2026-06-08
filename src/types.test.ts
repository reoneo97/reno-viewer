import { describe, it, expect } from 'vitest'
import { mapApiAnchor } from './types'
import type { ApiAnchor } from './types'

const baseAnchor: ApiAnchor = {
  id: 'a1', project_id: 'p1', x: 50, y: 30,
  label: 'Living Room Sofa', category: 'Furniture', notes: 'Near the window',
  created_at: '2024-01-01T00:00:00Z',
  candidates: [],
}

const baseCandidate = {
  id: 'c1', name: 'Herman Miller', image_urls: [],
  description: 'Ergonomic', width: '80', height: '70', depth: '50',
  price: '1200', link: 'https://example.com',
  created_at: '2024-01-01T00:00:00Z',
  anchors: [],
}

describe('mapApiAnchor', () => {
  it('maps all basic fields', () => {
    const a = mapApiAnchor(baseAnchor)
    expect(a.id).toBe('a1')
    expect(a.x).toBe(50)
    expect(a.y).toBe(30)
    expect(a.label).toBe('Living Room Sofa')
    expect(a.category).toBe('Furniture')
  })

  it('maps notes field', () => {
    expect(mapApiAnchor(baseAnchor).notes).toBe('Near the window')
  })

  it('defaults null category to empty string', () => {
    expect(mapApiAnchor({ ...baseAnchor, category: null }).category).toBe('')
  })

  it('defaults null notes to empty string', () => {
    expect(mapApiAnchor({ ...baseAnchor, notes: null }).notes).toBe('')
  })

  it('maps candidates', () => {
    const a = mapApiAnchor({ ...baseAnchor, candidates: [baseCandidate] })
    expect(a.candidates).toHaveLength(1)
    expect(a.candidates[0].name).toBe('Herman Miller')
    expect(a.candidates[0].price).toBe('1200')
  })

  it('defaults null candidate fields to empty strings', () => {
    const c = mapApiAnchor({
      ...baseAnchor,
      candidates: [{ ...baseCandidate, description: null, width: null, price: null, link: null }],
    }).candidates[0]
    expect(c.description).toBe('')
    expect(c.width).toBe('')
    expect(c.price).toBe('')
    expect(c.link).toBe('')
  })

  it('uses image_urls as urls array', () => {
    const c = mapApiAnchor({
      ...baseAnchor,
      candidates: [{ ...baseCandidate, image_urls: ['https://a.com/img.jpg'] }],
    }).candidates[0]
    expect(c.urls).toEqual(['https://a.com/img.jpg'])
  })

  it('filters sharedWith to exclude the anchor itself', () => {
    const c = mapApiAnchor({
      ...baseAnchor,
      candidates: [{
        ...baseCandidate,
        anchors: [
          { id: 'a1', label: 'Living Room Sofa' },
          { id: 'a2', label: 'Bedroom' },
        ],
      }],
    }).candidates[0]
    expect(c.sharedWith).toHaveLength(1)
    expect(c.sharedWith[0].id).toBe('a2')
  })

  it('returns empty sharedWith when candidate belongs only to this anchor', () => {
    const c = mapApiAnchor({
      ...baseAnchor,
      candidates: [{ ...baseCandidate, anchors: [{ id: 'a1', label: 'Living Room Sofa' }] }],
    }).candidates[0]
    expect(c.sharedWith).toHaveLength(0)
  })

  it('returns empty candidates array when none present', () => {
    expect(mapApiAnchor(baseAnchor).candidates).toHaveLength(0)
  })
})
