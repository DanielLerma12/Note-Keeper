import { useState, type FormEvent } from 'react'
import { api } from '../api'
import { Icon } from '../icons'
import type { SessionInfo } from '../types'

export function SignIn({ onSignedIn }: { onSignedIn: (session: SessionInfo) => void }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!identifier.trim()) return setError('Enter your username or email')
    if (password.length < 8) return setError('Password must be at least 8 characters')
    setError('')
    setSubmitting(true)
    try {
      onSignedIn(await api.signIn(identifier.trim(), password))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in")
      setSubmitting(false)
    }
  }

  return (
    <div className="signin-page">
      <form className="signin-card" onSubmit={submit} noValidate>
        <div className="signin-brand">
          <span className="brand-icon">
            <Icon name="notebook" size={22} />
          </span>
          <span className="brand-name">Notekeeper</span>
        </div>
        <h1>Sign in</h1>

        <label className="signin-field">
          <span>Username or email</span>
          <input
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </label>

        <label className="signin-field">
          <span>Password</span>
          <span className="signin-password">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="icon-btn tiny"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((v) => !v)}
            >
              <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
            </button>
          </span>
        </label>

        {error && (
          <p className="signin-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="primary-btn large signin-submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
