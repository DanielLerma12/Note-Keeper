// Time-limited accounts (the public tester): a session lasts `minutes` from the
// moment the password was entered, and the account can sign in again only
// `cooldownHours` after its last NoteKeeper sign-in. Same rules as HobbieVault,
// but the limit and the last sign-in live in notekeeper.users so each app
// keeps its own clock.

export type SessionLimit = { minutes: number; cooldownHours: number }

const DEFAULT_COOLDOWN_HOURS = 24

const isPositive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0

export function readSessionLimit(row: {
  session_limit_minutes: number | null
  session_cooldown_hours: number | null
}): SessionLimit | null {
  if (!isPositive(row.session_limit_minutes)) return null
  return {
    minutes: row.session_limit_minutes,
    cooldownHours: isPositive(row.session_cooldown_hours) ? row.session_cooldown_hours : DEFAULT_COOLDOWN_HOURS,
  }
}

/** When the session must end, from the sign-in time stamped in the JWT (`amr`). 0 = already over. */
export function sessionDeadlineMs(amr: unknown, limit: SessionLimit | null): number | null {
  if (!limit) return null
  const stamps = (Array.isArray(amr) ? amr : [])
    .map((entry) => (entry && typeof entry === 'object' ? (entry as { timestamp?: unknown }).timestamp : undefined))
    .filter((stamp): stamp is number => typeof stamp === 'number')
  if (stamps.length === 0) return 0
  return Math.min(...stamps) * 1000 + limit.minutes * 60_000
}

export function cooldownRemainingMs(lastSignInAt: Date | null, limit: SessionLimit, now = Date.now()) {
  if (!lastSignInAt) return 0
  return Math.max(0, lastSignInAt.getTime() + limit.cooldownHours * 3_600_000 - now)
}

export function formatWait(ms: number) {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours} h`
  return `${hours} h ${minutes} min`
}

/** Reads the `session_id` claim of an access token Supabase just returned. */
export function sessionIdFromAccessToken(token: string): string | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { session_id?: unknown }
    return typeof json.session_id === 'string' ? json.session_id : null
  } catch {
    return null
  }
}
