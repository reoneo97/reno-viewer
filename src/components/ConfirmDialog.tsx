import { useEffect, useState } from 'react'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface PendingConfirm extends ConfirmOptions {
  id: number
  resolve: (value: boolean) => void
}

let counter = 0
let current: PendingConfirm | null = null
const listeners = new Set<(c: PendingConfirm | null) => void>()
const emit = () => listeners.forEach((l) => l(current))

// Promise-based replacement for window.confirm().
export function confirmDialog(options: ConfirmOptions | string): Promise<boolean> {
  const opts = typeof options === 'string' ? { message: options } : options
  return new Promise((resolve) => {
    current = { ...opts, id: ++counter, resolve }
    emit()
  })
}

function close(result: boolean) {
  if (!current) return
  current.resolve(result)
  current = null
  emit()
}

export function ConfirmHost() {
  const [c, setC] = useState<PendingConfirm | null>(current)
  useEffect(() => {
    listeners.add(setC)
    return () => { listeners.delete(setC) }
  }, [])
  useEscapeKey((e) => { e.stopImmediatePropagation(); close(false) }, c !== null)

  if (!c) return null
  return (
    <div className="modal-backdrop" onClick={() => close(false)}>
      <div
        className="confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        <div className="confirm-dialog-body">
          {c.title && <div className="confirm-dialog-title">{c.title}</div>}
          <div className="confirm-dialog-message">{c.message}</div>
        </div>
        <div className="confirm-dialog-footer">
          <button className="btn-secondary" onClick={() => close(false)} autoFocus>
            {c.cancelLabel ?? 'Cancel'}
          </button>
          <button
            className={c.danger ? 'btn-danger' : 'btn-primary'}
            onClick={() => close(true)}
          >
            {c.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
