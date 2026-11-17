import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { app } from './app'

const PORT = Number(process.env.PORT ?? 3001)

// Locally we stay on the loopback interface. Hosting platforms (Render, Fly, Docker)
// route traffic to the container, so they need us to bind 0.0.0.0 via HOST.
const HOSTNAME = process.env.HOST ?? '127.0.0.1'

app.use('/*', serveStatic({ root: './dist' }))
app.get('*', serveStatic({ path: './dist/index.html' }))

serve({ fetch: app.fetch, port: PORT, hostname: HOSTNAME }, ({ port }) => {
  console.log(`[notekeeper] listening on http://${HOSTNAME}:${port}`)
})
