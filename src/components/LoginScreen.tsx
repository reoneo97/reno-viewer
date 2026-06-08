import { useState } from 'react'
import { login } from '../api'
import { setToken } from '../api/client'
import { ThemeToggle } from './ThemeToggle'

interface Props {
  onLogin: () => void
}

export function LoginScreen({ onLogin }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const token = await login(username, password)
      setToken(token)
      onLogin()
    } catch {
      setError('Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-theme-toggle">
        <ThemeToggle />
      </div>
      <div className="login-card">
        <h1 className="login-title">Reno Viewer</h1>
        <p className="login-subtitle">Sign in to continue</p>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label className="field-label">Username</label>
            <input
              className="text-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className="login-field">
            <label className="field-label">Password</label>
            <input
              className="text-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <p className="login-error">{error}</p>}
          <button className="btn-primary login-submit" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
