import type { Block, Note, NoteColor } from './types'
import { parseNoteText, uid } from './noteText'

export const IMPORT_ACCEPT = '.txt,.md,.markdown,.json,text/plain,text/markdown,application/json'

const COLORS: NoteColor[] = ['default', 'coral', 'peach', 'sand', 'amber', 'olive', 'pine', 'mint', 'sage', 'fog', 'storm', 'indigo', 'violet', 'dusk', 'blossom', 'berry', 'rose', 'clay']

const KEEP_COLORS: Record<string, NoteColor> = {
  DEFAULT: 'default',
  RED: 'coral',
  ORANGE: 'peach',
  YELLOW: 'sand',
  GREEN: 'mint',
  TEAL: 'sage',
  BLUE: 'fog',
  CERULEAN: 'storm',
  DARK_BLUE: 'storm',
  PURPLE: 'dusk',
  PINK: 'blossom',
  BROWN: 'clay',
  GRAY: 'default',
}

type KeepNote = {
  title?: string
  textContent?: string
  listContent?: { text?: string; isChecked?: boolean }[]
  color?: string
  isPinned?: boolean
  isArchived?: boolean
  isTrashed?: boolean
  labels?: { name?: string }[]
  createdTimestampUsec?: number
  userEditedTimestampUsec?: number
}

function baseNote(title: string, blocks: Block[], extra: Partial<Note> = {}): Note {
  const now = new Date().toISOString()
  return {
    id: uid(),
    title,
    blocks,
    color: 'default',
    labels: [],
    pinned: false,
    archived: false,
    trashed: false,
    createdAt: now,
    updatedAt: now,
    ...extra,
  }
}

const baseName = (file: File) => file.name.replace(/\.[^.]+$/, '').trim() || 'Untitled'

function fromText(file: File, text: string): Note[] {
  if (!text.trim()) return []
  return [baseNote(baseName(file), parseNoteText(text))]
}

function fromMarkdown(file: File, text: string): Note[] {
  if (!text.trim()) return []
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const firstIdx = lines.findIndex((l) => l.trim() !== '')
  const h1 = lines[firstIdx]?.match(/^#\s+(.+)$/)
  const title = h1 ? h1[1].trim() : baseName(file)
  const body = h1 ? lines.slice(firstIdx + 1).join('\n') : text
  return [baseNote(title, parseNoteText(body))]
}

const usecToIso = (usec?: number) => (usec ? new Date(Math.round(usec / 1000)).toISOString() : undefined)

function fromKeep(k: KeepNote, file: File): Note {
  const blocks: Block[] = []
  if (k.textContent?.trim()) blocks.push({ id: uid(), kind: 'text', text: k.textContent })
  if (k.listContent?.length) {
    blocks.push({
      id: uid(),
      kind: 'checklist',
      title: '',
      items: k.listContent
        .filter((i) => i.text?.trim())
        .map((i) => ({ id: uid(), text: i.text!.trim(), done: i.isChecked === true })),
    })
  }
  const created = usecToIso(k.createdTimestampUsec)
  const edited = usecToIso(k.userEditedTimestampUsec) ?? created
  return baseNote(k.title?.trim() || (blocks.length ? '' : baseName(file)), blocks, {
    color: KEEP_COLORS[k.color ?? 'DEFAULT'] ?? 'default',
    labels: [...new Set((k.labels ?? []).map((l) => l.name?.trim() ?? '').filter(Boolean))],
    pinned: k.isPinned === true,
    archived: k.isArchived === true,
    trashed: k.isTrashed === true,
    ...(created ? { createdAt: created } : {}),
    ...(edited ? { updatedAt: edited } : {}),
  })
}

const isKeepNote = (v: unknown): v is KeepNote =>
  !!v && typeof v === 'object' && ('textContent' in v || 'listContent' in v) && ('isTrashed' in v || 'userEditedTimestampUsec' in v)

function isBackupNote(v: unknown): v is Note {
  const n = v as Partial<Note> | null
  return !!n && typeof n.id === 'string' && typeof n.title === 'string' && Array.isArray(n.blocks)
}

function fromBackup(notes: unknown[]): Note[] {
  return notes.filter(isBackupNote).map((n) => ({
    ...n,
    color: COLORS.includes(n.color) ? n.color : 'default',
    labels: Array.isArray(n.labels) ? n.labels.filter((l) => typeof l === 'string') : [],
    pinned: n.pinned === true,
    archived: n.archived === true,
    trashed: n.trashed === true,
  }))
}

function fromJson(file: File, text: string): Note[] {
  const data = JSON.parse(text) as unknown
  if (data && typeof data === 'object' && (data as { app?: string }).app === 'notekeeper') {
    return fromBackup((data as { notes?: unknown[] }).notes ?? [])
  }
  if (isKeepNote(data)) return [fromKeep(data, file)]
  if (Array.isArray(data) && data.length && data.every(isKeepNote)) return data.map((k) => fromKeep(k, file))
  throw new Error('unsupported JSON')
}

export type ImportResult = { notes: Note[]; failed: string[] }

export async function importFiles(files: File[]): Promise<ImportResult> {
  const notes: Note[] = []
  const failed: string[] = []
  for (const file of files) {
    try {
      const text = await file.text()
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (ext === 'json') notes.push(...fromJson(file, text))
      else if (ext === 'md' || ext === 'markdown') notes.push(...fromMarkdown(file, text))
      else if (ext === 'txt' || file.type.startsWith('text/')) notes.push(...fromText(file, text))
      else throw new Error('unsupported file')
    } catch {
      failed.push(file.name)
    }
  }
  return { notes, failed }
}
