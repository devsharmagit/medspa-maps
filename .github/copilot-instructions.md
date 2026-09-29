# Med Spa Maps — Copilot instructions

**Follow `AGENTS.md` at the repository root.** It is the single source of truth for every AI
assistant on this project — do not add rules here, add them to `AGENTS.md`.

**Shared memory vault:** `/Users/devsharma/Documents/Obsidian Vault/medspa-maps`

- **Before starting:** read `INDEX.md`, `01-protocol/AGENT-PROTOCOL.md`,
  `02-status/CURRENT-STATE.md`, `02-status/OPEN-PROBLEMS.md`.
- **On completion:** append to `02-status/TASK-LOG.md` and update `02-status/CURRENT-STATE.md`.

Key constraints: the treatment/condition catalog is closed (22 treatments / 14 conditions);
search is selection-only; prod and dev databases are not in sync, so degrade on Postgres
`42703` / `42P01`; pushing to `main` deploys to production.

See `web/AGENTS.md` for Next.js 16 specifics and the no-database-URL build constraint.
