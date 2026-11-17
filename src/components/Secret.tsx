import { useState } from 'react'
import { Icon } from '../icons'
import { useToast } from './toastContext'

export function CopyButton({ value, label }: { value: string; label: string }) {
  const toast = useToast()
  return (
    <button
      type="button"
      className="icon-btn tiny"
      aria-label={`Copy ${label}`}
      onClick={(e) => {
        e.stopPropagation()
        navigator.clipboard.writeText(value).then(
          () => toast(`${label || 'Value'} copied`),
          () => toast("Couldn't copy"),
        )
      }}
    >
      <Icon name="copy" size={15} />
    </button>
  )
}

export function SecretValue({ value, label }: { value: string; label: string }) {
  const [shown, setShown] = useState(false)
  return (
    <span className="secret">
      <code className={shown ? 'secret-text shown' : 'secret-text'}>
        {shown ? value : '•'.repeat(Math.min(Math.max(value.length, 6), 14))}
      </code>
      <button
        type="button"
        className="icon-btn tiny"
        aria-label={shown ? 'Hide' : 'Show'}
        onClick={(e) => {
          e.stopPropagation()
          setShown((s) => !s)
        }}
      >
        <Icon name={shown ? 'eyeOff' : 'eye'} size={15} />
      </button>
      <CopyButton value={value} label={label} />
    </span>
  )
}
