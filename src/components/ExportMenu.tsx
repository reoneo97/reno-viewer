import { useEffect, useRef, useState } from 'react'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface Props {
  busy: boolean
  hasAnchors: boolean
  onShare: () => void
  onExport: () => void
  onCsv: () => void
}

// Toolbar dropdown grouping the outward-facing actions (share link, HTML
// snapshot, CSV) behind a single button to keep the toolbar scannable.
export function ExportMenu({ busy, hasAnchors, onShare, onExport, onCsv }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEscapeKey(() => setOpen(false), open)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const pick = (action: () => void) => () => { setOpen(false); action() }

  return (
    <div className="menu-root" ref={rootRef}>
      <button
        className={`btn-secondary menu-trigger ${open ? 'menu-trigger-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {busy ? 'Working…' : 'Share & Export'}
        <span className="menu-caret" aria-hidden>▾</span>
      </button>

      {open && (
        <div className="menu-popup" role="menu">
          <button className="menu-item" role="menuitem" onClick={pick(onShare)}>
            <span className="menu-item-icon" aria-hidden>🔗</span>
            <span>
              Share link
              <span className="menu-item-hint">Read-only link, no login needed</span>
            </span>
          </button>
          <button className="menu-item" role="menuitem" onClick={pick(onExport)}>
            <span className="menu-item-icon" aria-hidden>⬇</span>
            <span>
              Download snapshot
              <span className="menu-item-hint">Self-contained HTML file</span>
            </span>
          </button>
          <button className="menu-item" role="menuitem" onClick={pick(onCsv)} disabled={!hasAnchors}>
            <span className="menu-item-icon" aria-hidden>📋</span>
            <span>
              Download CSV
              <span className="menu-item-hint">Item list for spreadsheets</span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
