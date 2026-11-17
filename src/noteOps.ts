import type { Block, Note } from './types'
import { uid } from './noteText'

export function toggleItem(blocks: Block[], blockId: string, itemId: string): Block[] {
  return blocks.map((b) =>
    b.id === blockId && b.kind === 'checklist'
      ? { ...b, items: b.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)) }
      : b,
  )
}

export function newNote(labels: string[] = []): Note {
  const now = new Date().toISOString()
  return {
    id: uid(),
    title: '',
    blocks: [{ id: uid(), kind: 'text', text: '' }],
    color: 'default',
    labels,
    pinned: false,
    archived: false,
    trashed: false,
    createdAt: now,
    updatedAt: now,
  }
}

export function newBlock(kind: Block['kind']): Block {
  if (kind === 'text') return { id: uid(), kind, text: '' }
  if (kind === 'checklist') return { id: uid(), kind, title: '', items: [{ id: uid(), text: '', done: false }] }
  return {
    id: uid(),
    kind,
    name: '',
    fields: [
      { id: uid(), key: 'Username', value: '', secret: false },
      { id: uid(), key: 'Password', value: '', secret: true },
    ],
  }
}

export function cleanNote(note: Note): Note {
  const cleanedBlocks = note.blocks
    .map((b) => {
      if (b.kind === 'checklist')
        return {
          ...b,
          items: b.items
            .filter((i) => i.text.trim())
            .sort((a, b) => a.text.localeCompare(b.text, 'en', { sensitivity: 'base' })),
        }
      if (b.kind === 'account') return { ...b, fields: b.fields.filter((f) => f.key.trim() || f.value.trim()) }
      return b
    })
    .filter((b) => {
      if (b.kind === 'text') return b.text.trim() !== ''
      if (b.kind === 'checklist') return b.items.length > 0 || b.title.trim() !== ''
      return b.fields.length > 0 || b.name.trim() !== ''
    })

  const blocks: Block[] = []
  let accounts: Extract<Block, { kind: 'account' }>[] = []
  const flushAccounts = () => {
    blocks.push(...accounts.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })))
    accounts = []
  }

  for (const block of cleanedBlocks) {
    if (block.kind === 'account') accounts.push(block)
    else {
      flushAccounts()
      blocks.push(block)
    }
  }
  flushAccounts()

  return { ...note, title: note.title.trim(), blocks }
}

export const isBlank = (note: Note) => !note.title && note.blocks.length === 0
