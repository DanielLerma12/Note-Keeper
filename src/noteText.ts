import type { Block, ChecklistItem, Field, Note } from './types'

export const uid = () => crypto.randomUUID()

const SECRET_KEY = /password|passcode|pass\b|\bcode\b|\bpin\b|secret|token|passphrase|cvv|clave|contrase/i

export const isSecretKey = (key: string) => SECRET_KEY.test(key)

const indentOf = (line: string) => line.length - line.trimStart().length

const CHECK = /^\s*(?:[-*+]\s+)?\[( |x|X)\]\s+(.*)$/
const KV_LOOSE = /^\s+([^:]+?)\s*:\s*(.*)$/
const KV_SPACED = /^\s+(.+?)\s+:\s+(.*)$/

const makeField = (key: string, value: string): Field => ({
  id: uid(),
  key: key.trim(),
  value: value.trim(),
  secret: isSecretKey(key),
})

function parseFields(lines: string[], pattern: RegExp): Field[] {
  const fields: Field[] = []
  let fieldIndent = -1
  for (const line of lines) {
    const match = line.match(pattern)
    const indent = indentOf(line)
    if (match && (fieldIndent < 0 || indent <= fieldIndent)) {
      fields.push(makeField(match[1], match[2]))
      fieldIndent = indent
      continue
    }
    const last = fields[fields.length - 1]
    const text = line.trim()
    if (last && indent > fieldIndent) {
      last.value = last.value ? `${last.value} ${text}` : text
    } else {
      fields.push({ id: uid(), key: '', value: text, secret: false })
    }
  }
  return fields
}

function toCheckItem(line: string): ChecklistItem {
  const m = line.match(CHECK)!
  return { id: uid(), text: m[2].trim(), done: m[1].toLowerCase() === 'x' }
}

function dedent(lines: string[]) {
  const min = Math.min(...lines.filter((l) => l.trim()).map(indentOf))
  return lines.map((l) => l.slice(min))
}

function parseParagraph(paragraph: string[]): Block[] {
  const [first, ...rest] = paragraph
  const firstIndented = indentOf(first) > 0

  if (paragraph.every((l) => CHECK.test(l))) {
    return [{ id: uid(), kind: 'checklist', title: '', items: paragraph.map(toCheckItem) }]
  }
  if (!firstIndented && rest.length > 0 && rest.every((l) => CHECK.test(l))) {
    return [{ id: uid(), kind: 'checklist', title: first.replace(/^#+\s*/, '').trim(), items: rest.map(toCheckItem) }]
  }

  if (!firstIndented && rest.some((l) => KV_LOOSE.test(l))) {
    return [{ id: uid(), kind: 'account', name: first.trim(), fields: parseFields(rest, KV_LOOSE) }]
  }

  const allIndented = paragraph.every((l) => indentOf(l) > 0)
  if (allIndented) {
    const kvCount = paragraph.filter((l) => KV_SPACED.test(l)).length
    if (kvCount >= Math.ceil(paragraph.length / 2)) {
      return [{ id: uid(), kind: 'account', name: '', fields: parseFields(paragraph, KV_SPACED) }]
    }
    if (paragraph.every((l) => l.trim().split(/\s{2,}/).length > 1)) {
      return [{ id: uid(), kind: 'text', text: paragraph.flatMap((l) => l.trim().split(/\s{2,}/)).join('\n') }]
    }
  }

  return [{ id: uid(), kind: 'text', text: dedent(paragraph).join('\n') }]
}

function mergeAdjacentText(blocks: Block[]): Block[] {
  const out: Block[] = []
  for (const block of blocks) {
    const prev = out[out.length - 1]
    if (block.kind === 'text' && prev?.kind === 'text') {
      prev.text = `${prev.text}\n\n${block.text}`
    } else {
      out.push(block)
    }
  }
  return out
}

export function parseNoteText(raw: string): Block[] {
  const paragraphs: string[][] = []
  let current: string[] = []
  for (const line of raw.replace(/\r\n?/g, '\n').split('\n')) {
    if (line.trim() === '') {
      if (current.length) paragraphs.push(current)
      current = []
    } else {
      current.push(line.replace(/\s+$/, ''))
    }
  }
  if (current.length) paragraphs.push(current)
  return mergeAdjacentText(paragraphs.flatMap(parseParagraph))
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export const normalizeQuery = normalize

export function noteToSearchText(note: Note) {
  const parts = [note.title, ...note.labels]
  for (const b of note.blocks) {
    if (b.kind === 'text') parts.push(b.text)
    if (b.kind === 'checklist') parts.push(b.title, ...b.items.map((i) => i.text))
    if (b.kind === 'account') parts.push(b.name, ...b.fields.filter((f) => !f.secret).flatMap((f) => [f.key, f.value]))
  }
  return normalize(parts.join(' '))
}
