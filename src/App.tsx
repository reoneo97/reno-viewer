import { useEffect, useRef, useState } from 'react'
import type { ApiProject } from './types'
import { mapApiAnchor } from './types' // still used for FloorPlanCanvas
import { createAnchor, getProject, listProjects, uploadFloorPlan, shareProject, downloadProject } from './api'
import { clearToken, getToken } from './api/client'
import { FloorPlanCanvas } from './components/FloorPlanCanvas'
import { ItemizedSidebar } from './components/ItemizedSidebar'
import { LoginScreen } from './components/LoginScreen'
import { ProjectSelector } from './components/ProjectSelector'
import './App.css'

type Phase = 'loading' | 'login' | 'select' | 'view'

export default function App() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [projects, setProjects] = useState<ApiProject[]>([])
  const [project, setProject] = useState<ApiProject | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // On mount: check for existing token
  useEffect(() => {
    if (!getToken()) { setPhase('login'); return }
    listProjects()
      .then((ps) => { setProjects(ps); setPhase('select') })
      .catch(() => { clearToken(); setPhase('login') })
  }, [])

  const handleLogin = () => {
    listProjects().then((ps) => { setProjects(ps); setPhase('select') })
  }

  const handleLogout = () => {
    clearToken()
    setProject(null)
    setProjects([])
    setPhase('login')
  }

  const handleSelectProject = async (p: ApiProject) => {
    try {
      const full = await getProject(p.id)
      setProject(full)
      setPhase('view')
    } catch (err) {
      console.error('Failed to load project:', err)
      alert('Failed to load project. Check the console for details.')
    }
  }

  const refreshProject = async () => {
    if (!project) return
    const updated = await getProject(project.id)
    setProject(updated)
  }

  const addAnchor = async (x: number, y: number) => {
    if (!project) return
    const anchor = await createAnchor(project.id, {
      x,
      y,
      label: `Anchor ${project.anchors.length + 1}`,
    })
    setProject((prev) => prev ? { ...prev, anchors: [...prev.anchors, anchor] } : prev)
  }

  const handleFloorPlanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !project) return
    const updated = await uploadFloorPlan(project.id, file)
    setProject(updated)
  }

  const handleExport = async () => {
    if (!project) return
    setIsExporting(true)
    try {
      await downloadProject(project.id, project.name)
    } catch (e) {
      alert(`Export failed: ${e instanceof Error ? e.message : e}`)
    } finally {
      setIsExporting(false)
    }
  }

  const handleShare = async () => {
    if (!project) return
    setIsExporting(true)
    try {
      const url = await shareProject(project.id)
      const origin = (import.meta.env.VITE_API_URL as string) || window.location.origin
      setShareUrl(`${origin}${url}`)
    } catch (e) {
      alert(`Share failed: ${e instanceof Error ? e.message : e}`)
    } finally {
      setIsExporting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return <div className="app"><div className="empty-state"><p>Loading…</p></div></div>
  }

  if (phase === 'login') {
    return <LoginScreen onLogin={handleLogin} />
  }

  if (phase === 'select') {
    return (
      <ProjectSelector
        projects={projects}
        onSelect={handleSelectProject}
        onProjectsChange={setProjects}
        onLogout={handleLogout}
      />
    )
  }

  // phase === 'view'
  const anchors = project ? project.anchors.map(mapApiAnchor) : []

  return (
    <div className="app">
      <header className="toolbar">
        <button className="app-title-btn" onClick={() => setPhase('select')}>
          ← Reno Viewer
        </button>
        {project && <span className="project-name-label">{project.name}</span>}

        <div className="toolbar-actions">
          <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
            {project?.floor_plan_url ? 'Change Floor Plan' : 'Load Floor Plan'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFloorPlanUpload}
          />

          {project?.floor_plan_url && (
            <button
              className={`btn-toggle ${isEditMode ? 'active' : ''}`}
              onClick={() => setIsEditMode((v) => !v)}
            >
              {isEditMode ? 'Editing — click to place anchor' : 'View Mode'}
            </button>
          )}

          {anchors.length > 0 && (
            <span className="anchor-count">
              {anchors.length} anchor{anchors.length !== 1 ? 's' : ''}
            </span>
          )}

          {project?.floor_plan_url && (
            <>
              <button
                className={`btn-toggle ${showSidebar ? 'active' : ''}`}
                onClick={() => setShowSidebar((v) => !v)}
              >
                ☰ List
              </button>
              <button className="btn-secondary" onClick={handleShare} disabled={isExporting}>
                {isExporting ? 'Working…' : 'Share'}
              </button>
              <button className="btn-secondary" onClick={handleExport} disabled={isExporting}>
                Export
              </button>
            </>
          )}

          <button className="btn-secondary" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      {shareUrl && (
        <div className="modal-backdrop" onClick={() => setShareUrl(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2>Share Link</h2>
              <button className="icon-btn" onClick={() => setShareUrl(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.82rem', color: '#888', marginBottom: 12 }}>
                Anyone with this link can view the floor plan — no login required.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="text-input" value={shareUrl} readOnly style={{ flex: 1 }} />
                <button
                  className="btn-primary"
                  onClick={() => { navigator.clipboard.writeText(shareUrl) }}
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="main-area">
        {!project?.floor_plan_url ? (
          <div className="empty-state">
            <div className="empty-icon">🏠</div>
            <p>Load a floor plan to get started</p>
            <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>
              Load Floor Plan
            </button>
          </div>
        ) : (
          <div className="viewer-layout">
            <FloorPlanCanvas
              floorPlanUrl={project.floor_plan_url}
              anchors={anchors}
              isEditMode={isEditMode}
              onAddAnchor={addAnchor}
              onRefresh={refreshProject}
            />
            {showSidebar && <ItemizedSidebar anchors={anchors} />}
          </div>
        )}
      </main>
    </div>
  )
}
