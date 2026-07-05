# Database provisioning (`web/db`)

Everything needed to bring up a **fresh, empty** production database to the same
state as the working app: full schema + canonical taxonomy + one admin user.

| File | What it is |
|------|------------|
| `schema.sql` | Exact schema exported from the canonical DB — 6 extensions, all tables, 3 functions, 14 triggers, all indexes, and the `clinic_search_view` materialized view. **Run once on an empty DB.** |
| `seed.sql`   | Canonical taxonomy only: **15 services, 10 concerns, 34 concern↔service links.** Every row is `ON CONFLICT DO NOTHING` → idempotent, re-runnable, never duplicates. |

The **admin user is not in `seed.sql`** (no credentials in git). It is seeded
from environment variables — see below.

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
bun run db:setup        # = db:migrate (schema) then db:seed (taxonomy + admin)
```

- `db:migrate` skips itself if the schema is already present (safe to re-run).
- `db:seed` is fully idempotent (`ON CONFLICT DO NOTHING`); re-running never
  duplicates and never overwrites an existing admin password.

Run them individually if you prefer: `bun run db:migrate`, then `bun run db:seed`.

## Option B — raw `psql` (no Node/bun; hand to whoever provisions prod)

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

- **Idempotency model:** `schema.sql` is a one-time baseline (plain `CREATE …`,
  so re-running it on a populated DB errors — that's expected; the `db:migrate`
  runner guards against it). `seed.sql` and the admin insert are safe to re-run
  any number of times.
- Provisioning an empty DB leaves `clinic_search_view` correctly empty (it is
  refreshed at the end of `schema.sql`). Clinics/providers/reviews are added
  later via the admin UI or the G99 import.
- **Regenerating these files** when the canonical schema/taxonomy changes
  (requires a `pg_dump` whose major version ≥ the server's):

  ```bash
  PGD=/opt/homebrew/opt/postgresql@18/bin/pg_dump   # must be ≥ server major version
  # schema — then strip the pg18 \restrict/\unrestrict + COMMENT ON EXTENSION lines
  "$PGD" "$DEV_URL" --schema-only --no-owner --no-privileges \
    | grep -vE '^\\(un)?restrict ' | grep -v '^COMMENT ON EXTENSION ' > db/schema.sql
  echo 'REFRESH MATERIALIZED VIEW public.clinic_search_view;' >> db/schema.sql
  # taxonomy data
  "$PGD" "$DEV_URL" --data-only --no-owner --column-inserts --on-conflict-do-nothing \
    -t public.services -t public.concerns -t public.concern_services > db/seed.sql
  ```
