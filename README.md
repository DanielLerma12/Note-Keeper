# Notekeeper

A Google Keep–style notes organizer: React + Vite + TypeScript in the browser, and a small API (Hono + Prisma) that stores everything in Supabase, in the `notekeeper` schema.

- Imports plain text (`.txt`), Markdown (`.md`), Google Keep notes from Google Takeout (`.json`, one per note) and Notekeeper backups (the `.json` that *Export* downloads). Pick or drop several files at once.
- Each note is split into blocks: accounts (fields with hidden passwords you can show and copy), checklists, and text.
- Labels, colors, pinned notes, archive, trash, search, and grid or list view.
- Fields marked as secret are encrypted with AES-256-GCM by the API before they reach the database.

## Setup

`.env.local` (not committed; `.env.example` documents every variable):

```
DATABASE_URL=...           # Supabase transaction pooler (:6543)
DIRECT_URL=...             # session pooler (:5432), used by the Prisma CLI
NOTEKEEPER_SECRET_KEY=...  # 32 bytes in base64; without it the stored passwords can't be read
```

```bash
npm install          # also runs prisma generate
npm run db:push      # creates or updates the tables in the notekeeper schema
npm run dev          # Vite on :5173; the API runs inside Vite under /api
npm run build && npm start   # production build on :3001
```

The API has no login and, by default, only listens on `127.0.0.1`: it is meant for your own machine.

## Deploy on Render

`render.yaml` describes the service as a Blueprint. Before the first deploy:

1. Put the project in a GitHub/GitLab/Bitbucket repository.
2. Point it at a Postgres database you can reach from Render and run `create schema if not exists notekeeper;` once.
   Prisma does not create schemas for `multiSchema` projects, so `db push` will fail on a fresh database without it.
3. In Render, choose **New → Blueprint** and pick the repo. Then fill in `DATABASE_URL`, `DIRECT_URL` and
   `NOTEKEEPER_SECRET_KEY` (reuse the local key: with a different one the stored passwords become unreadable).
4. With a custom domain, list it in `ALLOWED_HOSTS` (comma-separated). The `*.onrender.com` subdomain is accepted
   automatically through `RENDER_EXTERNAL_HOSTNAME`.

The free plan has no `preDeployCommand` and sleeps after ~15 minutes of inactivity, so `prisma db push` runs inside
the build; on a paid plan move it to `preDeployCommand`.

> The API has no authentication. Anyone with the URL can read, edit and delete the notes and see the decrypted
> passwords, because the server decrypts them when responding; AES only protects them at rest. Put authentication in
> front before exposing it publicly (Basic Auth in the Hono middleware, or Cloudflare Access).
