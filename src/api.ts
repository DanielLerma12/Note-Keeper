import type { Note, SessionInfo } from './types'

export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// Fired when the server says the session is gone (expired, signed out elsewhere,
// or the time-limited session ran out), so the app can go back to the sign-in screen.
export const SESSION_LOST = 'notekeeper:session-lost'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && path.startsWith('/notes')) window.dispatchEvent(new Event(SESSION_LOST))
    throw new ApiError((data as { error?: string }).error ?? `Error ${res.status}`, res.status)
  }
  return data as T
}

export const api = {
  me: () => request<SessionInfo>('/auth/me'),
  signIn: (identifier: string, password: string) =>
    request<SessionInfo>('/auth/signin', { method: 'POST', body: JSON.stringify({ identifier, password }) }),
  signOut: () => request<{ ok: true }>('/auth/signout', { method: 'POST', body: '{}' }),

  list: () => request<Note[]>('/notes'),
  save: (note: Note) => request<{ ok: true }>(`/notes/${note.id}`, { method: 'PUT', body: JSON.stringify(note) }),
  saveMany: (notes: Note[]) => request<{ ok: true }>('/notes/bulk', { method: 'POST', body: JSON.stringify(notes) }),
  remove: (id: string) => request<{ ok: true }>(`/notes/${id}`, { method: 'DELETE' }),
  emptyTrash: () => request<{ ok: true }>('/notes/trash', { method: 'DELETE' }),
}
