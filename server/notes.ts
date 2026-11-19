import type { Block, Note, NoteColor } from '../src/types'
import { prisma } from './prisma'
import { decrypt, encrypt } from './crypto'
import type { Prisma } from './generated/prisma/client'

const COLORS: NoteColor[] = ['default', 'coral', 'peach', 'sand', 'amber', 'olive', 'pine', 'mint', 'sage', 'fog', 'storm', 'indigo', 'violet', 'dusk', 'blossom', 'berry', 'rose', 'clay']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const withLabels = { note_labels: { include: { label: true }, orderBy: { position: 'asc' } } } as const

type NoteRow = Prisma.notesGetPayload<{ include: typeof withLabels }>

function mapSecrets(blocks: Block[], fn: (v: string) => string): Block[] {
  return blocks.map((b) =>
    b.kind === 'account' ? { ...b, fields: b.fields.map((f) => (f.secret ? { ...f, value: fn(f.value) } : f)) } : b,
  )
}

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    blocks: mapSecrets(row.blocks as unknown as Block[], decrypt),
    color: (COLORS as string[]).includes(row.color) ? (row.color as NoteColor) : 'default',
    labels: row.note_labels.map((nl) => nl.label.name),
    pinned: row.pinned,
    archived: row.archived,
    trashed: row.trashed,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export function parseNote(input: unknown): Note {
  const n = input as Partial<Note> | null
  if (!n || typeof n !== 'object') throw new BadRequest('Invalid note')
  if (typeof n.id !== 'string' || !UUID.test(n.id)) throw new BadRequest('Invalid id')
  if (!Array.isArray(n.blocks)) throw new BadRequest('Invalid blocks')
  const labels = Array.isArray(n.labels) ? n.labels.filter((l): l is string => typeof l === 'string' && l.trim() !== '') : []
  const date = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : new Date().toISOString())
  return {
    id: n.id,
    title: typeof n.title === 'string' ? n.title : '',
    blocks: n.blocks as Block[],
    color: COLORS.includes(n.color as NoteColor) ? (n.color as NoteColor) : 'default',
    labels: [...new Set(labels.map((l) => l.trim()))],
    pinned: n.pinned === true,
    archived: n.archived === true,
    trashed: n.trashed === true,
    createdAt: date(n.createdAt),
    updatedAt: date(n.updatedAt),
  }
}

export class BadRequest extends Error {}

export async function listNotes(userId: string) {
  await prisma.labels.deleteMany({ where: { user_id: userId, note_labels: { none: {} } } })
  const rows = await prisma.notes.findMany({ where: { user_id: userId }, include: withLabels, orderBy: { title: 'asc' } })
  return rows.map(toNote)
}

export async function saveNotes(userId: string, notes: Note[]) {
  if (!notes.length) return
  const names = [...new Set(notes.flatMap((n) => n.labels))]
  const rows = notes.map((note) => ({
    id: note.id,
    user_id: userId,
    title: note.title,
    blocks: mapSecrets(note.blocks, encrypt) as unknown as Prisma.InputJsonValue,
    color: note.color,
    pinned: note.pinned,
    archived: note.archived,
    trashed: note.trashed,
    created_at: new Date(note.createdAt),
    updated_at: new Date(note.updatedAt),
  }))
  const ids = rows.map((r) => r.id)

  await prisma.$transaction(async (tx) => {
    const foreign = await tx.notes.count({ where: { id: { in: ids }, user_id: { not: userId } } })
    if (foreign) throw new BadRequest('Some of these notes belong to another account')
    let labelIds = new Map<string, string>()
    if (names.length) {
      await tx.labels.createMany({ data: names.map((name) => ({ user_id: userId, name })), skipDuplicates: true })
      const found = await tx.labels.findMany({
        where: { user_id: userId, name: { in: names } },
        select: { id: true, name: true },
      })
      labelIds = new Map(found.map((l) => [l.name, l.id]))
    }
    await tx.notes.deleteMany({ where: { id: { in: ids }, user_id: userId } })
    await tx.notes.createMany({ data: rows })
    const links = notes.flatMap((note) =>
      note.labels.map((name, position) => ({ note_id: note.id, label_id: labelIds.get(name)!, position })),
    )
    if (links.length) await tx.note_labels.createMany({ data: links })
  })
}

export async function deleteNote(userId: string, id: string) {
  if (!UUID.test(id)) throw new BadRequest('Invalid id')
  await prisma.notes.deleteMany({ where: { id, user_id: userId } })
}

export async function emptyTrash(userId: string) {
  const { count } = await prisma.notes.deleteMany({ where: { user_id: userId, trashed: true } })
  return count
}
