import { useEffect, useRef, useState } from 'react'
import { COLORS } from '../colors'
import { Icon } from '../icons'
import type { Note, NoteColor } from '../types'

type Props = {
  note: Note
  onColor: (c: NoteColor) => void
  onArchive: () => void
  onTrash: () => void
  onRestore: () => void
  onDeleteForever: () => void
}

export function NoteToolbar({ note, onColor, onArchive, onTrash, onRestore, onDeleteForever }: Props) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!paletteOpen) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setPaletteOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [paletteOpen])

  if (note.trashed) {
    return (
      <div className="note-toolbar" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn" aria-label="Delete forever" onClick={onDeleteForever}>
          <Icon name="trash" size={18} />
        </button>
        <button type="button" className="icon-btn" aria-label="Restore" onClick={onRestore}>
          <Icon name="restore" size={18} />
        </button>
      </div>
    )
  }

  return (
    <div className="note-toolbar" ref={ref} onClick={(e) => e.stopPropagation()}>
      <div className="palette-anchor">
        <button
          type="button"
          className="icon-btn"
          aria-label="Change color"
          aria-expanded={paletteOpen}
          onClick={() => setPaletteOpen((o) => !o)}
        >
          <Icon name="palette" size={18} />
        </button>
        {paletteOpen && (
          <div className="palette" role="menu">
            {COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                role="menuitemradio"
                aria-checked={note.color === c.id}
                aria-label={c.name}
                className={`swatch c-${c.id}${note.color === c.id ? ' active' : ''}`}
                onClick={() => {
                  onColor(c.id)
                  setPaletteOpen(false)
                }}
              >
                {note.color === c.id && <Icon name="check" size={14} />}
              </button>
            ))}
          </div>
        )}
      </div>
      <button type="button" className="icon-btn" aria-label={note.archived ? 'Unarchive' : 'Archive'} onClick={onArchive}>
        <Icon name={note.archived ? 'unarchive' : 'archive'} size={18} />
      </button>
      <button type="button" className="icon-btn" aria-label="Move to trash" onClick={onTrash}>
        <Icon name="trash" size={18} />
      </button>
    </div>
  )
}
