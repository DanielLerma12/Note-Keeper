import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type TextareaHTMLAttributes } from 'react'
import type { Block, Field, Note } from '../types'
import { Icon } from '../icons'
import { NoteToolbar } from './NoteToolbar'
import { CopyButton } from './Secret'
import { useReveal } from './revealContext'
import { SECRET_MASK } from '../secretMask'
import { cleanNote, newBlock } from '../noteOps'
import { isSecretKey, uid } from '../noteText'

function AutoTextarea({
  onElement,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { onElement?: (element: HTMLTextAreaElement | null) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const setRef = useCallback(
    (element: HTMLTextAreaElement | null) => {
      ref.current = element
      onElement?.(element)
    },
    [onElement],
  )
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    const styles = getComputedStyle(el)
    const borders = Number.parseFloat(styles.borderTopWidth) + Number.parseFloat(styles.borderBottomWidth)
    el.style.height = `${el.scrollHeight + borders}px`
  }, [props.value])
  return <textarea ref={setRef} rows={1} {...props} />
}

function fitsSingleLine(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  if (value.includes('\n')) return false
  const styles = getComputedStyle(element)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D context is unavailable')
  context.font = `${styles.fontStyle} ${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`
  const padding = Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight)
  const letterSpacing = styles.letterSpacing === 'normal' ? 0 : Number.parseFloat(styles.letterSpacing)
  const textWidth = context.measureText(value).width + Math.max(0, value.length - 1) * letterSpacing
  return textWidth <= element.clientWidth - padding
}

