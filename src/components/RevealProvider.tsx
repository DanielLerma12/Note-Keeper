import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { api } from '../api'
import { Icon } from '../icons'
import { CopyButton } from './Secret'
import { RevealContext, type RevealRequest } from './revealContext'

type Step = { kind: 'password'; request: RevealRequest } | { kind: 'secret'; request: RevealRequest }

export function RevealProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<Step | null>(null)
  const close = () => setStep(null)

  useEffect(() => {
    if (!step) return
    // Capture phase, so Escape closes only this dialog and not the note editor under it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setStep(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [step])

  return (
    <RevealContext.Provider value={(request) => setStep({ kind: 'password', request })}>
      {children}
      {step && (
        <div className="modal-backdrop reveal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          {step.kind === 'password' ? (
            <PasswordPrompt label={step.request.label} onCancel={close} onVerified={() => setStep({ kind: 'secret', request: step.request })} />
          ) : (
            <SecretDialog request={step.request} onClose={close} />
          )}
        </div>
      )}
    </RevealContext.Provider>
  )
}

function PasswordPrompt({ label, onCancel, onVerified }: { label: string; onCancel: () => void; onVerified: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!password) return setError('Enter your password')
    setError('')
    setBusy(true)
    try {
      await api.verifyPassword(password)
      onVerified()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't verify the password")
      setBusy(false)
    }
  }

  return (
    <form className="reveal-dialog" role="dialog" aria-modal="true" aria-label="Confirm your password" onSubmit={submit}>
      <h2>Confirm your password</h2>
      <p>Enter your account password to view {label ? `“${label}”` : 'this secret'}.</p>
      <input
        type="password"
        autoComplete="current-password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        aria-label="Password"
      />
      {error && (
        <p className="signin-error" role="alert">
          {error}
        </p>
      )}
      <div className="reveal-actions">
        <button type="button" className="ghost-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="primary-btn" disabled={busy}>
          {busy ? 'Checking…' : 'Show'}
        </button>
      </div>
    </form>
  )
}

// Grow the field to fit its text so long values wrap instead of being cut off.
function fit(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function SecretDialog({ request, onClose }: { request: RevealRequest; onClose: () => void }) {
  const [value, setValue] = useState(request.value)
  return (
    <div className="reveal-dialog" role="dialog" aria-modal="true" aria-label={request.label || 'Secret'}>
      <h2>{request.label || 'Secret'}</h2>
      <div className="reveal-value">
        <textarea
          ref={fit}
          rows={1}
          autoComplete="off"
          spellCheck={false}
          readOnly={!request.onChange}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            request.onChange?.(e.target.value)
            fit(e.currentTarget)
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
          onFocus={(e) => e.currentTarget.select()}
        />
        <CopyButton value={value} label={request.label} />
      </div>
      <div className="reveal-actions">
        <button type="button" className="primary-btn" onClick={onClose} autoFocus>
          <Icon name="eyeOff" size={15} /> Hide
        </button>
      </div>
    </div>
  )
}
