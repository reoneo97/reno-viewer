import { useEffect, useState } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
  leaving?: boolean
}

let counter = 0
let items: ToastItem[] = []
const listeners = new Set<(items: ToastItem[]) => void>()

const emit = () => listeners.forEach((l) => l(items))

function remove(id: number) {
  items = items.map((t) => (t.id === id ? { ...t, leaving: true } : t))
  emit()
  setTimeout(() => {
    items = items.filter((t) => t.id !== id)
    emit()
  }, 180)
}

function push(kind: ToastKind, message: string, duration: number) {
  const id = ++counter
  items = [...items, { id, kind, message }]
  emit()
  if (duration > 0) setTimeout(() => remove(id), duration)
  return id
}

export const toast = {
  success: (message: string) => push('success', message, 4000),
  error: (message: string) => push('error', message, 6000),
  info: (message: string) => push('info', message, 4000),
}

const ICONS: Record<ToastKind, string> = { success: '✓', error: '✕', info: 'ℹ' }

export function ToastHost() {
  const [list, setList] = useState<ToastItem[]>(items)
  useEffect(() => {
    listeners.add(setList)
    return () => { listeners.delete(setList) }
  }, [])

  if (list.length === 0) return null
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast ${t.kind} ${t.leaving ? 'leaving' : ''}`}>
          <span className="toast-bar" />
          <span className="toast-icon">{ICONS[t.kind]}</span>
          <span className="toast-msg">{t.message}</span>
          <button className="toast-close" aria-label="Dismiss notification" onClick={() => remove(t.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
