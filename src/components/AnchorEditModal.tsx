import { useEffect, useRef, useState } from 'react'
import type { Anchor, CandidateImage } from '../types'
import { ANCHOR_CATEGORIES } from '../types'
import { addCandidateImage, createCandidate, deleteCandidate, removeFromAnchor, deleteAnchor, updateAnchor, updateCandidate } from '../api'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { confirmDialog } from './ConfirmDialog'
import { toast } from './Toast'

interface Props {
  anchor: Anchor
  onSave: () => void
  onClose: () => void
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

export function AnchorEditModal({ anchor, onSave, onClose }: Props) {
  const [mode, setMode] = useState<'list' | 'add'>('list')
  const [label, setLabel] = useState(anchor.label)
  const [category, setCategory] = useState(anchor.category)
  const [candidates, setCandidates] = useState<CandidateImage[]>(anchor.candidates)
  const [toDelete, setToDelete] = useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [addForm, setAddForm] = useState<AddForm>(emptyAddForm)
  const [savingAdd, setSavingAdd] = useState(false)
  const inFlight = useRef(false)
  const addFileInputRef = useRef<HTMLInputElement>(null)
  const editFileInputRef = useRef<HTMLInputElement>(null)
  const [editImageTarget, setEditImageTarget] = useState<string | null>(null) // candidate id

  const anyBusy = saving || savingIds.size > 0

  // Esc: in add mode go back (with discard guard), otherwise close the modal.
  useEscapeKey(() => { if (mode === 'add') handleBack(); else onClose() })

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
    if (inFlight.current) return
    inFlight.current = true
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
      setCandidates((prev) => [...prev, {
        id: saved.id, name: saved.name, urls: saved.image_urls ?? [],
        description: saved.description ?? '',
        width: saved.width ?? '', height: saved.height ?? '',
        depth: saved.depth ?? '', price: saved.price ?? '', link: saved.link ?? '',
        sharedWith: [],
      }])
      setAddForm(emptyAddForm)
      setMode('list')
      toast.success('Candidate added')
    } finally {
      inFlight.current = false
      setSavingAdd(false)
    }
  }

  // ── Existing candidate editing ──────────────────────────────────────────────

  const toggleExpanded = (id: string) =>
    setExpandedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const updateCandidateField = (id: string, patch: Partial<CandidateImage>) =>
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))

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
    if (isShared) {
      await removeFromAnchor(anchor.id, id)
    } else {
      setToDelete((prev) => new Set(prev).add(id))
    }
    setCandidates((prev) => prev.filter((c) => c.id !== id))
  }

  const saveCandidate = async (id: string) => {
    const c = candidates.find((c) => c.id === id)
    if (!c || savingIds.has(id)) return
    setSavingIds((prev) => new Set(prev).add(id))
    try {
      await updateCandidate(id, {
        name: c.name, description: c.description || undefined,
        width: c.width || undefined, height: c.height || undefined,
        depth: c.depth || undefined, price: c.price || undefined, link: c.link || undefined,
      })
      toast.success('Candidate saved')
    } finally {
      setSavingIds((prev) => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  const handleAddImageToCandidate = async (candidateId: string, file: File) => {
    const saved = await addCandidateImage(candidateId, file)
    setCandidates((prev) => prev.map((c) =>
      c.id === candidateId ? { ...c, urls: saved.image_urls ?? [] } : c
    ))
  }

  const handleSave = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setSaving(true)
    try {
      await Promise.all([...toDelete].map((id) => deleteCandidate(id)))
      await Promise.all(
        candidates.map((c) =>
          updateCandidate(c.id, {
            name: c.name, description: c.description || undefined,
            width: c.width || undefined, height: c.height || undefined,
            depth: c.depth || undefined, price: c.price || undefined, link: c.link || undefined,
          })
        )
      )
      await updateAnchor(anchor.id, {
        label: label.trim() || anchor.label,
        category: category || undefined,
      })
      onSave()
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (inFlight.current) return
    const ok = await confirmDialog({
      title: 'Delete anchor',
      message: `Delete anchor "${anchor.label}" and all of its candidates? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    inFlight.current = true
    setSaving(true)
    try {
      await deleteAnchor(anchor.id)
      onSave()
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  const handleBackdrop = (e: React.MouseEvent) => {
    e.stopPropagation()
    // clicking outside does nothing — use Cancel/✕ to close
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
          <button className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <label className="field-label">Label</label>
          <input
            className="text-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Living Room Sofa"
          />

          <label className="field-label" style={{ marginTop: 16 }}>Category</label>
          <select className="text-input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">— None —</option>
            {ANCHOR_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <div className="candidates-section-header">
            <label className="field-label">Candidates ({candidates.length})</label>
            <button className="btn-add-candidate" onClick={() => setMode('add')}>＋</button>
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
                            placeholder="Name"
                          />
                          <button className="btn-save-candidate" onClick={() => saveCandidate(c.id)} disabled={savingIds.has(c.id)}>
                            {savingIds.has(c.id) ? '…' : 'Save'}
                          </button>
                          <button className="remove-btn" onClick={() => removeCandidate(c.id)}>✕</button>
                        </div>
                        <textarea
                          className="text-input text-area"
                          value={c.description}
                          onChange={(e) => updateCandidateField(c.id, { description: e.target.value })}
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
                                placeholder="—"
                              />
                            </div>
                          </div>
                          <input
                            className="text-input"
                            value={c.link}
                            onChange={(e) => updateCandidateField(c.id, { link: e.target.value })}
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
          <button className="btn-danger" onClick={handleDelete} disabled={anyBusy}>Delete Anchor</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={onClose} disabled={anyBusy}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={anyBusy}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
