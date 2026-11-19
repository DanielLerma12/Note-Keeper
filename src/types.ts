export type NoteColor =
  | 'default'
  | 'coral'
  | 'peach'
  | 'sand'
  | 'amber'
  | 'olive'
  | 'pine'
  | 'mint'
  | 'sage'
  | 'fog'
  | 'storm'
  | 'indigo'
  | 'violet'
  | 'dusk'
  | 'blossom'
  | 'berry'
  | 'rose'
  | 'clay'

export type Field = {
  id: string
  key: string
  value: string
  secret: boolean
}

export type ChecklistItem = {
  id: string
  text: string
  done: boolean
}

export type Block =
  | { id: string; kind: 'text'; text: string }
  | { id: string; kind: 'checklist'; title: string; items: ChecklistItem[] }
  | { id: string; kind: 'account'; name: string; fields: Field[] }

export type Note = {
  id: string
  title: string
  blocks: Block[]
  color: NoteColor
  labels: string[]
  pinned: boolean
  archived: boolean
  trashed: boolean
  createdAt: string
  updatedAt: string
}

export type View =
  | { kind: 'notes' }
  | { kind: 'label'; label: string }
  | { kind: 'archive' }
  | { kind: 'trash' }

export type User = {
  id: string
  email: string
  username: string
  authVersion: number
}

/** The signed-in account; sessionEndsAt (ms) is set only for time-limited accounts. */
export type SessionInfo = { user: User; sessionEndsAt: number | null }
