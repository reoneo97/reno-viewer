import { useRef, useState } from 'react'
import type { Anchor } from '../types'
import { anchorColor } from '../types'
import { AnchorPoint } from './AnchorPoint'

interface Point { x: number; y: number }

interface Props {
  floorPlanUrl: string
  anchors: Anchor[]
  isEditMode: boolean
  onAddAnchor: (x: number, y: number) => Promise<void>
  onRefresh: () => void
}

const clampScale = (s: number) => Math.min(Math.max(s, 0.3), 5)
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

export function FloorPlanCanvas({ floorPlanUrl, anchors, isEditMode, onAddAnchor, onRefresh }: Props) {
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
  const lastConfirmAt = useRef(0)

  // Active pointers, keyed by pointerId, for pan + pinch-zoom.
  const pointers = useRef<Map<number, Point>>(new Map())
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 })
  const pinchStart = useRef({ dist: 0, scale: 1, mid: { x: 0, y: 0 }, ox: 0, oy: 0 })

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

  const usedCategories = [...new Set(anchors.map((a) => a.category).filter(Boolean))]

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
        className="canvas-inner"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        onClick={handleImageClick}
      >
        <img ref={imgRef} src={floorPlanUrl} alt="Floor plan" className="floor-plan-img" draggable={false} />

        {anchors.map((anchor) => (
          <AnchorPoint
            key={anchor.id}
            anchor={anchor}
            isEditMode={isEditMode}
            onRefresh={onRefresh}
            clientToPercent={clientToPercent}
          />
        ))}

        {pending && (
          <div
            className="anchor-wrapper pending-anchor"
            style={{ left: `${pending.x}%`, top: `${pending.y}%` }}
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

      {usedCategories.length > 0 && (
        <div className="legend">
          {usedCategories.map((cat) => (
            <div key={cat} className="legend-item">
              <span className="legend-dot" style={{ background: anchorColor(cat) }} />
              <span className="legend-label">{cat}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
