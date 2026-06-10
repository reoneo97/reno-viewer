import type { CandidateStatus } from '../types'
import { STATUS_LABELS } from '../types'

const PICKABLE: Exclude<CandidateStatus, ''>[] = ['shortlisted', 'chosen', 'rejected']

// Small read-only badge. Renders nothing when no decision has been made.
export function StatusBadge({ status }: { status: CandidateStatus }) {
  if (!status) return null
  return <span className={`status-badge status-${status}`}>{STATUS_LABELS[status]}</span>
}

interface PickerProps {
  status: CandidateStatus
  onChange: (status: CandidateStatus) => void
  disabled?: boolean
}

// Three-way toggle. Clicking the active status clears it back to undecided.
export function StatusPicker({ status, onChange, disabled }: PickerProps) {
  return (
    <div className="status-picker" role="group" aria-label="Decision status">
      {PICKABLE.map((s) => (
        <button
          key={s}
          type="button"
          className={`status-pick status-pick-${s} ${status === s ? 'active' : ''}`}
          onClick={() => onChange(status === s ? '' : s)}
          disabled={disabled}
          aria-pressed={status === s}
        >
          {STATUS_LABELS[s]}
        </button>
      ))}
    </div>
  )
}
