import { useEffect, useRef } from 'react'

// Calls `handler` when Escape is pressed. Pass active=false to disable.
//
// The listener is registered once on mount (reading the latest handler/active
// via a ref) so registration order stays stable across renders. That lets a
// nested layer — e.g. the confirm dialog — call stopImmediatePropagation() in
// its handler to keep the Escape from also reaching the modal beneath it.
export function useEscapeKey(handler: (e: KeyboardEvent) => void, active = true) {
  const ref = useRef({ handler, active })
  ref.current = { handler, active }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && ref.current.active) ref.current.handler(e)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
