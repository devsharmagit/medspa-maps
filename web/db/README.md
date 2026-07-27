# Database provisioning (`web/db`)

Everything needed to bring a **fresh, empty** database up to the same state as
the working app: full schema + canonical taxonomy + one admin user. This
directory is the **single source of truth** for the schema — there is no second
copy under `scripts/`.

| File | What it is |
|------|------------|
| `schema.sql` | The schema: 5 extensions, 17 tables, 3 functions, 10 triggers, 78 indexes, and the `clinic_search_view` materialized view. A `pg_dump` baseline, so **plain `CREATE TABLE`** — meant to run **once, on an empty DB**. |
| `seed.sql`   | Canonical taxonomy only: **15 services + 10 concerns** (every `origin='seed'` row). Every statement is `ON CONFLICT DO NOTHING` → idempotent, re-runnable, never duplicates. |

The **admin user is not in `seed.sql`** (no credentials in git). It is seeded
from environment variables — see below.

There is **no global concern↔service link table**: `concern_services` was
dropped in the 2026-07-18 simplification. The mapping is now per-clinic
(`clinic_service_concerns`) and is populated by ingest, not by seeding.

## Requirements

- The target Postgres must allow `CREATE EXTENSION` for `postgis`, `pg_trgm`,
  `unaccent`, `pgcrypto`, `uuid-ossp`. **Neon supports all of these** out of the box.
- Env vars: `DATABASE_URL`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.

```bash
# .env (do NOT commit real values)
DATABASE_URL="postgresql://…prod…/neondb?sslmode=require"
SEED_ADMIN_EMAIL="admin@yourdomain.com"
SEED_ADMIN_PASSWORD="a-strong-password"
```

## Option A — one command (recommended)

```bash
bun run db:setup
```

`scripts/db-setup.ts` is the **only** entrypoint, and the same one `start.sh`
runs on container boot. It applies `schema.sql` *only* when the schema is absent
(guarded on `to_regclass('public.services')`), then always applies `seed.sql` and
upserts the admin user. Safe to run on every boot: on a provisioned database it
skips the schema and the seeds no-op.

Pass `--force` to apply `schema.sql` regardless of the guard — only meaningful
against an empty database.

## Option B — raw `psql` (no bun; hand to whoever provisions prod)

```bash
# 1) schema (once, on the empty DB)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/schema.sql

# 2) taxonomy (idempotent)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/seed.sql

# 3) admin user — bcrypt hash generated in-DB via pgcrypto ($2a$12$, bcryptjs-compatible)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -v admin_email="$SEED_ADMIN_EMAIL" -v admin_password="$SEED_ADMIN_PASSWORD" \
  -c "INSERT INTO admin_users (email, password_hash)
      VALUES (:'admin_email', crypt(:'admin_password', gen_salt('bf', 12)))
      ON CONFLICT (email) DO NOTHING;"
```

## Notes

- **This is not a migration tool.** It provisions an empty database and keeps
  seeds converged; it cannot bring an *existing* database onto a changed schema
  (new column, changed type). Until a migration ledger lands, schema changes go
  to production by hand. See `TASKS.md`.
- **Idempotency model:** `schema.sql` is a one-time baseline; re-running it on a
  populated DB errors, which is why `db-setup.ts` guards it. `seed.sql` and the
  admin insert are safe to re-run any number of times.
- Provisioning an empty DB leaves `clinic_search_view` correctly empty (it is
  refreshed at the end of `schema.sql`). Clinics/providers/reviews are added
  later via the admin UI or the AI website ingest.

### Regenerating these files

`schema.sql` — from a database whose schema is canonical. Three post-processing
steps are **mandatory**; skipping them is what left this file unable to build an
empty database for weeks:

```bash
PGD=/opt/homebrew/opt/postgresql@18/bin/pg_dump   # must be ≥ server major version
"$PGD" "$DEV_URL" --schema-only --no-owner --no-privileges \
  | grep -vE '^\\(un)?restrict '            `# 1. psql meta-commands are NOT SQL` \
  | grep -v '^COMMENT ON EXTENSION '        \
  | sed 's/^CREATE SCHEMA public;$/CREATE SCHEMA IF NOT EXISTS public;/' > db/schema.sql
echo 'REFRESH MATERIALIZED VIEW public.clinic_search_view;' >> db/schema.sql
# 2. re-add the CREATE EXTENSION block by hand (pg_dump does NOT emit it on Neon,
#    and the DDL calls public.uuid_generate_v4()/unaccent() and uses postgis types)
# 3. sanity-check: apply it to a throwaway empty database before committing
```

`seed.sql` — data-only, restricted to the curated taxonomy (`origin='seed'`);
never dump the AI-grown rows (`origin='ai'`), which belong to ingest:

```bash
"$PGD" "$DEV_URL" --data-only --no-owner --column-inserts --on-conflict-do-nothing \
  -t public.services -t public.concerns \
  | grep -vE "^\\\\(un)?restrict " > /tmp/seed-all.sql
# then keep only the origin='seed' rows
```
