import { useEffect, useRef, useState } from 'react'
import type { Anchor } from '../types'
import { anchorColor } from '../types'
import { updateAnchor } from '../api'
import { toast } from './Toast'
import { CandidatePopover } from './CandidatePopover'
import { CandidateViewModal } from './CandidateViewModal'
import { AnchorEditModal } from './AnchorEditModal'

interface Point { x: number; y: number }

interface Props {
  anchor: Anchor
  isEditMode: boolean
  onRefresh: () => void
  // Maps a screen coordinate to a percentage of the floor plan. Provided by
  // FloorPlanCanvas; absent in contexts that don't support dragging.
  clientToPercent?: (clientX: number, clientY: number) => Point | null
}

// Movement (px) before a press is treated as a drag rather than a tap.
const DRAG_THRESHOLD = 4

export function AnchorPoint({ anchor, isEditMode, onRefresh, clientToPercent }: Props) {
  const [hovered, setHovered] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [dragPos, setDragPos] = useState<Point | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const drag = useRef<{ pointerId: number; startX: number; startY: number; moved: boolean } | null>(null)
  const color = anchorColor(anchor.category)

  // Once a move is persisted and the refreshed anchor arrives, drop the
  // optimistic position so it snaps cleanly to the saved coordinates.
  useEffect(() => { setDragPos(null) }, [anchor.x, anchor.y])

  const handleMouseEnter = () => {
    if (isEditMode) return
    hoverTimer.current = setTimeout(() => setHovered(true), 100)
  }

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    setHovered(false)
  }

  // View-mode click opens the read-only modal. Edit-mode interactions are
  // handled by the pointer handlers below (tap vs drag).
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isEditMode) return
    setHovered(false)
    setShowViewModal(true)
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isEditMode) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const st = drag.current
    if (!st || st.pointerId !== e.pointerId) return
    if (!st.moved && Math.hypot(e.clientX - st.startX, e.clientY - st.startY) < DRAG_THRESHOLD) return
    st.moved = true
    const p = clientToPercent?.(e.clientX, e.clientY)
    if (p) setDragPos(p)
  }

  const handlePointerUp = async (e: React.PointerEvent) => {
    const st = drag.current
    if (!st || st.pointerId !== e.pointerId) return
    drag.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* already released */ }

    if (!st.moved) {
      // A tap in edit mode opens the edit modal.
      setShowEditModal(true)
      return
    }
    if (!dragPos) return
    const pos = dragPos
    try {
      await updateAnchor(anchor.id, { x: pos.x, y: pos.y })
      onRefresh()
    } catch {
      toast.error('Failed to move anchor')
      setDragPos(null)
    }
  }

  const hasCandidates = anchor.candidates.length > 0
  const pos = dragPos ?? { x: anchor.x, y: anchor.y }
  const isDragging = dragPos !== null

  return (
    <>
      <div
        className="anchor-wrapper"
        style={{ left: `${pos.x}%`, top: `${pos.y}%`, touchAction: 'none' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className={`anchor-pin ${isEditMode ? 'edit-mode' : ''} ${isDragging ? 'dragging' : ''}`}
          style={{ background: color }}
        >
          <span className="anchor-label">{anchor.label}</span>
          {hasCandidates && (
            <span className="candidate-badge">{anchor.candidates.length}</span>
          )}
        </div>

        {hovered && !showViewModal && !isDragging && <CandidatePopover anchor={anchor} />}
      </div>

      {showViewModal && (
        <CandidateViewModal
          anchor={anchor}
          onClose={() => setShowViewModal(false)}
        />
      )}

      {showEditModal && (
        <AnchorEditModal
          anchor={anchor}
          onSave={() => { onRefresh(); setShowEditModal(false) }}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </>
  )
}
