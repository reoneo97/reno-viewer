import { useState } from 'react'
import type { ApiProject, Category } from '../types'
import { addCategory, deleteCategory, renameCategory } from '../api'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { confirmDialog } from './ConfirmDialog'
import { toast } from './Toast'

interface Props {
  projectId: string
  categories: Category[]
  // How many anchors currently use each category name (for the delete warning).
  usageCounts: Record<string, number>
  onChanged: (project: ApiProject) => void
  onClose: () => void
}

const NEW_DEFAULT_COLOR = '#b5654a'

export function CategoriesModal({ projectId, categories, usageCounts, onChanged, onClose }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(NEW_DEFAULT_COLOR)
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({})

  useEscapeKey(onClose)

  const run = async (key: string, fn: () => Promise<ApiProject>) => {
    if (busy) return
    setBusy(key)
    try {
      onChanged(await fn())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update categories')
    } finally {
      setBusy(null)
    }
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    run('add', () => addCategory(projectId, name, newColor)).then(() => setNewName(''))
  }

  const commitName = (cat: Category) => {
    const draft = (nameDrafts[cat.name] ?? cat.name).trim()
    if (!draft || draft === cat.name) return
    run(cat.name, () => renameCategory(projectId, cat.name, draft, cat.color))
  }

  const recolor = (cat: Category, color: string) =>
    run(cat.name, () => renameCategory(projectId, cat.name, cat.name, color))

  const handleDelete = async (cat: Category) => {
    const used = usageCounts[cat.name] ?? 0
    const ok = await confirmDialog({
      title: 'Delete category',
      message: used > 0
        ? `${used} anchor${used !== 1 ? 's' : ''} use "${cat.name}". They'll be reassigned to "Others". Delete this category?`
        : `Delete the "${cat.name}" category?`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    run(cat.name, () => deleteCategory(projectId, cat.name))
  }

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2>Categories</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            Categories colour your pins and group the budget. Renaming one updates every
            anchor that uses it.
          </p>

          <div className="cat-list">
            {categories.map((cat) => {
              const used = usageCounts[cat.name] ?? 0
              return (
                <div key={cat.name} className="cat-row">
                  <input
                    type="color"
                    className="cat-swatch"
                    value={cat.color}
                    disabled={busy === cat.name}
                    onChange={(e) => recolor(cat, e.target.value)}
                    title="Change colour"
                  />
                  <input
                    className="text-input cat-name-input"
                    value={nameDrafts[cat.name] ?? cat.name}
                    disabled={busy === cat.name}
                    onChange={(e) => setNameDrafts((p) => ({ ...p, [cat.name]: e.target.value }))}
                    onBlur={() => commitName(cat)}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  />
                  <span className="cat-usage" title="Anchors using this category">{used || ''}</span>
                  <button
                    className="remove-btn"
                    onClick={() => handleDelete(cat)}
                    disabled={busy === cat.name}
                    title="Delete category"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>

          <form className="cat-add-form" onSubmit={handleAdd}>
            <input
              type="color"
              className="cat-swatch"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              title="Colour"
            />
            <input
              className="text-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New category name"
            />
            <button className="btn-primary" type="submit" disabled={busy === 'add' || !newName.trim()}>
              {busy === 'add' ? '…' : 'Add'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
