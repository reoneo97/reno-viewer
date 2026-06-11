import { useEffect, useState } from 'react'
import type { ApiUser } from '../types'
import { changePassword, createUser, deleteUser, listUsers } from '../api'
import { getUsername } from '../api/client'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { confirmDialog } from './ConfirmDialog'
import { toast } from './Toast'

interface Props {
  onClose: () => void
}

export function UsersModal({ onClose }: Props) {
  const me = getUsername()
  const [users, setUsers] = useState<ApiUser[]>([])
  const [loading, setLoading] = useState(true)

  // Add-user form
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [creating, setCreating] = useState(false)

  // Change-password form
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [changing, setChanging] = useState(false)

  useEscapeKey(onClose)

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUsername.trim() || newPassword.length < 4) {
      toast.error('Username required; password must be at least 4 characters')
      return
    }
    setCreating(true)
    try {
      const user = await createUser({ username: newUsername.trim(), password: newPassword })
      setUsers((prev) => [...prev, user])
      setNewUsername('')
      setNewPassword('')
      toast.success(`Added "${user.username}"`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add user')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (user: ApiUser) => {
    const ok = await confirmDialog({
      title: 'Remove user',
      message: `Remove "${user.username}"? They will no longer be able to sign in.`,
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteUser(user.id)
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
      toast.success(`Removed "${user.username}"`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove user')
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw.length < 4) {
      toast.error('New password must be at least 4 characters')
      return
    }
    setChanging(true)
    try {
      await changePassword(currentPw, newPw)
      setCurrentPw('')
      setNewPw('')
      toast.success('Password updated')
    } catch {
      toast.error('Current password is incorrect')
    } finally {
      setChanging(false)
    }
  }

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h2>Users</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {loading ? (
            <p className="view-modal-empty">Loading…</p>
          ) : (
            <div className="users-list">
              {users.map((u) => (
                <div key={u.id} className="users-list-row">
                  <span className="user-avatar">{u.username[0]?.toUpperCase()}</span>
                  <span className="users-list-name">
                    {u.username}
                    {u.username === me && <span className="users-list-you"> (you)</span>}
                  </span>
                  {u.username !== me && (
                    <button className="remove-btn" onClick={() => handleDelete(u)} title="Remove user">✕</button>
                  )}
                </div>
              ))}
            </div>
          )}

          <label className="field-label" style={{ marginTop: 18 }}>Add a user</label>
          <form className="users-add-form" onSubmit={handleCreate}>
            <input
              className="text-input"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Username"
              autoComplete="off"
            />
            <input
              className="text-input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Password"
              autoComplete="new-password"
            />
            <button className="btn-primary" type="submit" disabled={creating}>
              {creating ? '…' : 'Add'}
            </button>
          </form>

          <label className="field-label" style={{ marginTop: 18 }}>Change your password</label>
          <form className="users-add-form" onSubmit={handleChangePassword}>
            <input
              className="text-input"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              placeholder="Current password"
              autoComplete="current-password"
            />
            <input
              className="text-input"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
            />
            <button className="btn-secondary" type="submit" disabled={changing}>
              {changing ? '…' : 'Update'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
