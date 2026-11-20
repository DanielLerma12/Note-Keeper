import { Icon } from '../icons'
import { SECRET_MASK } from '../secretMask'
import { useReveal } from './revealContext'
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
  const reveal = useReveal()
  return (
    <span className="secret">
      <code className="secret-text">{SECRET_MASK}</code>
      <button
        type="button"
        className="icon-btn tiny"
        aria-label="Show"
        onClick={(e) => {
          e.stopPropagation()
          reveal({ label, value })
        }}
      >
        <Icon name="eye" size={15} />
      </button>
      <CopyButton value={value} label={label} />
    </span>
  )
}
