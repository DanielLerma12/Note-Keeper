import type { Note } from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Error ${res.status}`)
  return data as T
}

export const api = {
  list: () => request<Note[]>('/notes'),
  save: (note: Note) => request<{ ok: true }>(`/notes/${note.id}`, { method: 'PUT', body: JSON.stringify(note) }),
  saveMany: (notes: Note[]) => request<{ ok: true }>('/notes/bulk', { method: 'POST', body: JSON.stringify(notes) }),
  remove: (id: string) => request<{ ok: true }>(`/notes/${id}`, { method: 'DELETE' }),
  emptyTrash: () => request<{ ok: true }>('/notes/trash', { method: 'DELETE' }),
}
