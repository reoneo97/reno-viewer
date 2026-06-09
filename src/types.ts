export const ANCHOR_CATEGORIES = [
  'Furniture',
  'Lights and Fans',
  'Bathroom',
  'Kitchen',
  'Appliances',
  'Others',
]

export const CATEGORY_COLORS: Record<string, string> = {
  'Furniture':      '#4a90d9',
  'Lights and Fans':'#f1c40f',
  'Bathroom':       '#1abc9c',
  'Kitchen':        '#8e44ad',
  'Appliances':     '#e67e22',
  'Others':         '#95a5a6',
}

export const DEFAULT_ANCHOR_COLOR = '#7f8c8d'

export function anchorColor(category: string): string {
  return CATEGORY_COLORS[category] ?? DEFAULT_ANCHOR_COLOR
}

export function formatDims(w: string, h: string, d: string): string {
  const parts = [
    w ? `W ${w}` : '',
    h ? `H ${h}` : '',
    d ? `D ${d}` : '',
  ].filter(Boolean)
  return parts.join(' × ')
}

// ── Frontend component types ──────────────────────────────────────────────────

export interface AnchorRef {
  id: string
  label: string
}

export interface CandidateImage {
  id: string
  name: string
  urls: string[]     // presigned URLs (from API); first is primary display image
  description: string
  width: string
  height: string
  depth: string
  price: string
  link: string
  sharedWith: AnchorRef[]  // other anchors this candidate also belongs to
  chosen: boolean          // the picked option for the anchor it was read under
}

export interface Anchor {
  id: string
  x: number          // percentage of image width
  y: number          // percentage of image height
  label: string
  category: string
  notes: string
  candidates: CandidateImage[]
}

// ── API response types ────────────────────────────────────────────────────────

export interface ApiCandidate {
  id: string
  name: string
  image_urls: string[]
  description: string | null
  width: string | null
  height: string | null
  depth: string | null
  price: string | null
  link: string | null
  created_at: string
  anchors: AnchorRef[]
  chosen: boolean
}

export interface ApiAnchor {
  id: string
  project_id: string
  x: number
  y: number
  label: string
  category: string | null
  notes: string | null
  created_at: string
  candidates: ApiCandidate[]
}

export interface ApiProject {
  id: string
  name: string
  floor_plan_url: string | null
  created_at: string
  anchors: ApiAnchor[]
}

// ── Mappers ───────────────────────────────────────────────────────────────────

export function mapApiCandidate(c: ApiCandidate, anchorId: string): CandidateImage {
  return {
    id: c.id,
    name: c.name,
    urls: c.image_urls ?? [],
    description: c.description ?? '',
    width: c.width ?? '',
    height: c.height ?? '',
    depth: c.depth ?? '',
    price: c.price ?? '',
    link: c.link ?? '',
    sharedWith: (c.anchors ?? []).filter((ref) => ref.id !== anchorId),
    chosen: c.chosen ?? false,
  }
}

export function mapApiAnchor(a: ApiAnchor): Anchor {
  return {
    id: a.id,
    x: a.x,
    y: a.y,
    label: a.label,
    category: a.category ?? '',
    notes: a.notes ?? '',
    candidates: a.candidates.map((c) => mapApiCandidate(c, a.id)),
  }
}
