const BASE = (import.meta.env.VITE_API_URL as string) ?? ''

export function getToken(): string | null {
  return localStorage.getItem('token')
}

export function setToken(token: string): void {
  localStorage.setItem('token', token)
}

export function clearToken(): void {
  localStorage.removeItem('token')
}

async function request(method: string, path: string, body?: unknown, isForm = false) {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isForm ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    clearToken()
    window.location.reload()
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error(detail?.detail ?? `API error ${res.status}`)
  }

  if (res.status === 204) return null
  return res.json()
}

export const http = {
  get:    (path: string)                      => request('GET',    path),
  post:   (path: string, body: unknown)       => request('POST',   path, body),
  patch:  (path: string, body: unknown)       => request('PATCH',  path, body),
  delete: (path: string)                      => request('DELETE', path),
  upload: (path: string, form: FormData)      => request('POST',   path, form, true),
}
