export const ANCHOR_CATEGORIES = [
  'Furniture',
  'Lights and Fans',
  'Bathroom',
  'Kitchen',
  'Appliances',
  'Others',
]

// Interior-design palette: terracotta, brass, sage, slate. Muted enough to
// sit comfortably on a floor plan, distinct enough to scan at a glance.
export const CATEGORY_COLORS: Record<string, string> = {
  'Furniture':      '#b5654a',
  'Lights and Fans':'#c99a3c',
  'Bathroom':       '#5f8d83',
  'Kitchen':        '#8a6d8f',
  'Appliances':     '#6e82a3',
  'Others':         '#8d8678',
}

export const DEFAULT_ANCHOR_COLOR = '#7d7568'

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

// Decision state for a candidate, scoped to the anchor it was read under
// (a shared candidate can be chosen in one spot and rejected in another).
// Persisted on the anchor↔candidate link; '' = no decision yet.
export type CandidateStatus = '' | 'shortlisted' | 'chosen' | 'rejected'

export const STATUS_LABELS: Record<Exclude<CandidateStatus, ''>, string> = {
  shortlisted: 'Shortlisted',
  chosen: 'Chosen',
  rejected: 'Rejected',
}

export function isCandidateStatus(v: unknown): v is CandidateStatus {
  return v === '' || v === 'shortlisted' || v === 'chosen' || v === 'rejected'
}

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
  status: CandidateStatus  // decision for the anchor this candidate was read under
  sharedWith: AnchorRef[]  // other anchors this candidate also belongs to
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
  status?: string | null
  created_at: string
  anchors: AnchorRef[]
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
    status: isCandidateStatus(c.status) ? c.status : '',
    sharedWith: (c.anchors ?? []).filter((ref) => ref.id !== anchorId),
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
