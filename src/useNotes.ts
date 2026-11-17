import { useCallback, useEffect, useRef, useState } from 'react'
import type { Note } from './types'
import { api } from './api'
import { noteToSearchText } from './noteText'
import { useToast } from './components/toastContext'

const LEGACY_KEY = 'notekeeper.notes.v1'

function readLegacy(): Note[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    return raw ? (JSON.parse(raw) as Note[]) : []
  } catch {
    return []
  }
}

function clearLegacy() {
  try {
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    return
  }
}

async function fetchWithMigration() {
  const remote = await api.list()
  const legacy = readLegacy()
  if (remote.length > 0 || legacy.length === 0) return { notes: remote, migrated: 0 }
  await api.saveMany(legacy)
  clearLegacy()
  return { notes: await api.list(), migrated: legacy.length }
}

export type LoadState = 'loading' | 'ready' | 'error'

export function useNotes() {
  const toast = useToast()
  const [notes, setNotes] = useState<Note[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const notesRef = useRef<Note[]>([])

  const commit = useCallback((next: Note[]) => {
    notesRef.current = next
    setNotes(next)
  }, [])

  const load = useCallback(
    () =>
      fetchWithMigration().then(
        ({ notes: remote, migrated }) => {
          commit(remote)
          setStatus('ready')
          if (migrated) toast(`${migrated} notes moved from the browser to Supabase`)
        },
        () => setStatus('error'),
      ),
    [commit, toast],
  )

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') api.list().then(commit, () => {})
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [commit])

  const reload = useCallback(() => {
    setStatus('loading')
    load()
  }, [load])

  const fail = useCallback(
    (error: unknown) => {
      toast(error instanceof Error ? `Not saved: ${error.message}` : 'The change was not saved')
      api.list().then(commit, () => {})
    },
    [commit, toast],
  )

  const update = useCallback(
    (id: string, patch: Partial<Note>) => {
      const current = notesRef.current.find((n) => n.id === id)
      if (!current) return
      const next = { ...current, ...patch, updatedAt: new Date().toISOString() }
      commit(notesRef.current.map((n) => (n.id === id ? next : n)))
      api.save(next).catch(fail)
    },
    [commit, fail],
  )

  const add = useCallback(
    (note: Note) => {
      commit([note, ...notesRef.current])
      api.save(note).catch(fail)
    },
    [commit, fail],
  )

  const addMany = useCallback(
    (incoming: Note[]) => {
      const keyOf = (n: Note) => n.title.trim().toLowerCase() || noteToSearchText(n)
      const ids = new Set(notesRef.current.map((n) => n.id))
      const keys = new Set(notesRef.current.map(keyOf))
      const fresh: Note[] = []
      for (const n of incoming) {
        const key = keyOf(n)
        if (ids.has(n.id) || keys.has(key)) continue
        ids.add(n.id)
        keys.add(key)
        fresh.push(n)
      }
      if (!fresh.length) return 0
      commit([...fresh, ...notesRef.current])
      api.saveMany(fresh).catch(fail)
      return fresh.length
    },
    [commit, fail],
  )

  const remove = useCallback(
    (id: string) => {
      commit(notesRef.current.filter((n) => n.id !== id))
      api.remove(id).catch(fail)
    },
    [commit, fail],
  )

  const emptyTrash = useCallback(() => {
    commit(notesRef.current.filter((n) => !n.trashed))
    api.emptyTrash().catch(fail)
  }, [commit, fail])

  return { notes, status, reload, update, add, addMany, remove, emptyTrash }
}
