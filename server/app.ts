import { Hono } from 'hono'
import { AuthError, getSessionState, signIn, signOut, verifyPassword, type AuthUser } from './auth'
import { BadRequest, deleteNote, emptyTrash, listNotes, parseNote, saveNotes } from './notes'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

function normalizeHost(header: string) {
  const value = header.trim().toLowerCase()
  const ipv6 = /^\[([^\]]+)\](?::\d+)?$/.exec(value)
  if (ipv6) return `[${ipv6[1]}]`
  return value.replace(/:\d+$/, '')
}

// Extra hostnames the API accepts: the public domain of the deployment.
// Render exposes the default onrender.com subdomain as RENDER_EXTERNAL_HOSTNAME,
// so custom domains are the only thing that needs ALLOWED_HOSTS.
const ALLOWED_HOSTS = new Set(
  [process.env.ALLOWED_HOSTS, process.env.RENDER_EXTERNAL_HOSTNAME]
    .flatMap((value) => (value ?? '').split(','))
    .map((value) => normalizeHost(value))
    .filter(Boolean),
)

function isAllowedHost(header: string | undefined) {
  if (!header) return false
  const host = normalizeHost(header)
  return LOCAL_HOSTS.has(host) || ALLOWED_HOSTS.has(host)
}

export const app = new Hono<{ Variables: { user: AuthUser } }>()

app.use('/api/*', async (c, next) => {
  if (!isAllowedHost(c.req.header('host'))) return c.json({ error: 'Host not allowed' }, 403)
  const method = c.req.method
  if (method !== 'GET' && method !== 'DELETE' && !c.req.header('content-type')?.startsWith('application/json')) {
    return c.json({ error: 'Expected JSON' }, 415)
  }
  await next()
})

app.post('/api/auth/signin', async (c) => c.json(await signIn(c, await c.req.json().catch(() => null))))

app.post('/api/auth/signout', async (c) => {
  await signOut(c)
  return c.json({ ok: true })
})

app.get('/api/auth/me', async (c) => {
  const state = await getSessionState(c)
  if (state.status === 'unavailable') return c.json({ error: "Couldn't verify the session" }, 503)
  if (state.status === 'none') return c.json({ error: 'Not signed in' }, 401)
  return c.json({ user: state.user, sessionEndsAt: state.sessionEndsAt })
})

app.post('/api/auth/verify-password', async (c) => {
  const state = await getSessionState(c)
  if (state.status === 'unavailable') return c.json({ error: "Couldn't verify the session" }, 503)
  if (state.status === 'none') return c.json({ error: 'Not signed in' }, 401)
  await verifyPassword(state.user, await c.req.json().catch(() => null))
  return c.json({ ok: true })
})

app.use('/api/notes/*', async (c, next) => {
  const state = await getSessionState(c)
  if (state.status === 'unavailable') return c.json({ error: "Couldn't verify the session" }, 503)
  if (state.status === 'none') return c.json({ error: 'Not signed in' }, 401)
  c.set('user', state.user)
  await next()
})

app.get('/api/notes', async (c) => c.json(await listNotes(c.var.user.id)))

app.put('/api/notes/:id', async (c) => {
  const note = parseNote(await c.req.json())
  if (note.id !== c.req.param('id')) throw new BadRequest('The id does not match')
  await saveNotes(c.var.user.id, [note])
  return c.json({ ok: true })
})

app.post('/api/notes/bulk', async (c) => {
  const body = await c.req.json()
  if (!Array.isArray(body)) throw new BadRequest('Expected a list of notes')
  const notes = body.map(parseNote)
  await saveNotes(c.var.user.id, notes)
  return c.json({ ok: true, count: notes.length })
})

app.delete('/api/notes/trash', async (c) => c.json({ ok: true, count: await emptyTrash(c.var.user.id) }))

app.delete('/api/notes/:id', async (c) => {
  await deleteNote(c.var.user.id, c.req.param('id'))
  return c.json({ ok: true })
})

app.onError((error, c) => {
  if (error instanceof BadRequest) return c.json({ error: error.message }, 400)
  if (error instanceof AuthError) return c.json({ error: error.message }, error.status)
  console.error('[api]', error)
  return c.json({ error: 'Server error' }, 500)
})
