import { useRef, useState } from 'react'
import type { Anchor } from '../types'
import { anchorColor } from '../types'
import { AnchorPoint } from './AnchorPoint'

interface PendingAnchor { x: number; y: number }

interface Props {
  floorPlanUrl: string
  anchors: Anchor[]
  isEditMode: boolean
  onAddAnchor: (x: number, y: number) => Promise<void>
  onRefresh: () => void
}

export function FloorPlanCanvas({ floorPlanUrl, anchors, isEditMode, onAddAnchor, onRefresh }: Props) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 })
  const [pending, setPending] = useState<PendingAnchor | null>(null)
  const [confirming, setConfirming] = useState(false)
  const lastConfirmAt = useRef(0)

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isEditMode || isPanning) return
    if (Date.now() - lastConfirmAt.current < 500) return
    const img = imgRef.current
    if (!img) return
    const rect = img.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setPending({ x, y })
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
    setScale((s) => Math.min(Math.max(s * delta, 0.3), 5))
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditMode) return
    setIsPanning(true)
    panStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return
    setOffset({
      x: panStart.current.ox + (e.clientX - panStart.current.x),
      y: panStart.current.oy + (e.clientY - panStart.current.y),
    })
  }

  const handleMouseUp = () => setIsPanning(false)

  const usedCategories = [...new Set(anchors.map((a) => a.category).filter(Boolean))]

  return (
    <div
      className="canvas-container"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
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
              <button className="cancel-btn" onClick={cancelAnchor}>✕</button>
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
