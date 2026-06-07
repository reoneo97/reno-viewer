import { useRef, useState } from 'react'
import type { Anchor } from '../types'
import { anchorColor } from '../types'
import { CandidatePopover } from './CandidatePopover'
import { CandidateViewModal } from './CandidateViewModal'
import { AnchorEditModal } from './AnchorEditModal'

interface Props {
  anchor: Anchor
  isEditMode: boolean
  onRefresh: () => void
}

export function AnchorPoint({ anchor, isEditMode, onRefresh }: Props) {
  const [hovered, setHovered] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const color = anchorColor(anchor.category)

  const handleMouseEnter = () => {
    if (isEditMode) return
    hoverTimer.current = setTimeout(() => setHovered(true), 100)
  }

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    setHovered(false)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isEditMode) {
      setShowEditModal(true)
    } else {
      setHovered(false)
      setShowViewModal(true)
    }
  }

  const hasCandidates = anchor.candidates.length > 0

  return (
    <>
      <div
        className="anchor-wrapper"
        style={{ left: `${anchor.x}%`, top: `${anchor.y}%` }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <div
          className={`anchor-pin ${isEditMode ? 'edit-mode' : ''}`}
          style={{ background: color }}
        >
          <span className="anchor-label">{anchor.label}</span>
          {hasCandidates && (
            <span className="candidate-badge">{anchor.candidates.length}</span>
          )}
        </div>

        {hovered && !showViewModal && <CandidatePopover anchor={anchor} />}
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
