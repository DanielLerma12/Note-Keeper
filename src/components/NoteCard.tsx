import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { Note } from '../types'
import { Icon } from '../icons'
import { BlockView } from './BlockView'
import { NoteToolbar } from './NoteToolbar'
import { toggleItem } from '../noteOps'

export type NoteHandlers = {
  open: (id: string) => void
  update: (id: string, patch: Partial<Note>) => void
  trash: (id: string) => void
  restore: (id: string) => void
  archive: (id: string) => void
  deleteForever: (id: string) => void
  pickLabel: (label: string) => void
}

const ROW_SELECTOR = '.block-account, .block-heading, .block-checklist li, .text-line'
const COUNTED = '.block-account, .block-checklist li, .text-line'
const INDICATOR_SPACE = 26

function useHiddenRows(ref: RefObject<HTMLDivElement | null>, deps: unknown) {
  const [hidden, setHidden] = useState(0)

  useLayoutEffect(() => {
    const body = ref.current
    if (!body) return
    const wrap = body.parentElement
    if (!wrap) return
    let frame = 0
    const fit = () => {
      const box = body.getBoundingClientRect()
      const rows = [...body.querySelectorAll<HTMLElement>(ROW_SELECTOR)]
      const rects = rows.map((row) => row.getBoundingClientRect())
      if (rects.every((r) => r.bottom <= box.bottom + 0.5)) {
        body.style.clipPath = ''
        wrap.style.removeProperty('--more-count-top')
        setHidden(0)
        return
      }
      const limit = box.bottom - INDICATOR_SPACE
      let first = rects.findIndex((r) => r.bottom > limit + 0.5)
      let cutAt: number
      if (first <= 0) {
        first = Math.max(first, 0) + 1
        cutAt = limit
      } else {
        const lastEnd = Math.max(box.top, ...rects.slice(0, first).map((r) => r.bottom))
        cutAt = Math.min(limit, (lastEnd + rects[first].top) / 2)
      }
      body.style.clipPath = `inset(0 0 ${Math.round(box.bottom - cutAt)}px 0)`
      const wrapTop = wrap.getBoundingClientRect().top
      wrap.style.setProperty('--more-count-top', `${Math.max(0, cutAt - wrapTop + 4)}px`)
      setHidden(rows.slice(first).filter((row) => row.matches(COUNTED)).length)
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(fit)
    }

    fit()
    const observer = new ResizeObserver(schedule)
    observer.observe(body)
    for (const child of body.children) observer.observe(child)
    document.fonts?.ready.then(schedule)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [ref, deps])

  return hidden
}

export function NoteCard({ note, h }: { note: Note; h: NoteHandlers }) {
  const empty = !note.title && note.blocks.length === 0
  const bodyRef = useRef<HTMLDivElement>(null)
  const hidden = useHiddenRows(bodyRef, note.blocks)

  return (
    <article
      className={`note-card c-${note.color}`}
      tabIndex={0}
      onClick={() => h.open(note.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) h.open(note.id)
      }}
    >
      {!note.trashed && (
        <button
          type="button"
          className={`icon-btn pin-btn${note.pinned ? ' pinned' : ''}`}
          aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
          aria-pressed={note.pinned}
          onClick={(e) => {
            e.stopPropagation()
            h.update(note.id, { pinned: !note.pinned })
          }}
        >
          <Icon name="pin" size={18} />
        </button>
      )}
      {note.title && <h3 className="note-title">{note.title}</h3>}
      <div className="note-body-wrap">
        <div className="note-body" ref={bodyRef}>
          {empty && <p className="placeholder">Empty note</p>}
          {note.blocks.map((b) => (
            <BlockView
              key={b.id}
              block={b}
              onToggleItem={(itemId) => h.update(note.id, { blocks: toggleItem(note.blocks, b.id, itemId) })}
            />
          ))}
        </div>
        {hidden > 0 && <div className="more-count">+ {hidden} more</div>}
      </div>
      <NoteToolbar
        note={note}
        onColor={(color) => h.update(note.id, { color })}
        onArchive={() => h.archive(note.id)}
        onTrash={() => h.trash(note.id)}
        onRestore={() => h.restore(note.id)}
        onDeleteForever={() => h.deleteForever(note.id)}
      />
      {note.labels.length > 0 && (
        <div className="chips">
          {note.labels.map((l) => (
            <button
              key={l}
              type="button"
              className="chip"
              onClick={(e) => {
                e.stopPropagation()
                h.pickLabel(l)
              }}
            >
              {l}
            </button>
          ))}
        </div>
      )}
    </article>
  )
}
