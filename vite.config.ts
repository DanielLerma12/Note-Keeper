import { getRequestListener } from '@hono/node-server'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

function api(): Plugin {
  return {
    name: 'notekeeper-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        server
          .ssrLoadModule('/server/app.ts')
          .then(({ app }) => getRequestListener(app.fetch)(req, res))
          .catch(next)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), api()],
  server: {
    port: 5173,
    strictPort: true,
  },
})
