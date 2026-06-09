import type { Anchor } from '../types'

function escape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

const HEADERS = ['Anchor', 'Category', 'Notes', 'Candidate', 'Chosen', 'Price', 'Width', 'Height', 'Depth', 'Link']

export function buildCsvContent(anchors: Anchor[]): string {
  const rows: string[][] = [HEADERS]

  for (const anchor of anchors) {
    if (anchor.candidates.length === 0) {
      rows.push([anchor.label, anchor.category, anchor.notes, '', '', '', '', '', '', ''])
    } else {
      for (const c of anchor.candidates) {
        rows.push([
          anchor.label,
          anchor.category,
          anchor.notes,
          c.name,
          c.chosen ? 'Yes' : '',
          c.price,
          c.width,
          c.height,
          c.depth,
          c.link,
        ])
      }
    }
  }

  return rows.map((row) => row.map(escape).join(',')).join('\n')
}

export function downloadCsv(anchors: Anchor[], projectName: string): void {
  const csv = buildCsvContent(anchors)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${projectName}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
