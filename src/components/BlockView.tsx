import { Fragment, type ReactNode } from 'react'
import type { Block } from '../types'
import { Icon } from '../icons'
import { CopyButton, SecretValue } from './Secret'

const URL_RE = /(https?:\/\/[^\s)]+)/g

export function Linkify({ text }: { text: string }) {
  const parts = text.split(URL_RE)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
            {part.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}

type Props = {
  block: Block
  onToggleItem?: (itemId: string) => void
}

export function BlockView({ block, onToggleItem }: Props) {
  if (block.kind === 'text') {
    return (
      <p className="block-text">
        {block.text.split('\n').map((line, i) => (
          <span key={i} className="text-line">
            <Linkify text={line} />
          </span>
        ))}
      </p>
    )
  }

  if (block.kind === 'checklist') {
    return (
      <div className="block-checklist">
        {block.title && <div className="block-heading">{block.title}</div>}
        <ul>
          {block.items.map((item) => (
            <li key={item.id} className={item.done ? 'done' : undefined}>
              <button
                type="button"
                className="check"
                aria-label={item.done ? 'Uncheck' : 'Check'}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleItem?.(item.id)
                }}
              >
                <Icon name={item.done ? 'boxChecked' : 'boxEmpty'} size={18} />
              </button>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="block-account">
      {block.name && (
        <div className="account-name">
          <Icon name="key" size={14} />
          <span>{block.name}</span>
        </div>
      )}
      <dl>
        {block.fields.map((f) => {
          let value: ReactNode
          if (f.secret) value = <SecretValue value={f.value} label={f.key} />
          else if (!f.key) value = <span className="field-note"><Linkify text={f.value} /></span>
          else
            value = (
              <span className="field-value">
                <span className="field-text"><Linkify text={f.value} /></span>
                {f.value && !/^https?:/.test(f.value) && <CopyButton value={f.value} label={f.key} />}
              </span>
            )
          return (
            <div key={f.id} className={f.key ? 'field' : 'field note-only'}>
              {f.key && <dt>{f.key}</dt>}
              <dd>{value}</dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}
