import { createServerClient } from '@supabase/ssr'
import { createClient, isAuthRetryableFetchError } from '@supabase/supabase-js'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { prisma } from './prisma'
import { cooldownRemainingMs, formatWait, readSessionLimit, sessionDeadlineMs, sessionIdFromAccessToken } from './sessionLimit'

// Sign-in works like HobbieVault: the same Supabase accounts and passwords, a
// row in notekeeper.users decides who can use the app, and the session lives
// in cookies the server reads (the browser never sees the Supabase keys).

export type AuthUser = { id: string; email: string; username: string; authVersion: number }

export type SessionState =
  | { status: 'valid'; user: AuthUser; sessionEndsAt: number | null }
  | { status: 'none' }
  | { status: 'unavailable' }

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 403 | 429 | 503,
  ) {
    super(message)
  }
}

// Own cookie name so the Notekeeper session never collides with HobbieVault's
// (both apps run on localhost in development, and cookies ignore the port).
const SESSION_COOKIE = 'notekeeper-auth'
// The auth_version the session signed in with: signing out bumps it, which ends
// the session on every other device too.
const VERSION_COOKIE = 'notekeeper-av'

const PROFILE_TTL_MS = 30_000
const REVOCATION_RECHECK_MS = 10 * 60_000
const INVALID_CREDENTIALS = 'Invalid username or password'

function env(name: 'SUPABASE_URL' | 'SUPABASE_ANON_KEY') {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

function isHttps(c: Context) {
  return c.req.header('x-forwarded-proto') === 'https' || new URL(c.req.url).protocol === 'https:'
}

function cookieOptions(c: Context) {
  return { path: '/', httpOnly: true, sameSite: 'Lax', secure: isHttps(c) } as const
}

function createSupabase(c: Context) {
  return createServerClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    cookieOptions: { name: SESSION_COOKIE },
    cookies: {
      getAll: () => Object.entries(getCookie(c)).map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value, options } of cookies) {
          setCookie(c, name, value, { ...cookieOptions(c), maxAge: options.maxAge, expires: options.expires })
        }
      },
    },
  })
}

type Profile = {
  id: string
  email: string
  username: string
  auth_version: number
  session_limit_minutes: number | null
  session_cooldown_hours: number | null
  last_sign_in_at: Date | null
  session_id: string | null
}

const profileSelect = {
  id: true,
  email: true,
  username: true,
  auth_version: true,
  session_limit_minutes: true,
  session_cooldown_hours: true,
  last_sign_in_at: true,
  session_id: true,
} as const

const profileCache = new Map<string, { value: Profile | null; expiresAtMs: number }>()

async function loadProfile(id: string): Promise<Profile | null> {
  const cached = profileCache.get(id)
  if (cached && Date.now() < cached.expiresAtMs) return cached.value
  const value = await prisma.users.findUnique({ where: { id }, select: profileSelect })
  if (profileCache.size > 50) profileCache.clear()
  profileCache.set(id, { value, expiresAtMs: Date.now() + PROFILE_TTL_MS })
  return value
}

// Supabase session id -> when getUser() last confirmed it was not revoked.
const revocationChecks = new Map<string, number>()

const toUser = (p: Profile): AuthUser => ({ id: p.id, email: p.email, username: p.username, authVersion: p.auth_version })

async function endSession(c: Context, supabase: ReturnType<typeof createSupabase>) {
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch (error) {
    console.warn('[auth] could not close the session:', error)
  }
  deleteCookie(c, VERSION_COOKIE, cookieOptions(c))
}

export async function getSessionState(c: Context): Promise<SessionState> {
  const supabase = createSupabase(c)
  const { data, error } = await supabase.auth.getClaims()
  if (error) return isAuthRetryableFetchError(error) ? { status: 'unavailable' } : { status: 'none' }
  const claims = data?.claims
  if (!claims?.sub) return { status: 'none' }

  const profile = await loadProfile(claims.sub)
  if (!profile || getCookie(c, VERSION_COOKIE) !== String(profile.auth_version)) {
    await endSession(c, supabase)
    return { status: 'none' }
  }

  const limit = readSessionLimit(profile)
  const deadline = sessionDeadlineMs(claims.amr, limit)
  if (deadline !== null && Date.now() >= deadline) {
    await endSession(c, supabase)
    return { status: 'none' }
  }

  // Time-limited accounts only accept the session Notekeeper itself opened.
  if (limit && (!profile.session_id || claims.session_id !== profile.session_id)) {
    await endSession(c, supabase)
    return { status: 'none' }
  }

  // getClaims() checks the signature locally; every few minutes also ask Supabase
  // whether the session was revoked (e.g. signed out everywhere from HobbieVault).
  const sessionId = typeof claims.session_id === 'string' ? claims.session_id : claims.sub
  if (Date.now() >= (revocationChecks.get(sessionId) ?? 0)) {
    const { data: fresh, error: userError } = await supabase.auth.getUser()
    if (!fresh.user) {
      if (isAuthRetryableFetchError(userError)) return { status: 'unavailable' }
      revocationChecks.delete(sessionId)
      await endSession(c, supabase)
      return { status: 'none' }
    }
    if (revocationChecks.size > 200) revocationChecks.clear()
    revocationChecks.set(sessionId, Date.now() + REVOCATION_RECHECK_MS)
  }

  return { status: 'valid', user: toUser(profile), sessionEndsAt: deadline }
}

