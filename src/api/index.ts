import { http, getToken } from './client'
import type { ApiAnchor, ApiCandidate, ApiProject, ApiUser } from '../types'

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(username: string, password: string): Promise<{ token: string; username: string }> {
  const data = await http.post('/auth/login', { username, password })
  return { token: data.access_token, username: data.username ?? username }
}

// ── Users ─────────────────────────────────────────────────────────────────────

export function listUsers(): Promise<ApiUser[]> {
  return http.get('/users')
}

export function createUser(data: { username: string; password: string; display_name?: string }): Promise<ApiUser> {
  return http.post('/users', data)
}

export function deleteUser(userId: string): Promise<null> {
  return http.delete(`/users/${userId}`)
}

export function changePassword(currentPassword: string, newPassword: string): Promise<null> {
  return http.post('/users/me/password', { current_password: currentPassword, new_password: newPassword })
}

// ── Projects ──────────────────────────────────────────────────────────────────

export function listProjects(): Promise<ApiProject[]> {
  return http.get('/projects')
}

export function getProject(id: string): Promise<ApiProject> {
  return http.get(`/projects/${id}`)
}

export function createProject(name: string): Promise<ApiProject> {
  return http.post('/projects', { name })
}

export function renameProject(id: string, name: string): Promise<ApiProject> {
  return http.patch(`/projects/${id}`, { name })
}

export function deleteProject(id: string): Promise<null> {
  return http.delete(`/projects/${id}`)
}

export function uploadFloorPlan(projectId: string, file: File): Promise<ApiProject> {
  const form = new FormData()
  form.append('file', file)
  return http.upload(`/projects/${projectId}/floor-plan`, form)
}

// ── Anchors ───────────────────────────────────────────────────────────────────

export function createAnchor(
  projectId: string,
  data: { x: number; y: number; label: string; category?: string },
): Promise<ApiAnchor> {
  return http.post(`/projects/${projectId}/anchors`, data)
}

export function updateAnchor(
  anchorId: string,
  data: { label?: string; category?: string; notes?: string; x?: number; y?: number },
): Promise<ApiAnchor> {
  return http.patch(`/anchors/${anchorId}`, data)
}

export function duplicateAnchor(anchorId: string): Promise<ApiAnchor> {
  return http.post(`/anchors/${anchorId}/duplicate`, {})
}

export function deleteAnchor(anchorId: string): Promise<null> {
  return http.delete(`/anchors/${anchorId}`)
}

// ── Snapshots ─────────────────────────────────────────────────────────────────

export async function shareProject(projectId: string): Promise<string> {
  const data = await http.post(`/projects/${projectId}/snapshot`, {})
  return data.url as string
}

export async function downloadProject(projectId: string, projectName: string): Promise<void> {
  const token = getToken()
  const base = (import.meta.env.VITE_API_URL as string) ?? ''
  const res = await fetch(`${base}/projects/${projectId}/snapshot/download`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Download failed')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${projectName}.html`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// ── Candidates ────────────────────────────────────────────────────────────────

export function createCandidate(
  anchorId: string,
  files: File[],
  meta: { name: string; description: string; width: string; height: string; depth: string; price: string; link: string },
): Promise<ApiCandidate> {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  form.append('name', meta.name)
  form.append('description', meta.description)
  form.append('width', meta.width)
  form.append('height', meta.height)
  form.append('depth', meta.depth)
  form.append('price', meta.price)
  form.append('link', meta.link)
  return http.upload(`/anchors/${anchorId}/candidates`, form)
}

export function addCandidateImage(candidateId: string, file: File): Promise<ApiCandidate> {
  const form = new FormData()
  form.append('file', file)
  return http.upload(`/candidates/${candidateId}/images`, form)
}

export function deleteCandidateImage(photoId: string): Promise<null> {
  return http.delete(`/candidate-images/${photoId}`)
}

export function updateCandidate(
  candidateId: string,
  data: { name?: string; description?: string; width?: string; height?: string; depth?: string; price?: string; link?: string },
): Promise<ApiCandidate> {
  return http.patch(`/candidates/${candidateId}`, data)
}

export function removeFromAnchor(anchorId: string, candidateId: string): Promise<null> {
  return http.delete(`/anchors/${anchorId}/candidates/${candidateId}`)
}

// ── Candidate reuse + decision status ───────────────────────────────────────────

export function listAvailableCandidates(anchorId: string): Promise<ApiCandidate[]> {
  return http.get(`/anchors/${anchorId}/available-candidates`)
}

export function linkCandidate(anchorId: string, candidateId: string): Promise<ApiCandidate> {
  return http.post(`/anchors/${anchorId}/candidates/${candidateId}`, {})
}

// Status lives on the anchor↔candidate link ('' | shortlisted | chosen | rejected);
// setting 'chosen' clears any other chosen candidate on the same anchor.
export function setCandidateStatus(
  anchorId: string,
  candidateId: string,
  status: string,
): Promise<ApiCandidate> {
  return http.patch(`/anchors/${anchorId}/candidates/${candidateId}/status`, { status })
}

export function deleteCandidate(candidateId: string): Promise<null> {
  return http.delete(`/candidates/${candidateId}`)
}
