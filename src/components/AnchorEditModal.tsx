import { useEffect, useRef, useState } from 'react'
import type { Anchor, CandidateImage, CandidateStatus } from '../types'
import { ANCHOR_CATEGORIES, formatDims, mapApiCandidate } from '../types'
import { addCandidateImage, createCandidate, deleteCandidate, removeFromAnchor, deleteAnchor, updateAnchor, updateCandidate, duplicateAnchor, listAvailableCandidates, linkCandidate, setCandidateStatus as apiSetCandidateStatus } from '../api'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { confirmDialog } from './ConfirmDialog'
import { toast } from './Toast'
import { StatusPicker } from './StatusBadge'

interface Props {
  anchor: Anchor
  // Called whenever the modal closes; edits autosave, so the parent should
  // refresh and unmount. There is no separate "cancel" path.
  onSave: () => void
}

interface PendingImage {
  file: File
  previewUrl: string
}

interface AddForm {
  images: PendingImage[]
  name: string
  description: string
  width: string
  height: string
  depth: string
  price: string
  link: string
}

const emptyAddForm: AddForm = {
  images: [], name: '', description: '',
  width: '', height: '', depth: '', price: '', link: '',
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

// Edits autosave on blur (and on discrete actions like status changes), so
// there is no Cancel/Save pair — just Done. The footer reports save state.
export function AnchorEditModal({ anchor, onSave }: Props) {
  const [mode, setMode] = useState<'list' | 'add' | 'pick'>('list')
  const [label, setLabel] = useState(anchor.label)
  const [category, setCategory] = useState(anchor.category)
  const [notes, setNotes] = useState(anchor.notes)
  const [candidates, setCandidates] = useState<CandidateImage[]>(anchor.candidates)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [closing, setClosing] = useState(false)
  const [addForm, setAddForm] = useState<AddForm>(emptyAddForm)
  const [savingAdd, setSavingAdd] = useState(false)
  const inflight = useRef<Set<Promise<unknown>>>(new Set())
  const addFileInputRef = useRef<HTMLInputElement>(null)
  const editFileInputRef = useRef<HTMLInputElement>(null)
  const [editImageTarget, setEditImageTarget] = useState<string | null>(null) // candidate id

  // Reuse picker state
  const [available, setAvailable] = useState<CandidateImage[]>([])
  const [loadingAvailable, setLoadingAvailable] = useState(false)
  const [pickSearch, setPickSearch] = useState('')
  const [linkingId, setLinkingId] = useState<string | null>(null)

  // Track a save request: footer indicator reflects whether anything is
  // still in flight, and Done awaits the whole set before refreshing.
  const track = <T,>(p: Promise<T>): Promise<T> => {
    inflight.current.add(p)
    setSaveState('saving')
    p.then(
      () => { if (inflight.current.size === 1) setSaveState('saved') },
      () => { setSaveState('error'); toast.error('Failed to save changes') },
    ).finally(() => inflight.current.delete(p))
    return p
  }

  // ── Autosave: anchor fields ─────────────────────────────────────────────────

  const saveAnchorFields = (patch?: { category?: string }) =>
    track(updateAnchor(anchor.id, {
      label: label.trim() || anchor.label,
      category: (patch?.category ?? category) || undefined,
      notes: notes.trim() || undefined,
    }))

  // ── Autosave: candidate fields ──────────────────────────────────────────────

  const updateCandidateField = (id: string, patch: Partial<CandidateImage>) =>
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  const saveCandidate = (c: CandidateImage) =>
    track(updateCandidate(c.id, {
      name: c.name, description: c.description || undefined,
      width: c.width || undefined, height: c.height || undefined,
      depth: c.depth || undefined, price: c.price || undefined,
      link: c.link || undefined,
    }))

  const saveCandidateById = (id: string) => {
    const c = candidates.find((c) => c.id === id)
    if (c) void saveCandidate(c)
  }

  // Status is per anchor↔candidate link (a shared candidate can be chosen
  // here and rejected elsewhere), so it saves via its own endpoint.
  const setCandidateStatus = (id: string, status: CandidateStatus) => {
    setCandidates((prev) => prev.map((c) => {
      if (c.id === id) return { ...c, status }
      // 'chosen' is radio-style; mirror the server-side clear locally.
      if (status === 'chosen' && c.status === 'chosen') return { ...c, status: '' as CandidateStatus }
      return c
    }))
    void track(apiSetCandidateStatus(anchor.id, id, status))
  }

  // ── Done / close ────────────────────────────────────────────────────────────

  const handleDone = async () => {
    if (closing) return
    setClosing(true)
    try {
      // Final anchor-field save catches edits in the still-focused input,
      // then wait out any candidate PATCHes started by the blur just now.
      await saveAnchorFields().catch(() => { /* toasted by track() */ })
      await Promise.allSettled([...inflight.current])
      onSave()
    } finally {
      setClosing(false)
    }
  }

  // Esc: in a sub-view go back (with discard guard for add), otherwise finish up.
  useEscapeKey(() => {
    if (mode === 'add') void handleBack()
    else if (mode === 'pick') setMode('list')
    else void handleDone()
  })

  // ── Reuse an existing candidate ─────────────────────────────────────────────

  const openPicker = async () => {
    setMode('pick')
    setPickSearch('')
    setLoadingAvailable(true)
    try {
      const items = await listAvailableCandidates(anchor.id)
      setAvailable(items.map((c) => mapApiCandidate(c, anchor.id)))
    } catch {
      toast.error('Failed to load existing candidates')
    } finally {
      setLoadingAvailable(false)
    }
  }

  const handleLink = async (c: CandidateImage) => {
    if (linkingId) return
    setLinkingId(c.id)
    try {
      const saved = await linkCandidate(anchor.id, c.id)
      setCandidates((prev) => [...prev, mapApiCandidate(saved, anchor.id)])
      setAvailable((prev) => prev.filter((a) => a.id !== c.id))
      toast.success(`Linked "${saved.name}"`)
    } catch {
      toast.error('Failed to link candidate')
    } finally {
      setLinkingId(null)
    }
  }

  const setAddField = (patch: Partial<AddForm>) =>
    setAddForm((prev) => ({ ...prev, ...patch }))

  const addImagesToForm = (files: File[]) => {
    const newImages = files
      .filter((f) => f.type.startsWith('image/'))
      .map((f) => ({ file: f, previewUrl: URL.createObjectURL(f) }))
    setAddForm((prev) => {
      const name = prev.name || (files[0]?.name === 'image.png'
        ? `Pasted ${new Date().toLocaleTimeString()}`
        : files[0]?.name.replace(/\.[^/.]+$/, '') ?? '')
      return { ...prev, images: [...prev.images, ...newImages], name: prev.name || name }
    })
  }

  const removeFormImage = (index: number) => {
    setAddForm((prev) => {
      URL.revokeObjectURL(prev.images[index].previewUrl)
      return { ...prev, images: prev.images.filter((_, i) => i !== index) }
    })
  }

  // Paste → enter add mode with image appended
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.items ?? [])
        .find((item) => item.type.startsWith('image/'))
        ?.getAsFile()
      if (!file) return
      if (mode === 'list') setMode('add')
      addImagesToForm([file])
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [mode])

  const handleBack = async () => {
    const isDirty = addForm.images.length > 0 || addForm.name || addForm.description ||
      addForm.width || addForm.height || addForm.depth || addForm.price || addForm.link
    if (isDirty) {
      const ok = await confirmDialog({
        title: 'Discard candidate?',
        message: 'This candidate hasn’t been saved. Your changes will be lost.',
        confirmLabel: 'Discard',
        danger: true,
      })
      if (!ok) return
    }
    addForm.images.forEach((img) => URL.revokeObjectURL(img.previewUrl))
    setAddForm(emptyAddForm)
    setMode('list')
  }

  const handleSaveCandidate = async () => {
    if (addForm.images.length === 0) {
      toast.error('Please add at least one image.')
      return
    }
    if (savingAdd) return
    setSavingAdd(true)
    try {
      const saved = await createCandidate(anchor.id, addForm.images.map((i) => i.file), {
        name: addForm.name || 'Untitled',
        description: addForm.description,
        width: addForm.width,
        height: addForm.height,
        depth: addForm.depth,
        price: addForm.price,
        link: addForm.link,
      })
      addForm.images.forEach((img) => URL.revokeObjectURL(img.previewUrl))
      setCandidates((prev) => [...prev, mapApiCandidate(saved, anchor.id)])
      setAddForm(emptyAddForm)
      setMode('list')
      toast.success('Candidate added')
    } finally {
      setSavingAdd(false)
    }
  }

  // ── Candidate removal (immediate, with confirm) ─────────────────────────────

  const toggleExpanded = (id: string) =>
    setExpandedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const removeCandidate = async (id: string) => {
    const c = candidates.find((c) => c.id === id)
    if (!c) return
    const isShared = c.sharedWith.length > 0
    const ok = await confirmDialog(isShared
      ? {
          title: 'Remove from anchor',
          message: `Remove "${c.name}" from this anchor? It will stay in: ${c.sharedWith.map((a) => a.label).join(', ')}.`,
          confirmLabel: 'Remove',
        }
      : {
          title: 'Delete candidate',
          message: `Delete "${c.name}"? This cannot be undone.`,
          confirmLabel: 'Delete',
          danger: true,
        })
    if (!ok) return
    try {
      await track(isShared ? removeFromAnchor(anchor.id, id) : deleteCandidate(id))
      setCandidates((prev) => prev.filter((c) => c.id !== id))
    } catch { /* error toast handled by track() */ }
  }

  const handleAddImageToCandidate = async (candidateId: string, file: File) => {
    try {
      const saved = await track(addCandidateImage(candidateId, file))
      setCandidates((prev) => prev.map((c) =>
        c.id === candidateId ? { ...c, urls: saved.image_urls ?? [] } : c
      ))
    } catch { /* error toast handled by track() */ }
  }

  const handleDelete = async () => {
    const ok = await confirmDialog({
      title: 'Delete anchor',
      message: `Delete anchor "${anchor.label}" and all of its candidates? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    setClosing(true)
    try {
      await deleteAnchor(anchor.id)
      onSave()
    } finally {
      setClosing(false)
    }
  }

  const handleDuplicate = async () => {
    if (closing) return
    setClosing(true)
    try {
      await duplicateAnchor(anchor.id)
      toast.success(`Duplicated "${anchor.label}"`)
      onSave()
    } catch {
      toast.error('Failed to duplicate anchor')
      setClosing(false)
    }
  }

  const handleBackdrop = (e: React.MouseEvent) => {
    e.stopPropagation()
    // clicking outside does nothing — use Done/✕ to close
  }

  // ── Reuse existing candidate view ───────────────────────────────────────────

  if (mode === 'pick') {
    const q = pickSearch.trim().toLowerCase()
    const filtered = q
      ? available.filter((c) =>
          c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
      : available
    return (
      <div className="modal-backdrop" onClick={handleBackdrop}>
        <div className="modal">
          <div className="modal-header">
            <button className="btn-back" onClick={() => setMode('list')}>← Back</button>
            <h2>Reuse Candidate</h2>
          </div>

          <div className="modal-body">
            <input
              className="text-input"
              value={pickSearch}
              onChange={(e) => setPickSearch(e.target.value)}
              placeholder="Search candidates in this project…"
              autoFocus
            />

            {loadingAvailable ? (
              <p className="view-modal-empty" style={{ marginTop: 16 }}>Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="view-modal-empty" style={{ marginTop: 16 }}>
                {available.length === 0 ? 'No other candidates in this project to reuse.' : 'No matches.'}
              </p>
            ) : (
              <div className="candidate-list" style={{ marginTop: 12 }}>
                {filtered.map((c) => {
                  const dims = formatDims(c.width, c.height, c.depth)
                  const summary = [dims, c.price ? `$${c.price}` : ''].filter(Boolean).join(' · ') || 'No details'
                  return (
                    <div key={c.id} className="pick-candidate-row">
                      {c.urls[0]
                        ? <img src={c.urls[0]} alt={c.name} className="candidate-collapsed-thumb" />
                        : <div className="candidate-collapsed-thumb" style={{ background: 'var(--surface-3)' }} />
                      }
                      <div className="candidate-collapsed-info">
                        <span className="candidate-collapsed-name">{c.name || 'Untitled'}</span>
                        <span className="candidate-collapsed-meta">{summary}</span>
                        {c.sharedWith.length > 0 && (
                          <span className="candidate-collapsed-desc">In: {c.sharedWith.map((a) => a.label).join(', ')}</span>
                        )}
                      </div>
                      <button
                        className="btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '5px 12px' }}
                        onClick={() => handleLink(c)}
                        disabled={linkingId === c.id}
                      >
                        {linkingId === c.id ? '…' : '+ Link'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
            <button className="btn-primary" onClick={() => setMode('list')}>Done</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Add candidate view ──────────────────────────────────────────────────────

  if (mode === 'add') {
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
    return (
      <div className="modal-backdrop" onClick={handleBackdrop}>
        <div className="modal">
          <div className="modal-header">
            <button className="btn-back" onClick={() => { void handleBack() }} disabled={savingAdd}>← Back</button>
            <h2>Add Candidate</h2>
          </div>

          <div className="modal-body">
            {/* Image strip / drop zone */}
            <div
              className={`add-image-area ${addForm.images.length > 0 ? 'has-image' : ''}`}
              onClick={() => addForm.images.length === 0 && addFileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                addImagesToForm(Array.from(e.dataTransfer.files))
              }}
            >
              {addForm.images.length > 0 ? (
                <div className="add-image-strip">
                  {addForm.images.map((img, i) => (
                    <div key={i} className="add-image-thumb-wrap">
                      <img src={img.previewUrl} alt="" className="add-image-thumb" />
                      <button
                        className="add-image-thumb-remove"
                        onClick={(e) => { e.stopPropagation(); removeFormImage(i) }}
                      >✕</button>
                    </div>
                  ))}
                  <button
                    className="add-image-thumb-add"
                    onClick={(e) => { e.stopPropagation(); addFileInputRef.current?.click() }}
                  >＋</button>
                </div>
              ) : (
                <div className="add-image-placeholder">
                  <span className="add-image-icon">🖼</span>
                  <span>Drag or click to upload</span>
                  <span className="add-image-shortcut">or press {isMac ? '⌘V' : 'Ctrl+V'}</span>
                  <button
                    className="btn-paste-clipboard"
                    onClick={async (e) => {
                      e.stopPropagation()
                      try {
                        const items = await navigator.clipboard.read()
                        for (const item of items) {
                          const type = item.types.find((t) => t.startsWith('image/'))
                          if (type) {
                            const blob = await item.getType(type)
                            addImagesToForm([new File([blob], 'pasted.png', { type })])
                            break
                          }
                        }
                      } catch { /* keyboard shortcut still works */ }
                    }}
                  >
                    Paste from clipboard
                  </button>
                </div>
              )}
              <input
                ref={addFileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => { if (e.target.files) addImagesToForm(Array.from(e.target.files)) }}
              />
            </div>

            <label className="field-label" style={{ marginTop: 14 }}>Name</label>
            <input
              className="text-input"
              value={addForm.name}
              onChange={(e) => setAddField({ name: e.target.value })}
              placeholder="e.g. Herman Miller Aeron"
              autoFocus
            />

            <label className="field-label" style={{ marginTop: 12 }}>Description</label>
            <textarea
              className="text-input text-area"
              value={addForm.description}
              onChange={(e) => setAddField({ description: e.target.value })}
              placeholder="Notes, material, colour, finish…"
              rows={3}
            />

            <label className="field-label" style={{ marginTop: 12 }}>Dimensions &amp; Price</label>
            <div className="dim-row">
              {(['width', 'height', 'depth'] as const).map((dim) => (
                <div key={dim} className="dim-field">
                  <span className="dim-label">{dim[0].toUpperCase()}</span>
                  <input
                    className="text-input dim-input"
                    value={addForm[dim]}
                    onChange={(e) => setAddField({ [dim]: e.target.value })}
                    placeholder="—"
                  />
                </div>
              ))}
              <div className="price-field">
                <span className="dim-label">$</span>
                <input
                  className="text-input dim-input"
                  value={addForm.price}
                  onChange={(e) => setAddField({ price: e.target.value })}
                  placeholder="—"
                />
              </div>
            </div>

            <label className="field-label" style={{ marginTop: 12 }}>Link</label>
            <input
              className="text-input"
              value={addForm.link}
              onChange={(e) => setAddField({ link: e.target.value })}
              placeholder="https://…"
            />
          </div>

          <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
            <button className="btn-primary" onClick={handleSaveCandidate} disabled={savingAdd}>
              {savingAdd ? 'Saving…' : 'Save Candidate'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── List view ───────────────────────────────────────────────────────────────

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal">
        <div className="modal-header">
          <h2>Edit Anchor</h2>
          <button className="icon-btn" aria-label="Close" onClick={() => { void handleDone() }}>✕</button>
        </div>

        <div className="modal-body">
          <label className="field-label">Label</label>
          <input
            className="text-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => { void saveAnchorFields() }}
            placeholder="e.g. Living Room Sofa"
          />

          <label className="field-label" style={{ marginTop: 16 }}>Category</label>
          <select
            className="text-input"
            value={category}
            onChange={(e) => { setCategory(e.target.value); void saveAnchorFields({ category: e.target.value }) }}
          >
            <option value="">— None —</option>
            {ANCHOR_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <label className="field-label" style={{ marginTop: 16 }}>Notes</label>
          <textarea
            className="text-input text-area"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => { void saveAnchorFields() }}
            placeholder="Constraints, measurements, reminders…"
            rows={2}
          />

          <div className="candidates-section-header">
            <label className="field-label">Candidates ({candidates.length})</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn-reuse-candidate" onClick={openPicker} title="Reuse a candidate from elsewhere in this project">
                ⟳ Reuse
              </button>
              <button className="btn-add-candidate" onClick={() => setMode('add')} title="Add a new candidate">＋</button>
            </div>
          </div>

          <div
            className="candidate-drop-zone"
            onClick={() => setMode('add')}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
              if (files.length > 0) { addImagesToForm(files); setMode('add') }
            }}
          >
            <span className="candidate-drop-icon">🖼</span>
            <span>Drag, click or {/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘V' : 'Ctrl+V'} to add a candidate</span>
          </div>

          {candidates.length > 0 && (
            <div className="candidate-list">
              {candidates.map((c) => {
                const isExpanded = expandedIds.has(c.id)
                const dims = [c.width, c.height, c.depth].filter(Boolean).join(' × ')
                const summary = [dims, c.price ? `$${c.price}` : ''].filter(Boolean).join(' · ') || 'No details'
                return (
                  <div key={c.id} className={`candidate-list-item ${isExpanded ? 'expanded' : ''}`}>
                    <div className="candidate-collapsed-row" onClick={() => toggleExpanded(c.id)}>
                      {c.urls[0]
                        ? <img src={c.urls[0]} alt={c.name} className="candidate-collapsed-thumb" />
                        : <div className="candidate-collapsed-thumb" style={{ background: 'var(--surface-3)' }} />
                      }
                      <div className="candidate-collapsed-info">
                        <span className="candidate-collapsed-name">{c.name || <em style={{ color: 'var(--text-faint)' }}>Untitled</em>}</span>
                        <span className="candidate-collapsed-meta">{summary}</span>
                        {c.description && <span className="candidate-collapsed-desc">{c.description}</span>}
                      </div>
                      <span className="candidate-expand-icon">{isExpanded ? '▲' : '▼'}</span>
                    </div>

                    {isExpanded && (
                      <div className="candidate-expanded-fields" onClick={(e) => e.stopPropagation()}>
                        {c.sharedWith.length > 0 && (
                          <div className="candidate-shared-warning">
                            Also in: {c.sharedWith.map((a) => a.label).join(', ')}
                          </div>
                        )}
                        {/* Images row */}
                        <div className="candidate-images-row">
                          {c.urls.map((url, i) => (
                            <div key={i} className="candidate-img-thumb-wrap">
                              <img src={url} alt="" className="candidate-img-thumb" />
                            </div>
                          ))}
                          <button
                            className="candidate-img-add-btn"
                            title="Add image"
                            onClick={() => {
                              setEditImageTarget(c.id)
                              editFileInputRef.current?.click()
                            }}
                          >＋</button>
                        </div>

                        <div className="candidate-item-top" style={{ paddingTop: 0 }}>
                          <input
                            className="text-input candidate-name-input"
                            value={c.name}
                            onChange={(e) => updateCandidateField(c.id, { name: e.target.value })}
                            onBlur={() => saveCandidateById(c.id)}
                            placeholder="Name"
                          />
                          <button className="remove-btn" onClick={() => removeCandidate(c.id)}>✕</button>
                        </div>
                        <StatusPicker status={c.status} onChange={(s) => setCandidateStatus(c.id, s)} />
                        <textarea
                          className="text-input text-area"
                          value={c.description}
                          onChange={(e) => updateCandidateField(c.id, { description: e.target.value })}
                          onBlur={() => saveCandidateById(c.id)}
                          placeholder="Description…"
                          rows={2}
                          style={{ marginTop: 6 }}
                        />
                        <div className="candidate-item-fields">
                          <div className="dim-row">
                            {(['width', 'height', 'depth'] as const).map((dim) => (
                              <div key={dim} className="dim-field">
                                <span className="dim-label">{dim[0].toUpperCase()}</span>
                                <input
                                  className="text-input dim-input"
                                  value={c[dim]}
                                  onChange={(e) => updateCandidateField(c.id, { [dim]: e.target.value })}
                                  onBlur={() => saveCandidateById(c.id)}
                                  placeholder="—"
                                />
                              </div>
                            ))}
                            <div className="price-field">
                              <span className="dim-label">$</span>
                              <input
                                className="text-input dim-input"
                                value={c.price}
                                onChange={(e) => updateCandidateField(c.id, { price: e.target.value })}
                                onBlur={() => saveCandidateById(c.id)}
                                placeholder="—"
                              />
                            </div>
                          </div>
                          <input
                            className="text-input"
                            value={c.link}
                            onChange={(e) => updateCandidateField(c.id, { link: e.target.value })}
                            onBlur={() => saveCandidateById(c.id)}
                            placeholder="https://…"
                            style={{ marginTop: 6 }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Hidden file input for adding images to existing candidates */}
          <input
            ref={editFileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (file && editImageTarget) {
                await handleAddImageToCandidate(editImageTarget, file)
                setEditImageTarget(null)
              }
              e.target.value = ''
            }}
          />
        </div>

        <div className="modal-footer">
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-danger" onClick={handleDelete} disabled={closing}>Delete</button>
            <button className="btn-secondary" onClick={handleDuplicate} disabled={closing} title="Duplicate this anchor">Duplicate</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className={`save-indicator save-indicator-${saveState}`} role="status">
              {saveState === 'saving' && <><span className="spinner spinner-sm" /> Saving…</>}
              {saveState === 'saved' && 'All changes saved ✓'}
              {saveState === 'error' && 'Some changes failed to save'}
            </span>
            <button className="btn-primary" onClick={() => { void handleDone() }} disabled={closing}>
              {closing ? 'Closing…' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
