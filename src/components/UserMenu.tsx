import { useEffect, useRef, useState } from 'react'
import { getUsername } from '../api/client'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { UsersModal } from './UsersModal'
import { HelpModal } from './HelpModal'

interface Props {
  onLogout: () => void
}

// Account dropdown in the toolbar's top-right corner: identity, user
// management, the tutorial, and sign-out live here so the toolbar itself
// stays scannable.
export function UserMenu({ onLogout }: Props) {
  const [open, setOpen] = useState(false)
  const [showUsers, setShowUsers] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const username = getUsername()

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
    <>
      <div className="menu-root" ref={rootRef}>
        <button
          className="user-menu-trigger"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          title={username ? `Signed in as ${username}` : 'Account'}
        >
          {(username[0] ?? '?').toUpperCase()}
        </button>

        {open && (
          <div className="menu-popup menu-popup-right" role="menu">
            {username && <div className="user-menu-identity">Signed in as <strong>{username}</strong></div>}
            <button className="menu-item" role="menuitem" onClick={pick(() => setShowHelp(true))}>
              <span className="menu-item-icon" aria-hidden>❓</span>
              <span>
                Help &amp; tutorial
                <span className="menu-item-hint">How the app works, step by step</span>
              </span>
            </button>
            <button className="menu-item" role="menuitem" onClick={pick(() => setShowUsers(true))}>
              <span className="menu-item-icon" aria-hidden>👥</span>
              <span>
                Manage users
                <span className="menu-item-hint">Add accounts, change password</span>
              </span>
            </button>
            <button className="menu-item" role="menuitem" onClick={pick(onLogout)}>
              <span className="menu-item-icon" aria-hidden>↪</span>
              <span>Sign out</span>
            </button>
          </div>
        )}
      </div>

      {showUsers && <UsersModal onClose={() => setShowUsers(false)} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </>
  )
}
