import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { useNotes } from './useNotes'
import { normalizeQuery, noteToSearchText } from './noteText'
import { IMPORT_ACCEPT, importFiles } from './importers'
import { newNote, isBlank } from './noteOps'
import { Icon } from './icons'
import { NoteCard, type NoteHandlers } from './components/NoteCard'
import { NoteEditor } from './components/NoteEditor'
import { useToast } from './components/toastContext'
import type { Note, SessionInfo, View } from './types'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export default function App({ session, onSignOut }: { session: SessionInfo; onSignOut: () => void }) {
  const { notes, status, reload, update, add, addMany, remove, emptyTrash } = useNotes()
  const toast = useToast()
  const [view, setView] = useState<View>({ kind: 'notes' })
  const [query, setQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 900)
  const [editing, setEditing] = useState<Note | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const labels = useMemo(() => {
    const counts = new Map<string, number>()
    notes.filter((n) => !n.trashed).forEach((n) => n.labels.forEach((l) => counts.set(l, (counts.get(l) ?? 0) + 1)))
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'en'))
  }, [notes])

  const visible = useMemo(() => {
    const q = normalizeQuery(query)
    return notes
      .filter((n) => {
        if (view.kind === 'trash') return n.trashed
        if (n.trashed) return false
        if (view.kind === 'archive') return n.archived
        if (q) return true
        if (n.archived) return false
        if (view.kind === 'label') return n.labels.includes(view.label)
        return true
      })
      .filter((n) => !q || noteToSearchText(n).includes(q))
      .sort((a, b) => a.title.localeCompare(b.title, 'en'))
  }, [notes, view, query])

  const showPinned = view.kind !== 'trash' && view.kind !== 'archive'
  const pinned = showPinned ? visible.filter((n) => n.pinned) : []
  const others = visible.filter((n) => !pinned.includes(n))

  const importAll = useCallback(
    async (files: File[]) => {
      if (!files.length) return
      const { notes: imported, failed } = await importFiles(files)
      const fresh = addMany(imported)
      const skipped = imported.length - fresh
      if (fresh) setView({ kind: 'notes' })
      const parts = [`${plural(fresh, 'note')} imported`]
      if (skipped) parts.push(`${skipped} already existed`)
      if (failed.length) parts.push(`couldn't read ${failed.join(', ')}`)
      toast(parts.join(' · '))
    },
    [addMany, toast],
  )

  const exportNotes = () => {
    const blob = new Blob([JSON.stringify({ app: 'notekeeper', version: 1, notes }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `notekeeper-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlers: NoteHandlers = {
    open: (id) => setEditing(notes.find((n) => n.id === id) ?? null),
    update,
    archive: (id) => {
      const note = notes.find((n) => n.id === id)
      if (!note) return
      update(id, { archived: !note.archived, pinned: false })
      toast(note.archived ? 'Note unarchived' : 'Note archived', {
        label: 'Undo',
        run: () => update(id, { archived: note.archived, pinned: note.pinned }),
      })
    },
    trash: (id) => {
      update(id, { trashed: true })
      toast('Note moved to trash', { label: 'Undo', run: () => update(id, { trashed: false }) })
    },
    restore: (id) => {
      update(id, { trashed: false })
      toast('Note restored')
    },
    deleteForever: (id) => {
      if (window.confirm("Delete this note forever? This can't be undone.")) remove(id)
    },
    pickLabel: (label) => {
      setQuery('')
      setView({ kind: 'label', label })
    },
  }

  const closeEditor = useCallback(
    (draft: Note) => {
      setEditing(null)
      const original = notes.find((n) => n.id === draft.id)
      if (original) {
        if (JSON.stringify(original) !== JSON.stringify(draft)) update(draft.id, draft)
      } else if (!isBlank(draft)) {
        add({ ...draft, updatedAt: new Date().toISOString() })
      }
    },
    [notes, update, add],
  )

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    importAll([...e.dataTransfer.files])
  }

  const heading =
    view.kind === 'label' ? view.label : view.kind === 'archive' ? 'Archive' : view.kind === 'trash' ? 'Trash' : 'Notekeeper'

  const canCreate = view.kind === 'notes' || view.kind === 'label'

  return (
    <div
      className="app"
      spellCheck={false}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          setDragging(true)
        }
      }}
      onDrop={onDrop}
    >
      <header className="topbar">
        <button type="button" className="icon-btn big" aria-label="Main menu" onClick={() => setSidebarOpen((o) => !o)}>
          <Icon name="menu" size={22} />
        </button>
        <div className="brand">
          <span className="brand-icon">
            <Icon name="notebook" size={22} />
          </span>
          <span className="brand-name">{heading}</span>
        </div>
        <label className="search">
          <Icon name="search" size={20} />
          <input
            type="search"
            placeholder="Search notes, accounts, labels…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" className="icon-btn tiny" aria-label="Clear search" onClick={() => setQuery('')}>
              <Icon name="close" size={18} />
            </button>
          )}
        </label>
        <div className="top-actions">
          <button type="button" className="icon-btn big hide-sm" aria-label="Export notes" onClick={exportNotes} disabled={!notes.length}>
            <Icon name="download" size={22} />
          </button>
          <button type="button" className="primary-btn" aria-label="Import notes" onClick={() => fileInput.current?.click()}>
            <Icon name="upload" size={18} />
            <span className="hide-sm">Import</span>
          </button>
          {session.sessionEndsAt && <SessionTimer endsAt={session.sessionEndsAt} />}
          <button
            type="button"
            className="account-btn"
            title={`Signed in as ${session.user.username} (${session.user.email}). Click to sign out.`}
            aria-label={`Sign out ${session.user.username}`}
            onClick={onSignOut}
          >
            <span className="account-avatar" aria-hidden="true">
              {session.user.username.slice(0, 1).toUpperCase()}
            </span>
            <span className="account-username hide-sm">{session.user.username}</span>
            <Icon name="logout" size={18} />
          </button>
          <input
            ref={fileInput}
            type="file"
            accept={IMPORT_ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              importAll([...(e.target.files ?? [])])
              e.target.value = ''
            }}
          />
        </div>
      </header>

      <div className="layout">
        <nav className={`sidebar${sidebarOpen ? ' open' : ''}`} aria-label="Sections">
          <SideItem icon="note" label="Notes" active={view.kind === 'notes'} onClick={() => setView({ kind: 'notes' })} />
          {labels.map(([label, count]) => (
            <SideItem
              key={label}
              icon="label"
              label={label}
              count={count}
              active={view.kind === 'label' && view.label === label}
              onClick={() => setView({ kind: 'label', label })}
            />
          ))}
          <SideItem icon="archive" label="Archive" active={view.kind === 'archive'} onClick={() => setView({ kind: 'archive' })} />
          <SideItem icon="trash" label="Trash" active={view.kind === 'trash'} onClick={() => setView({ kind: 'trash' })} />
        </nav>
        {sidebarOpen && <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} />}

        <main className="content">
          {canCreate && status === 'ready' && notes.length > 0 && (
            <button
              type="button"
              className="take-note"
              onClick={() => setEditing(newNote(view.kind === 'label' ? [view.label] : []))}
            >
              <span>Take a note…</span>
              <Icon name="checklist" size={22} />
            </button>
          )}

          {view.kind === 'trash' && others.length > 0 && (
            <div className="trash-bar">
              <span>Notes stay in the trash until you empty it.</span>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => window.confirm("Empty the trash? This can't be undone.") && emptyTrash()}
              >
                Empty trash
              </button>
            </div>
          )}

          {status === 'loading' && notes.length === 0 ? (
            <div className="empty">
              <div className="spinner" aria-label="Loading" />
            </div>
          ) : status === 'error' ? (
            <div className="empty">
              <Icon name="cloudOff" size={96} />
              <p>Couldn't connect to the database</p>
              <button type="button" className="ghost-btn" onClick={reload}>
                Try again
              </button>
            </div>
          ) : notes.length === 0 ? (
            <EmptyImport onPick={() => fileInput.current?.click()} onBlank={() => setEditing(newNote())} />
          ) : visible.length === 0 ? (
            <div className="empty">
              <Icon
                name={query ? 'search' : view.kind === 'trash' ? 'trash' : view.kind === 'archive' ? 'archive' : 'note'}
                size={96}
              />
              <p>
                {query
                  ? 'No matching notes'
                  : view.kind === 'trash'
                    ? 'No notes in the trash'
                    : view.kind === 'archive'
                      ? 'Your archived notes appear here'
                      : 'Notes you add appear here'}
              </p>
            </div>
          ) : (
            <>
              {pinned.length > 0 && (
                <section>
                  <h2 className="section-title">Pinned</h2>
                  <div className="notes grid">
                    {pinned.map((n) => (
                      <NoteCard key={n.id} note={n} h={handlers} />
                    ))}
                  </div>
                </section>
              )}
              {others.length > 0 && (
                <section>
                  {pinned.length > 0 && <h2 className="section-title">Others</h2>}
                  <div className="notes grid">
                    {others.map((n) => (
                      <NoteCard key={n.id} note={n} h={handlers} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      </div>

      {editing && (
        <NoteEditor
          key={editing.id}
          note={editing}
          allLabels={labels.map(([l]) => l)}
          onClose={closeEditor}
          onTrash={(draft) => {
            closeEditor({ ...draft, trashed: true, pinned: false })
            toast('Note moved to trash', { label: 'Undo', run: () => update(draft.id, { trashed: false }) })
          }}
          onRestore={(draft) => {
            setEditing(null)
            update(draft.id, { trashed: false })
            toast('Note restored')
          }}
          onDeleteForever={(id) => {
            if (window.confirm("Delete this note forever? This can't be undone.")) {
              setEditing(null)
              remove(id)
            }
          }}
        />
      )}

      {dragging && (
        <div className="drop-overlay" onDragLeave={() => setDragging(false)}>
          <Icon name="upload" size={56} />
          <p>Drop .txt, .md, Google Keep or Notekeeper files to import them</p>
        </div>
      )}
    </div>
  )
}

function SessionTimer({ endsAt }: { endsAt: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000))
  const label = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`
  return (
    <span className={`session-timer${left <= 60 ? ' low' : ''}`} title="Time left in this session" role="timer">
      <Icon name="timer" size={16} />
      {label}
    </span>
  )
}

function SideItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: 'note' | 'label' | 'archive' | 'trash'
  label: string
  count?: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button type="button" className={`side-item${active ? ' active' : ''}`} onClick={onClick} aria-current={active ? 'page' : undefined}>
      <Icon name={icon} size={20} />
      <span className="side-label">{label}</span>
      {count !== undefined && <span className="side-count">{count}</span>}
    </button>
  )
}

function EmptyImport({ onPick, onBlank }: { onPick: () => void; onBlank: () => void }) {
  return (
    <div className="import-hero">
      <div className="hero-icon">
        <Icon name="notebook" size={56} />
      </div>
      <h1>Your notes, organized</h1>
      <p>
        Import plain text or Markdown files, notes from Google Keep (Google Takeout), or a Notekeeper backup. Lists,
        checkboxes and "Field: value" accounts are recognized, and passwords stay hidden until you ask for them.
      </p>
      <div className="hero-actions">
        <button type="button" className="primary-btn large" onClick={onPick}>
          <Icon name="upload" size={20} />
          Choose files
        </button>
        <button type="button" className="ghost-btn large" onClick={onBlank}>
          <Icon name="add" size={20} />
          Blank note
        </button>
      </div>
      <span className="hint">.txt · .md · Google Keep .json · Notekeeper backup .json. You can also drop files anywhere in the window.</span>
    </div>
  )
}