function AccountFieldInput({
  className,
  placeholder,
  autoComplete,
  value,
  onChange,
}: {
  className: string
  placeholder: string
  autoComplete?: string
  value: string
  onChange: (value: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const restoreFocus = useRef(false)
  const [multiline, setMultiline] = useState(false)

  useLayoutEffect(() => {
    const input = inputRef.current
    if (input && !fitsSingleLine(input, value)) setMultiline(true)
  }, [value])

  useLayoutEffect(() => {
    if (!restoreFocus.current) return
    const field = multiline ? textareaRef.current : inputRef.current
    field?.focus()
    restoreFocus.current = false
  }, [multiline])

  const setTextareaRef = useCallback((element: HTMLTextAreaElement | null) => {
    textareaRef.current = element
  }, [])

  const handleChange = (element: HTMLInputElement | HTMLTextAreaElement) => {
    const next = element.value
    const shouldWrap = !fitsSingleLine(element, next)
    if (shouldWrap !== multiline && document.activeElement === element) restoreFocus.current = true
    setMultiline(shouldWrap)
    onChange(next)
  }

  if (multiline) {
    return (
      <AutoTextarea
        onElement={setTextareaRef}
        className={className}
        placeholder={placeholder}
        autoComplete={autoComplete}
        spellCheck={false}
        value={value}
        onChange={(e) => handleChange(e.currentTarget)}
      />
    )
  }

  return (
    <input
      ref={inputRef}
      className={className}
      placeholder={placeholder}
      type="text"
      autoComplete={autoComplete}
      spellCheck={false}
      value={value}
      onChange={(e) => handleChange(e.currentTarget)}
    />
  )
}

type Props = {
  note: Note
  allLabels: string[]
  onClose: (note: Note) => void
  onTrash: (note: Note) => void
  onRestore: (note: Note) => void
  onDeleteForever: (id: string) => void
}

export function NoteEditor({ note, allLabels, onClose, onTrash, onRestore, onDeleteForever }: Props) {
  const [draft, setDraft] = useState(note)
  const [labelInput, setLabelInput] = useState('')
  const draftRef = useRef(draft)
  useLayoutEffect(() => {
    draftRef.current = draft
  }, [draft])

  const close = () => onClose(cleanNote(draftRef.current))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(cleanNote(draftRef.current))
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('modal-open')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('modal-open')
    }
  }, [onClose])

  const setBlock = (id: string, fn: (b: Block) => Block) =>
    setDraft((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === id ? fn(b) : b)) }))

  const removeBlock = (id: string) => setDraft((d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== id) }))

  const addBlock = (kind: Block['kind'], index?: number) =>
    setDraft((d) => {
      const blocks = [...d.blocks]
      blocks.splice(index ?? blocks.length, 0, newBlock(kind))
      return { ...d, blocks }
    })

  const addLabel = (raw: string) => {
    const label = raw.trim()
    if (!label) return
    setDraft((d) => (d.labels.some((l) => l.toLowerCase() === label.toLowerCase()) ? d : { ...d, labels: [...d.labels, label] }))
    setLabelInput('')
  }

  const readOnly = draft.trashed

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className={`modal note-card editing c-${draft.color}`} role="dialog" aria-modal="true" aria-label={draft.title || 'Note'}>
        <div className="modal-scroll">
          <div className="editor-head">
            <input
              className="title-input"
              placeholder="Title"
              value={draft.title}
              readOnly={readOnly}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            {!readOnly && (
              <button
                type="button"
                className={`icon-btn${draft.pinned ? ' pinned' : ''}`}
                aria-label={draft.pinned ? 'Unpin note' : 'Pin note'}
                aria-pressed={draft.pinned}
                onClick={() => setDraft({ ...draft, pinned: !draft.pinned })}
              >
                <Icon name="pin" />
              </button>
            )}
          </div>

          <fieldset disabled={readOnly} className="editor-blocks">
            {draft.blocks.map((block, index) => (
              <Fragment key={block.id}>
                {!readOnly && draft.blocks.length > 1 && block.kind === 'text' && (
                  <BlockButtons className="insert-blocks" onAdd={(kind) => addBlock(kind, index)} />
                )}
                <div className={`edit-block edit-${block.kind}`}>
                  <button type="button" className="icon-btn tiny remove-block" aria-label="Remove block" onClick={() => removeBlock(block.id)}>
                    <Icon name="close" size={16} />
                  </button>
                  {block.kind === 'text' && (
                    <AutoTextarea
                      className="text-input"
                      placeholder="Take a note…"
                      value={block.text}
                      autoFocus={draft.blocks.length === 1 && !block.text && !draft.title}
                      onChange={(e) => setBlock(block.id, (b) => ({ ...b, text: e.target.value }))}
                    />
                  )}
                  {block.kind === 'checklist' && (
                    <ChecklistEditor block={block} onChange={(next) => setBlock(block.id, () => next)} />
                  )}
                  {block.kind === 'account' && (
                    <AccountEditor
                      block={block}
                      onChange={(next) => setBlock(block.id, () => next)}
                    />
                  )}
                </div>
              </Fragment>
            ))}
          </fieldset>

          {!readOnly && <BlockButtons onAdd={(kind) => addBlock(kind)} />}

          <div className="chips editor-chips">
            {draft.labels.map((l) => (
              <span key={l} className="chip">
                {l}
                {!readOnly && (
                  <button
                    type="button"
                    className="chip-x"
                    aria-label={`Remove label ${l}`}
                    onClick={() => setDraft({ ...draft, labels: draft.labels.filter((x) => x !== l) })}
                  >
                    <Icon name="close" size={12} />
                  </button>
                )}
              </span>
            ))}
            {!readOnly && (
              <form
                className="label-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  addLabel(labelInput)
                }}
              >
                <Icon name="label" size={14} />
                <input
                  list="label-options"
                  placeholder="Add label"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  onBlur={() => addLabel(labelInput)}
                />
                <datalist id="label-options">
                  {allLabels.filter((l) => !draft.labels.includes(l)).map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              </form>
            )}
          </div>
          <div className="edited-at">
            Edited {new Date(draft.updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        </div>

        <div className="modal-foot">
          <NoteToolbar
            note={draft}
            onColor={(color) => setDraft({ ...draft, color })}
            onArchive={() => onClose(cleanNote({ ...draftRef.current, archived: !draft.archived, pinned: false }))}
            onTrash={() => onTrash(cleanNote(draftRef.current))}
            onRestore={() => onRestore(draftRef.current)}
            onDeleteForever={() => onDeleteForever(draft.id)}
          />
          <button type="button" className="close-btn" onClick={close}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function BlockButtons({ onAdd, className }: { onAdd: (kind: Block['kind']) => void; className?: string }) {
  return (
    <div className={`add-blocks${className ? ` ${className}` : ''}`}>
      <button type="button" className="ghost-btn" onClick={() => onAdd('text')}>
        <Icon name="text" size={16} /> Text
      </button>
      <button type="button" className="ghost-btn" onClick={() => onAdd('checklist')}>
        <Icon name="checklist" size={16} /> List
      </button>
      <button type="button" className="ghost-btn" onClick={() => onAdd('account')}>
        <Icon name="key" size={16} /> Account
      </button>
    </div>
  )
}

type ChecklistBlock = Extract<Block, { kind: 'checklist' }>
type AccountBlock = Extract<Block, { kind: 'account' }>

function ChecklistEditor({ block, onChange }: { block: ChecklistBlock; onChange: (b: ChecklistBlock) => void }) {
  const setItems = (items: ChecklistBlock['items']) => onChange({ ...block, items })
  return (
    <div className="checklist-editor">
      <input
        className="subtitle-input"
        placeholder="List title (optional)"
        value={block.title}
        onChange={(e) => onChange({ ...block, title: e.target.value })}
      />
      <ul>
        {block.items.map((item, idx) => (
          <li key={item.id} className={item.done ? 'done' : undefined}>
            <button
              type="button"
              className="check"
              aria-label={item.done ? 'Uncheck' : 'Check'}
              onClick={() => setItems(block.items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))}
            >
              <Icon name={item.done ? 'boxChecked' : 'boxEmpty'} size={18} />
            </button>
            <AutoTextarea
              className="checklist-item-input"
              value={item.text}
              placeholder="List item"
              spellCheck={false}
              onChange={(e) => setItems(block.items.map((i) => (i.id === item.id ? { ...i, text: e.target.value } : i)))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const next = [...block.items]
                  next.splice(idx + 1, 0, { id: uid(), text: '', done: false })
                  setItems(next)
                  requestAnimationFrame(() => {
                    const inputs = (e.target as HTMLElement)
                      .closest('ul')
                      ?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
                    inputs?.[idx + 1]?.focus()
                  })
                }
                if (e.key === 'Backspace' && !item.text && block.items.length > 1) {
                  e.preventDefault()
                  setItems(block.items.filter((i) => i.id !== item.id))
                }
              }}
            />
            <button type="button" className="icon-btn tiny" aria-label="Remove item" onClick={() => setItems(block.items.filter((i) => i.id !== item.id))}>
              <Icon name="close" size={14} />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="add-row" onClick={() => setItems([...block.items, { id: uid(), text: '', done: false }])}>
        <Icon name="add" size={16} /> Item
      </button>
    </div>
  )
}

function AccountEditor({
  block,
  onChange,
}: {
  block: AccountBlock
  onChange: (b: AccountBlock) => void
}) {
  const reveal = useReveal()
  // Fields being typed into right now stay visible; masking them mid-typing would cut the input off.
  const [typing, setTyping] = useState<Set<string>>(new Set())
  const setField = (id: string, patch: Partial<Field>) =>
    onChange({ ...block, fields: block.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) })

  const revealField = (f: Field) =>
    reveal({ label: f.key, value: f.value, onChange: (value) => setField(f.id, { value }) })

  return (
    <div className="account-editor">
      <div className="account-name-row">
        <Icon name="key" size={16} />
        <input
          className="subtitle-input"
          placeholder="Service (e.g. Gmail)"
          value={block.name}
          onChange={(e) => onChange({ ...block, name: e.target.value })}
        />
      </div>
      {block.fields.map((f) => (
        <div key={f.id} className="field-row">
          <div className="field-key-box">
            <AccountFieldInput
              className="field-key"
              placeholder="Field"
              value={f.key}
              onChange={(key) => setField(f.id, { key, secret: f.secret || isSecretKey(key) })}
            />
          </div>
          <div className="field-value-editor">
            {f.secret && f.value && !typing.has(f.id) ? (
              <input
                className="field-val masked"
                placeholder="Value"
                type="text"
                readOnly
                autoComplete="off"
                spellCheck={false}
                value={SECRET_MASK}
                aria-label={`${f.key || 'Secret'} hidden. Click to show.`}
                onClick={() => revealField(f)}
              />
            ) : (
              <AccountFieldInput
                className="field-val"
                placeholder="Value"
                autoComplete="off"
                value={f.value}
                onChange={(value) => {
                  if (f.secret) setTyping((t) => new Set(t).add(f.id))
                  setField(f.id, { value })
                }}
              />
            )}
          </div>
          <button
            type="button"
            className={`icon-btn tiny${f.secret ? ' on' : ''}`}
            aria-label={f.secret ? 'Mark as visible' : 'Mark as secret'}
            aria-pressed={f.secret}
            onClick={() => setField(f.id, { secret: !f.secret })}
          >
            <Icon name="shield" size={15} />
          </button>
          {f.secret && f.value && (
            <button type="button" className="icon-btn tiny" aria-label="Show" onClick={() => revealField(f)}>
              <Icon name="eye" size={15} />
            </button>
          )}
          {f.value && <CopyButton value={f.value} label={f.key} />}
          <button
            type="button"
            className="icon-btn tiny"
            aria-label="Remove field"
            onClick={() => onChange({ ...block, fields: block.fields.filter((x) => x.id !== f.id) })}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="add-row"
        onClick={() => onChange({ ...block, fields: [...block.fields, { id: uid(), key: '', value: '', secret: false }] })}
      >
        <Icon name="add" size={16} /> Field
      </button>
    </div>
  )
}
