import { useEffect, useRef, useState } from 'react'
import type { Anchor } from '../types'
import { anchorColor } from '../types'
import { AnchorPoint } from './AnchorPoint'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface Point { x: number; y: number }

export interface FocusRequest {
  anchorId: string
  // Distinguishes repeated requests for the same anchor.
  nonce: number
}

interface Props {
  floorPlanUrl: string
  anchors: Anchor[]
  isEditMode: boolean
  onAddAnchor: (x: number, y: number) => Promise<void>
  onRefresh: () => void
  // Pan/zoom to an anchor and pulse it (issued by the sidebar).
  focusRequest?: FocusRequest | null
  // Fired when a pin is opened in view mode (lets the sidebar follow along).
  onAnchorSelect?: (anchorId: string) => void
}

const MIN_SCALE = 0.3
const MAX_SCALE = 5
const clampScale = (s: number) => Math.min(Math.max(s, MIN_SCALE), MAX_SCALE)
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

// Legend key for anchors without a category.
const UNCATEGORISED = ''

export function FloorPlanCanvas({ floorPlanUrl, anchors, isEditMode, onAddAnchor, onRefresh, focusRequest, onAnchorSelect }: Props) {
  const imgRef = useRef<HTMLImageElement>(null)

  // scale/offset are mirrored into refs so the pointer handlers always read
  // the latest value (avoiding stale-closure jumps during pinch / pan).
  const [scale, setScaleState] = useState(1)
  const scaleRef = useRef(1)
  const setScale = (s: number) => { scaleRef.current = s; setScaleState(s) }

  const [offset, setOffsetState] = useState<Point>({ x: 0, y: 0 })
  const offsetRef = useRef<Point>({ x: 0, y: 0 })
  const setOffset = (o: Point) => { offsetRef.current = o; setOffsetState(o) }

  const [isPanning, setIsPanning] = useState(false)
  const [pending, setPending] = useState<Point | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set())
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [animating, setAnimating] = useState(false)
  const focusTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const lastConfirmAt = useRef(0)

  // Active pointers, keyed by pointerId, for pan + pinch-zoom.
  const pointers = useRef<Map<number, Point>>(new Map())
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 })
  const pinchStart = useRef({ dist: 0, scale: 1, mid: { x: 0, y: 0 }, ox: 0, oy: 0 })

  useEscapeKey(() => setPending(null), pending !== null)

  // Sidebar → canvas: pan/zoom so the requested anchor is centred, then
  // pulse it. The transform transition is enabled only for this animation
  // so wheel/pinch zooming stays immediate.
  useEffect(() => {
    if (!focusRequest) return
    const anchor = anchors.find((a) => a.id === focusRequest.anchorId)
    const img = imgRef.current
    if (!anchor || !img) return

    // Make sure the pin isn't filtered out by the legend.
    setHiddenCategories((prev) => {
      if (!prev.has(anchor.category)) return prev
      const next = new Set(prev)
      next.delete(anchor.category)
      return next
    })

    const targetScale = clampScale(Math.max(scaleRef.current, 1.5))
    // offsetWidth/Height are layout sizes, unaffected by the CSS transform.
    const dx = (anchor.x / 100 - 0.5) * img.offsetWidth
    const dy = (anchor.y / 100 - 0.5) * img.offsetHeight

    setAnimating(true)
    setScale(targetScale)
    setOffset({ x: -dx * targetScale, y: -dy * targetScale })
    setHighlightedId(anchor.id)

    focusTimers.current.forEach(clearTimeout)
    focusTimers.current = [
      setTimeout(() => setAnimating(false), 450),
      setTimeout(() => setHighlightedId(null), 2000),
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest])

  useEffect(() => () => focusTimers.current.forEach(clearTimeout), [])

  // Convert a screen coordinate to a percentage of the floor-plan image.
  const clientToPercent = (clientX: number, clientY: number): Point | null => {
    const img = imgRef.current
    if (!img) return null
    const rect = img.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 100
    const y = ((clientY - rect.top) / rect.height) * 100
    return { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) }
  }

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isEditMode || isPanning) return
    if (Date.now() - lastConfirmAt.current < 500) return
    const p = clientToPercent(e.clientX, e.clientY)
    if (p) setPending(p)
  }

  const confirmAnchor = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!pending || confirming) return
    setConfirming(true)
    try {
      await onAddAnchor(pending.x, pending.y)
    } finally {
      lastConfirmAt.current = Date.now()
      setConfirming(false)
      setPending(null)
    }
  }

  const cancelAnchor = (e: React.MouseEvent) => {
    e.stopPropagation()
    setPending(null)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale(clampScale(scaleRef.current * delta))
  }

  const zoomBy = (factor: number) => setScale(clampScale(scaleRef.current * factor))
  const resetView = () => { setScale(1); setOffset({ x: 0, y: 0 }) }

  // ── Pointer-based pan & pinch-zoom (mouse + touch) ──────────────────────────
  const beginPan = (clientX: number, clientY: number) => {
    setIsPanning(true)
    panStart.current = { x: clientX, y: clientY, ox: offsetRef.current.x, oy: offsetRef.current.y }
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]
    if (pts.length === 2) {
      // Start a pinch: capture baseline distance, scale, midpoint and offset.
      const mid = midpoint(pts[0], pts[1])
      pinchStart.current = {
        dist: distance(pts[0], pts[1]),
        scale: scaleRef.current,
        mid,
        ox: offsetRef.current.x,
        oy: offsetRef.current.y,
      }
      setIsPanning(false)
    } else if (pts.length === 1 && !isEditMode) {
      beginPan(e.clientX, e.clientY)
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]

    if (pts.length === 2) {
      const d = distance(pts[0], pts[1])
      const mid = midpoint(pts[0], pts[1])
      const ratio = pinchStart.current.dist ? d / pinchStart.current.dist : 1
      setScale(clampScale(pinchStart.current.scale * ratio))
      setOffset({
        x: pinchStart.current.ox + (mid.x - pinchStart.current.mid.x),
        y: pinchStart.current.oy + (mid.y - pinchStart.current.mid.y),
      })
    } else if (pts.length === 1 && isPanning) {
      setOffset({
        x: panStart.current.ox + (e.clientX - panStart.current.x),
        y: panStart.current.oy + (e.clientY - panStart.current.y),
      })
    }
  }

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    const pts = [...pointers.current.values()]
    if (pts.length === 1 && !isEditMode) {
      // Lifted one finger after a pinch — continue panning with the other.
      beginPan(pts[0].x, pts[0].y)
    } else if (pts.length === 0) {
      setIsPanning(false)
    }
  }

  const toggleCategory = (cat: string) =>
    setHiddenCategories((prev) => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })

  const usedCategories = [...new Set(anchors.map((a) => a.category))]
    .sort((a, b) => (a === UNCATEGORISED ? 1 : b === UNCATEGORISED ? -1 : a.localeCompare(b)))
  const visibleAnchors = anchors.filter((a) => !hiddenCategories.has(a.category))

  // Pins live inside the scaled wrapper; counter-scale them so they keep a
  // constant on-screen size at any zoom level, like map markers. Capped so
  // pins don't dwarf the plan when zoomed far out.
  const pinScale = Math.min(1 / scale, 2)

  return (
    <div
      className="canvas-container"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onPointerLeave={endPointer}
      style={{ cursor: isEditMode ? 'crosshair' : isPanning ? 'grabbing' : 'grab' }}
    >
      <div
        className={`canvas-inner ${animating ? 'canvas-animating' : ''}`}
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        onClick={handleImageClick}
      >
        <img ref={imgRef} src={floorPlanUrl} alt="Floor plan" className="floor-plan-img" draggable={false} />

        {visibleAnchors.map((anchor) => (
          <AnchorPoint
            key={anchor.id}
            anchor={anchor}
            isEditMode={isEditMode}
            onRefresh={onRefresh}
            clientToPercent={clientToPercent}
            pinScale={pinScale}
            highlighted={highlightedId === anchor.id}
            onSelect={onAnchorSelect}
          />
        ))}

        {pending && (
          <div
            className="anchor-wrapper pending-anchor"
            style={{
              left: `${pending.x}%`,
              top: `${pending.y}%`,
              transform: `translate(-50%, -50%) scale(${pinScale})`,
            }}
          >
            <div className="anchor-pin pending" />
            <div className="pending-confirm">
              <button className="confirm-btn" onClick={confirmAnchor} disabled={confirming}>
                {confirming ? '…' : '+ Add anchor'}
              </button>
              <button className="cancel-btn" aria-label="Cancel" onClick={cancelAnchor}>✕</button>
            </div>
          </div>
        )}
      </div>

      {isEditMode && (
        <div className="edit-hint" role="status">
          <span className="edit-hint-dot" />
          Tap the plan to place a pin · drag pins to move · click a pin to edit
        </div>
      )}

      {usedCategories.length > 0 && (
        <div className="legend" onPointerDown={(e) => e.stopPropagation()}>
          <div className="legend-title">Categories</div>
          {usedCategories.map((cat) => {
            const hidden = hiddenCategories.has(cat)
            return (
              <button
                key={cat || '__none__'}
                className={`legend-item ${hidden ? 'legend-item-off' : ''}`}
                onClick={() => toggleCategory(cat)}
                title={hidden ? 'Show category' : 'Hide category'}
              >
                <span className="legend-dot" style={{ background: anchorColor(cat) }} />
                <span className="legend-label">{cat || 'Uncategorised'}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="zoom-controls" onPointerDown={(e) => e.stopPropagation()}>
        <button className="zoom-btn" onClick={() => zoomBy(0.8)} title="Zoom out" aria-label="Zoom out">−</button>
        <button className="zoom-readout" onClick={resetView} title="Reset view">
          {Math.round(scale * 100)}%
        </button>
        <button className="zoom-btn" onClick={() => zoomBy(1.25)} title="Zoom in" aria-label="Zoom in">+</button>
      </div>
    </div>
  )
}