export async function signIn(c: Context, input: unknown) {
  const body = (input ?? {}) as { identifier?: unknown; password?: unknown }
  const identifier = typeof body.identifier === 'string' ? body.identifier.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!identifier) throw new AuthError('Enter your username or email', 400)
  if (password.length < 8) throw new AuthError('Password must be at least 8 characters', 400)

  const profile = await prisma.users.findFirst({
    where: identifier.includes('@')
      ? { email: { equals: identifier, mode: 'insensitive' } }
      : { username: identifier.toLowerCase() },
    select: profileSelect,
  })

  const limit = profile ? readSessionLimit(profile) : null
  if (profile && limit) {
    const wait = cooldownRemainingMs(profile.last_sign_in_at, limit)
    if (wait > 0) {
      throw new AuthError(
        `This account has already used its ${limit.minutes} min session. Try again in ${formatWait(wait)}.`,
        403,
      )
    }
  }

  // Unknown usernames still go through Supabase so the answer takes the same time.
  const email = profile?.email ?? (identifier.includes('@') ? identifier : 'unknown-user@invalid.example')
  const supabase = createSupabase(c)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    if (error.status === 429) throw new AuthError('Too many attempts. Try again in a few minutes.', 429)
    if (isAuthRetryableFetchError(error)) throw new AuthError("Couldn't reach the server. Try again.", 503)
    throw new AuthError(INVALID_CREDENTIALS, 401)
  }

  if (!profile || data.user.id !== profile.id) {
    await endSession(c, supabase)
    throw new AuthError(profile ? INVALID_CREDENTIALS : 'This account has no notebook yet', 403)
  }

  const sessionId = sessionIdFromAccessToken(data.session.access_token)
  if (limit && !sessionId) {
    await endSession(c, supabase)
    throw new AuthError("Couldn't start the session. Try again.", 503)
  }

  const now = new Date()
  await prisma.users.update({
    where: { id: profile.id },
    data: { last_sign_in_at: now, session_id: sessionId },
  })
  profileCache.delete(profile.id)
  setCookie(c, VERSION_COOKIE, String(profile.auth_version), { ...cookieOptions(c), maxAge: 400 * 24 * 3600 })

  return {
    user: toUser(profile),
    sessionEndsAt: limit ? now.getTime() + limit.minutes * 60_000 : null,
  }
}

export async function signOut(c: Context) {
  const state = await getSessionState(c)
  if (state.status === 'valid') {
    await prisma.users.update({
      where: { id: state.user.id },
      data: { auth_version: { increment: 1 }, updated_at: new Date() },
    })
    profileCache.delete(state.user.id)
  }
  await endSession(c, createSupabase(c))
}

// Re-checks the password of the signed-in user (used before showing a secret).
// It uses a throwaway Supabase client so the browser session and cookies are
// left untouched, and closes the extra session it opens.
export async function verifyPassword(user: AuthUser, input: unknown) {
  const body = (input ?? {}) as { password?: unknown }
  const password = typeof body.password === 'string' ? body.password : ''
  if (!password) throw new AuthError('Enter your password', 400)

  const client = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data, error } = await client.auth.signInWithPassword({ email: user.email, password })
  if (error) {
    if (error.status === 429) throw new AuthError('Too many attempts. Try again in a few minutes.', 429)
    if (isAuthRetryableFetchError(error)) throw new AuthError("Couldn't reach the server. Try again.", 503)
    throw new AuthError('Wrong password', 401)
  }
  if (data.user.id !== user.id) throw new AuthError('Wrong password', 401)
  await client.auth.signOut({ scope: 'local' }).catch(() => {})
}
