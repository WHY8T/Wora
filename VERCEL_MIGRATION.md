# Vercel migration notes

## Why the old deploy failed
Vercel auto-detects **every** `.ts` file under `/api` (including helper
files like `api/lib/push.ts`, `api/queries/connection.ts`, etc.) as its
own independent Serverless Function and type-checks each one in isolation
using strict `node16`/`nodenext` module resolution. That resolution mode
doesn't understand this project's `@contracts/*` / `@db/*` path aliases
and requires explicit `.js` extensions on relative imports — neither of
which the original code used, hence the wall of `TS2307` / `TS2835` errors.
This had nothing to do with `npm run build` itself (that step already
succeeded in your log).

## What changed
- `api/` → `server/`: all route/query/lib files moved out of `/api` so
  Vercel no longer treats each one as a separate function.
- `server/boot.ts` split into:
  - `server/app.ts` — the pure Hono app (routes only, no side effects).
    Used by the Vercel function, by `vite.config.ts`'s dev server plugin,
    and by tests.
  - `server/start.ts` — the persistent-server entrypoint (binds a port,
    serves `dist/public` statically, does the warm-up pings). Used only
    by Docker / local `node dist/start.js`. **Not used on Vercel.**
- New `api/[...path].ts` — the single Vercel Function. Wraps `server/app.ts`
  with `hono/vercel`'s `handle()`. Deliberately **not** set to the Edge
  runtime, because the `postgres` driver needs raw TCP sockets (Node.js
  runtime only).
- All imports inside `server/`, `contracts/`, `db/` rewritten to plain
  relative paths with explicit `.js` extensions (no more `@contracts/*`
  / `@db/*` aliases in server-side code) — this is what actually makes
  the code resolve correctly no matter which TS module-resolution mode
  a tool applies to it.
- `vercel.json` added: builds only the frontend (`vite build`) as the
  static output (`dist/public`), plus a SPA rewrite so client-side
  routing still works. The `/api/*` function is built separately by
  Vercel itself from `api/[...path].ts`.
- `package.json`: `build` now only bundles `server/start.ts` (for
  Docker); `start` runs `node dist/start.js`.
- `Dockerfile` and `vite.config.ts` (dev server plugin entry) updated
  to match the new paths. Docker deploys are unaffected otherwise.

## ⚠️ Files not present in the uploaded zip
The zip you gave me didn't include `api/notifications-router.ts`,
`api/push-router.ts`, `api/personal-books-router.ts`, or `api/lib/push.ts`,
even though your live build log shows them. Apply the same migration
to your real repo:

```bash
# from your repo root, after pulling latest main
mv api server
mkdir api
# (recreate api/[...path].ts and server/app.ts / server/start.ts as in this zip)
python3 fix_imports.py   # included in this zip — safe to re-run
```

`fix_imports.py` is a generic codemod (rewrites `@contracts/*` / `@db/*`
aliases to relative paths and adds missing `.js` extensions on relative
imports) — it will correctly handle those 4 extra files too, since it
works by pattern, not by filename. Run it once after moving `api/` to
`server/`, then diff/review before committing.

## Environment variables
Your `DATABASE_URL` must point at a Postgres instance reachable over
plain TCP from Vercel's network (e.g. Neon, Supabase, RDS with public
access) — Vercel Functions run in the Node.js runtime here, so this
works the same as any other Node host. Set `SESSION_SECRET`,
`DATABASE_URL`, `OWNER_EMAIL`, etc. in the Vercel project's Environment
Variables settings, same names as before.
