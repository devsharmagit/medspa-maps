<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# CONSTRAINT: the app must build with NO database URL

Production infra injects `DATABASE_URL` (and `G99_DATABASE_URL`) **only at runtime**
(ECS Secrets Manager). They are **absent during `next build`**. The Docker build runs
URL-less on purpose (the dummy build ARGs were removed; root `.dockerignore` excludes
`**/.env`). So `next build` must never need a live database.

## Rules for new code

1. **Never open a DB connection at module scope / import time.** The pg pools in
   `src/lib/db.ts` are created lazily (`getPool()` / `getG99Pool()`), and the default
   `export default pool` is a `Proxy` that instantiates on first property access. Always
   query through the exports — `query()`, `queryOne()`, `withTransaction()`, or the
   default `pool` — **inside a function/request handler**, never at the top level of a
   module. A top-level `await query(...)`, `pool.connect()`, or `pool.on(...)` would run
   during build and reintroduce the crash.

2. **Any route that reads the DB must render at request time, not build time.** Add
   `export const dynamic = "force-dynamic"` to the page/route (or a layout that reads
   cookies/session, which makes the subtree dynamic). Do **not** rely on `revalidate`
   for DB-backed routes — an ISR route is prerendered at build with no DB and would ship
   an empty snapshot. This is why `src/app/sitemap.ts` and `src/app/llms.txt/route.ts`
   are `force-dynamic`.

3. **`generateStaticParams` and `force-static` pages must not touch the DB.** Source
   their params/content from in-repo registries (`src/lib/landing/*`, `src/lib/blog`,
   `src/content/*`) — the existing blog/treatment/condition pages are the pattern.

4. **`createPool()` still throws if `DATABASE_URL` is unset** — but only on first query,
   which is a real runtime misconfig. That is correct; do not "fix" it by adding a
   build-time fallback URL.

## How to verify a change didn't break the URL-less build

`bun run` auto-loads `.env`, so a plain `bun run build` silently re-injects the URL and
does NOT test this. Reproduce the real (Docker) build:

```bash
cd web && env -u DATABASE_URL -u G99_DATABASE_URL \
  NEXTAUTH_SECRET=build-secret INTERNAL_API_SECRET=build-secret \
  bun --env-file=/dev/null run build
```

It must exit 0 with no "DATABASE_URL environment variable is not set". Then confirm
DB-backed pages still SSR at runtime with a real URL present (`bun run start`, check that
clinic data appears in the raw server HTML of `/`, `/practices/[slug]`, `/search`).
