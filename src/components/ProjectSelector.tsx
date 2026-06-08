import { useState } from 'react'
import type { ApiProject } from '../types'
import { createProject, deleteProject } from '../api'
import { ThemeToggle } from './ThemeToggle'
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
          <button className="btn-secondary" onClick={onLogout}>
            Sign out
          </button>
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
            {projects.map((p) => (
              <div key={p.id} className="project-card" onClick={() => onSelect(p)}>
                <div className="project-card-thumb">
                  {p.floor_plan_url
                    ? <img src={p.floor_plan_url} alt={p.name} />
                    : <span className="project-card-placeholder">No floor plan</span>
                  }
                </div>
                <div className="project-card-footer">
                  <span className="project-card-name">{p.name}</span>
                  <button
                    className="remove-btn"
                    onClick={(e) => handleDelete(e, p.id)}
                    title="Delete project"
                    aria-label={`Delete project ${p.name}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
