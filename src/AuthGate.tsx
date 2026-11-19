import { useCallback, useEffect, useState } from 'react'
import App from './App'
import { api, ApiError, SESSION_LOST } from './api'
import { SignIn } from './components/SignIn'
import { useToast } from './components/toastContext'
import type { SessionInfo } from './types'

const DEADLINE_GRACE_MS = 1000

type AuthState = { status: 'loading' } | { status: 'error' } | { status: 'signed-out' } | { status: 'signed-in'; session: SessionInfo }

export default function AuthGate() {
  const toast = useToast()
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  const check = useCallback(
    () =>
      api.me().then(
        (session) => setState({ status: 'signed-in', session }),
        (error) => setState(error instanceof ApiError && error.status === 401 ? { status: 'signed-out' } : { status: 'error' }),
      ),
    [],
  )

  useEffect(() => {
    check()
  }, [check])

  useEffect(() => {
    const lost = () => setState((s) => (s.status === 'signed-in' ? { status: 'signed-out' } : s))
    window.addEventListener(SESSION_LOST, lost)
    return () => window.removeEventListener(SESSION_LOST, lost)
  }, [])

  // Time-limited accounts: when the session runs out, ask the server (which ends it) and leave.
  const endsAt = state.status === 'signed-in' ? state.session.sessionEndsAt : null
  useEffect(() => {
    if (!endsAt) return
    const timer = window.setTimeout(
      () =>
        api.me().then(
          (session) => setState({ status: 'signed-in', session }),
          (error) => {
            if (error instanceof ApiError && error.status === 401) {
              setState({ status: 'signed-out' })
              toast('Your session time is over')
            }
          },
        ),
      Math.max(endsAt - Date.now(), 0) + DEADLINE_GRACE_MS,
    )
    return () => window.clearTimeout(timer)
  }, [endsAt, toast])

  const signOut = useCallback(async () => {
    try {
      await api.signOut()
    } finally {
      setState({ status: 'signed-out' })
    }
  }, [])

  if (state.status === 'loading') {
    return (
      <div className="empty">
        <div className="spinner" aria-label="Loading" />
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="empty">
        <p>Couldn't verify your session</p>
        <button type="button" className="ghost-btn" onClick={() => (setState({ status: 'loading' }), check())}>
          Try again
        </button>
      </div>
    )
  }

  if (state.status === 'signed-out') {
    return <SignIn onSignedIn={(session) => setState({ status: 'signed-in', session })} />
  }

  return <App key={state.session.user.id} session={state.session} onSignOut={signOut} />
}
