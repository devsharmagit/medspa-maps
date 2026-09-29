# Med Spa Maps — agent instructions

Vendor-neutral instructions for every AI coding agent on this repo.
Tool-specific files (`CLAUDE.md`, `GEMINI.md`, `.cursor/rules/`, `.windsurf/rules/`,
`.github/copilot-instructions.md`) are thin pointers to this file — **put new rules here**, not
in them, or they drift apart.

Repo documentation lives in **`docs/`** — see [docs/README.md](docs/README.md) for the index.
See `web/AGENTS.md` for Next.js 16 specifics and the no-database-URL build constraint.

---

## Shared memory vault — read this first, every session

All durable project knowledge lives **outside this repo**, in an Obsidian vault shared by every
assistant (Claude Code, Antigravity/Gemini, Cursor, VS Code Copilot, Windsurf):

```
/Users/devsharma/Documents/Obsidian Vault/medspa-maps
├── INDEX.md                    ← start here: overview + map of everything
├── 01-protocol/                AGENT-PROTOCOL · WORKING-WITH-DEV · MULTI-IDE-SETUP
├── 02-status/                  CURRENT-STATE · OPEN-PROBLEMS · TASK-LOG · phase 1 tasks
├── 03-technical/               SYSTEM-ARCHITECTURE · DATA-MODEL-AND-CATALOG · DECISIONS-LOG
│                               PATTERNS-AND-CONVENTIONS · GLOSSARY
├── 04-operations/              INFRA-AND-SECRETS (credentials) · RUNBOOKS
└── 05-claude-memories/         74 verbatim session memories
```

**At session start, read:**
1. `INDEX.md`
2. `01-protocol/AGENT-PROTOCOL.md` — the full rules and hard constraints
3. `02-status/CURRENT-STATE.md` — what is done, in flight, and blocked
4. `02-status/OPEN-PROBLEMS.md` — known bugs; check before declaring something broken

Then as the task requires: `03-technical/DATA-MODEL-AND-CATALOG.md` for DB/search/taxonomy work,
`04-operations/INFRA-AND-SECRETS.md` for anything touching a database or deploy,
`04-operations/RUNBOOKS.md` for recurring operations,
`03-technical/DECISIONS-LOG.md` for "why is it like this?",
`01-protocol/WORKING-WITH-DEV.md` for how the owner wants work done.

**At session end (mandatory):**
- Append an entry to `02-status/TASK-LOG.md` (newest first; template at the bottom of that file)
- Update `02-status/CURRENT-STATE.md`
- Record new decisions, patterns or bugs in `03-technical/` or `02-status/OPEN-PROBLEMS.md`

**Never leave important project knowledge only in tool-local memory or in a chat window.**

---

## The project in one paragraph

**Med Spa Maps** (`medspamaps.com`) is a US-only searchable directory of ~669 medical-spa
practices. Visitors pick a treatment or condition from a dropdown plus a location and get ranked
nearby practices. Practice content is not hand-entered — it is scraped and AI-extracted from each
practice's own website, reconciled against a deliberately small canonical catalog, and refreshed
monthly. Next.js 16 + React 19 + Bun + Postgres 18 (raw `pg`, no ORM), deployed as one Docker
container to AWS ECS.

---

## Hard constraints

1. **Do not break the "add website through AI (domain → DB)" pipeline.** Protected surface is
   listed in `docs/planning/TASKS.md` §3: `lib/ingest/`, `lib/scraper/`, `lib/admin/{website-import,clinic-save}.ts`,
   `lib/taxonomy/canonical.ts`, `lib/ai/*`, `lib/g99/*`, `admin/(protected)/add-website/`,
   `api/admin/clinics/*`.
2. **The treatment/condition catalog is CLOSED** — 22 treatments / 14 conditions. Ingest resolves
   a scraped name onto an already-active catalog row or **drops** it; it never creates one.
3. **Search is selection-only.** `?q=` must be an exact active slug — no free text, no fuzzy.
   The legacy redirect map is for **ingest only**, never search.
4. **Do not reorder `resolveSearchQuery`** to put the live catalog before `matchService`.
   It silently narrows every brand search. This was tried and reverted.
5. **US-only. No dentistry.** Both are enforced in search and in payload validation.
6. **Prod and local Neon are not in sync.** Treat any new column in a query as a prod-drift risk —
   degrade gracefully on Postgres `42703` / `42P01`. This has already caused a live 500.
7. **Route `maxDuration` must stay ≤ 300** or the Vercel preview build fails outright.
8. **Never set `INTERNAL_API_SECRET` in the Vercel project** — unset makes `/api/internal/*` fail
   closed, which is what stops anyone triggering a paid AI run from the public demo URL.
9. **`bun run` auto-loads `web/.env`.** Use `bun --env-file=/dev/null` to test the URL-less build.
10. **Pushing to `main` deploys to production. There is no staging.**

---

## Where things are

```
AGENTS.md                          this file — the single source of truth for agent rules
CLAUDE.md · GEMINI.md              root pointers (tools discover these by exact name)
.cursor/rules/ · .windsurf/rules/  pointers, directory format
.github/copilot-instructions.md    pointer
web/AGENTS.md · web/CLAUDE.md      nested scope — takes precedence for work inside web/
docs/                              all project documentation — see docs/README.md
  architecture/   ARCHITECTURE.md · medspa-map-db.md   ← system design + DB reference
  pipeline/       the scraping/AI pipeline + INGESTION-ISSUES.md
  planning/       TASKS.md · MARKETING-TASKS.md · cost estimates
  data/           SKIPPED-CLINICS.md · DUPLICATE-DOMAINS.md  ⚠️ parsed by code
  reference/      G99 schema mapping, content ops, SEO source copy
web/                               the Next.js app (public site, admin, all API routes)
cron-server/                       thin Bun scheduler; calls web over HTTP
scripts/g99/                       Python SSH-tunnel helpers for the Growth99 source DB
```

⚠️ `docs/data/SKIPPED-CLINICS.md` and `docs/data/DUPLICATE-DOMAINS.md` are **read by
`web/scripts/export-missed-websites.ts`** by path. Moving or renaming them breaks that report.

---

## Commands

```bash
cd web
bun install
bun run dev                       # http://localhost:3000
bunx tsc --noEmit                 # typecheck
bun run lint
bun --env-file=/dev/null run build   # reproduces the Docker build
bun run db:setup                  # idempotent provision + seed (NOT a migration tool)
```

**Verification gates that must stay green:**
`scripts/verify-core-links.ts` · `scripts/test-refresh-e2e.ts` · `scripts/verify-option-counts.mjs` ·
`scripts/verify-chat-search-parity.mjs` · `scripts/verify-clinic.ts <domain>`

---

## Verification etiquette

- Verify what is cheap and deterministic. **Do not instrument app code to force a transient UI
  state** — the owner runs those checks himself; make the fix and hand it over.
- `localhost:3000` may be another session's worktree, and they share one database. Check with
  `lsof -ti:3000` then `lsof -a -p <pid> -d cwd -Fn`, and run any parity harness twice.
- Prod writes are usually blocked from agent sandboxes. Hand over the exact command rather than
  claiming a prod step succeeded.
- Say plainly what you did **not** verify. The most expensive failures on this project came from
  confident claims about unchecked state.
