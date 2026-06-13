import { useState } from 'react'
import type { ApiProject } from '../types'
import { createProject, deleteProject, renameProject } from '../api'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'
import { confirmDialog } from './ConfirmDialog'
import { toast } from './Toast'

interface Props {
  projects: ApiProject[]
  onSelect: (project: ApiProject) => void
  onProjectsChange: (projects: ApiProject[]) => void
  onLogout: () => void
}

export function ProjectSelector({ projects, onSelect, onProjectsChange, onLogout }: Props) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const startRename = (e: React.MouseEvent, p: ApiProject) => {
    e.stopPropagation()
    setRenamingId(p.id)
    setRenameValue(p.name)
  }

  const commitRename = async (id: string) => {
    const name = renameValue.trim()
    setRenamingId(null)
    const current = projects.find((p) => p.id === id)
    if (!name || !current || name === current.name) return
    // optimistic
    onProjectsChange(projects.map((p) => (p.id === id ? { ...p, name } : p)))
    try {
      await renameProject(id, name)
      toast.success('Project renamed')
    } catch (err) {
      onProjectsChange(projects.map((p) => (p.id === id ? { ...p, name: current.name } : p)))
      toast.error(`Rename failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setLoading(true)
    try {
      const project = await createProject(newName.trim())
      onProjectsChange([...projects, project])
      onSelect(project)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const ok = await confirmDialog({
      title: 'Delete project',
      message: 'This will permanently delete the project and all its anchors. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteProject(id)
      onProjectsChange(projects.filter((p) => p.id !== id))
      toast.success('Project deleted')
    } catch (err) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  return (
    <div className="project-selector">
      <header className="toolbar">
        <span className="app-title">Reno Viewer</span>
        <div className="toolbar-actions">
          <button className="btn-secondary" onClick={() => setCreating(true)}>
            + New Project
          </button>
          <ThemeToggle />
          <UserMenu onLogout={onLogout} />
        </div>
      </header>

      <div className="selector-body">
        <h2 className="selector-heading">Your Projects</h2>

        {creating && (
          <form className="new-project-form" onSubmit={handleCreate}>
            <input
              className="text-input"
              placeholder="Project name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Creating…' : 'Create'}
            </button>
            <button className="btn-secondary" type="button" onClick={() => setCreating(false)}>
              Cancel
            </button>
          </form>
        )}

        {projects.length === 0 ? (
          <p className="selector-empty">No projects yet — create one to get started.</p>
        ) : (
          <div className="project-grid">
            {projects.map((p) => {
              // List responses may omit anchors; only show stats when present.
              const anchors = p.anchors ?? []
              const candidateCount = anchors.reduce((n, a) => n + (a.candidates?.length ?? 0), 0)
              const created = p.created_at
                ? new Date(p.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
                : null
              return (
                <div key={p.id} className="project-card" onClick={() => onSelect(p)}>
                  <div className="project-card-thumb">
                    {p.floor_plan_url
                      ? <img src={p.floor_plan_url} alt={p.name} loading="lazy" />
                      : <span className="project-card-placeholder">No floor plan</span>
                    }
                  </div>
                  <div className="project-card-footer">
                    <div className="project-card-text">
                      {renamingId === p.id ? (
                        <input
                          className="text-input project-rename-input"
                          value={renameValue}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => commitRename(p.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); commitRename(p.id) }
                            if (e.key === 'Escape') { e.preventDefault(); setRenamingId(null) }
                          }}
                        />
                      ) : (
                        <span
                          className="project-card-name"
                          onClick={(e) => { if (e.detail === 2) startRename(e, p) }}
                          title="Double-click to rename"
                        >
                          {p.name}
                        </span>
                      )}
                      <span className="project-card-meta">
                        {anchors.length > 0
                          ? `${anchors.length} pin${anchors.length !== 1 ? 's' : ''} · ${candidateCount} item${candidateCount !== 1 ? 's' : ''}`
                          : created ? `Created ${created}` : ' '}
                      </span>
                    </div>
                    <div className="project-card-actions">
                      <button
                        className="icon-btn project-card-action"
                        onClick={(e) => startRename(e, p)}
                        title="Rename project"
                        aria-label={`Rename project ${p.name}`}
                      >
                        ✎
                      </button>
                      <button
                        className="icon-btn project-card-action"
                        onClick={(e) => handleDelete(e, p.id)}
                        title="Delete project"
                        aria-label={`Delete project ${p.name}`}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
