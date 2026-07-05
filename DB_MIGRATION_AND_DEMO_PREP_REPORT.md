# Demo Prep Report — Script Cleanup, DB Migration & Seeding

**Date:** 2026-07-03 · **Target:** Monday demo · **Author:** research pass (no code changed)

This report answers three things you asked:
1. Which scripts in `web/scripts/` can be removed.
2. Whether to adopt **Prisma** or **Drizzle** (or stay on raw `pg`) for migrations + models.
3. How to build an **idempotent migration + seed** (tables, admin user, 15 treatments, 10 concerns) that is safe to re-run and never duplicates.

---

## 0. TL;DR — the recommendation

| Question | Answer |
|---|---|
| **Prisma or Drizzle?** | **Neither before Monday.** Your schema is a PostgreSQL power-user schema (PostGIS, plpgsql triggers, a materialized view, `pg_trgm`/`unaccent`, full-text search). Migrating the data layer is a multi-day, high-risk change. If/when you do adopt an ORM later, choose **Drizzle**, not Prisma — reasons in §3. |
| **How to migrate + seed a fresh DB?** | Consolidate the DDL you already have (the `migrate-*.ts` scripts are *already* idempotent) into **one `db:migrate` command**, and one **`db:seed`** command that uses `ON CONFLICT` upserts. §4. |
| **Idempotency / no duplicates?** | Already solvable with what's in the repo: `UNIQUE(slug)` on services & concerns, `UNIQUE(email)` on admin, `UNIQUE(concern_id, service_id)` on the join table → `ON CONFLICT DO NOTHING/UPDATE`. §4.2. |
| **Biggest risk for the demo** | The 15 treatments + 10 concerns already have **full editorial content (descriptions, FAQs) in the live Neon DB**, and that content is **not fully reproducible from `canonical.ts`**. A naive "seed a fresh DB from code" produces a barebones site. Fix: seed editorial content from a **data export of the current DB**, or just **Neon-branch the current DB** for the demo. §4.4. |
| **Scripts** | ~44 files. ~18 are safe to delete now, ~12 hold DDL/seed logic to *harvest then remove*, ~10 stay. §2. |

**One-line plan:** Don't touch the ORM. Consolidate migrations into one idempotent `db:setup` command, seed admin + taxonomy + **exported editorial content** with `ON CONFLICT`, and provision the demo "production" DB by **branching the already-curated Neon DB**. Do the Drizzle migration *after* the demo.

---

## 1. Current state (what actually exists)

### 1.1 The database already exists and is fully populated
The `DATABASE_URL` you gave (Neon, Postgres **18**) is not empty — it's your curated dataset:

| Table | Rows | | Table | Rows |
|---|---|---|---|---|
| admin_users | 1 (`admin@medspa.com`) | | concerns | 10 |
| services (treatments) | 15 | | concern_services | 34 |
| clinics | 15 | | businesses | 17 |
| providers | 12 | | reviews | 8 |

So "we don't have a production database" is really "we don't have a *repeatable way to stand one up*." The data itself already exists and is demo-ready.

### 1.2 The schema is Postgres-heavy (this drives the ORM decision)
- **19 base tables** + **1 materialized view** (`clinic_search_view`, refreshed manually, uses `ARRAY_AGG(...) FILTER`).
- **6 extensions:** `postgis`, `pg_trgm`, `unaccent`, `pgcrypto`, `uuid-ossp`, `plpgsql`.
- **PostGIS in active use:** `clinics.geo` and `clinic_locations.geo` are `geography(Point,4326)` with **GiST** indexes; app code writes them via `ST_SetSRID(ST_MakePoint(...))` (`src/lib/admin/clinic-save.ts`, locations routes).
- **3 plpgsql functions + 14 triggers:** `set_updated_at()` (13 tables), `slugify()` (uses `unaccent`), and **`refresh_clinic_rating()`** — a cross-table rollup that recomputes `clinics.avg_rating`/`review_count` on every review change. This is real business logic living in the DB.
- **Full-text search:** `to_tsvector` GIN indexes; plus `pg_trgm`/`ILIKE` fuzzy matching used across search, chat, treatments.
- **Types:** 9 `jsonb` columns, 2 `text[]` columns, `NUMERIC(p,s)`, `CHECK` constraints, **partial** indexes (`WHERE is_primary`), **functional** indexes (`lower(city)`), composite & GIN/GiST indexes (~100 indexes total incl. PostGIS internals).

### 1.3 There is no migration framework today
- DB access: `src/lib/db.ts` — a singleton `pg.Pool` (max 10, SSL `rejectUnauthorized:false`) with `query()`, `queryOne()`, `withTransaction()` helpers, plus a lazy G99 read pool.
- "Migrations" = a pile of **~13 hand-run `migrate-*.ts` scripts** in `web/scripts/`, executed manually via `bun`. Good news: they're mostly **already idempotent** (`CREATE TABLE/INDEX IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, transaction-wrapped). Bad news: there's no ordering, no ledger of what's applied, and `migrate.ts` is a **destructive drop-all-and-rebuild** baseline.
- Data layer: **~100+ raw-SQL call-sites across ~28 files, ~300 hand-written SQL statements.** Many are simple; the important ones (spatial search, FTS, the matview, rating rollups) are hand-tuned and Postgres-specific.

---

## 2. Task A — Script cleanup (`web/scripts/`, ~44 files)

**Order matters:** several "removable" scripts contain the only copy of DDL or seed logic you want to keep. **Harvest first, then delete.**

### 2.1 KEEP — operational / referenced
| File | Why keep |
|---|---|
| `src/lib/taxonomy/canonical.ts` | Source of truth for the 15 services + 10 concerns + 34 mappings. Core to seeding. |
| `seed.ts` | Seeds the admin user. Referenced in `package.json`. (Refactor to read from env — see §4.2.) |
| `seed-canonical.ts` | Idempotent upsert of taxonomy from `canonical.ts`. Becomes part of `db:seed`. |
| `reconcile-taxonomy.ts` | Enforces the locked Phase-0 taxonomy (15/10). Keep as a maintenance tool. |
| `verify-taxonomy.ts`, `verify-ingest.ts`, `verify-match-queue.ts`, `verify-match-queue-summary.ts`, `verify-admin-libs.ts` | Read-only audits. Harmless, useful. |

### 2.2 HARVEST then remove — DDL scattered across one-off migrations
Fold the `CREATE`/`ALTER` statements from these into a single consolidated migration (§4.1), then delete the individual files:

`migrate.ts` (baseline schema), `migrate-concerns.ts`, `migrate-providers.ts`, `migrate-locations.ts`, `migrate-clinic-concerns.ts`, `migrate-provider-concerns.ts`, `migrate-clinic-page.ts`, `migrate-clinic-stats.ts`, `migrate-treatments.ts`, `migrate-service-faqs.ts`, `migrate-match-queue.ts`, `migrate-treatment-changes.ts`, and the SQL files `create-leads-table.sql` + `run-leads-migration.ts`, `add-provider-card-fields.sql`.

> Note: `migrate-providers.ts` and `migrate-treatment-changes.ts` are wired into `package.json` scripts — remove those npm aliases when you consolidate.

### 2.3 DELETE now — throwaway / dev-only / fake data
- **Test & eval harnesses:** `test-scraper.ts`, `test-rescrape-e2e.ts`, `test-rescrape-live.ts`, `test-rescrape-serve.ts`, `test-g99-overlay.ts`, `eval-scrape-accuracy.ts`.
- **Hardcoded-URL one-offs:** `ingest-all.ts`, `ingest-sites.ts`, `enrich-clinic.ts`.
- **One-time backfills (already applied):** `backfill-clinic-slugs.ts`, `geocode-clinics.ts`, `fix-multilocation-clinics.ts`.
- **Dev inspection:** `list-services.ts`.
- **⚠️ Fake/dummy data — do NOT run against the demo DB:** `seed-data.ts`, `seed-providers.ts`, `seed-provider-card-data.sql`.

### 2.4 DECISION / verify before deleting
- **`demo-setup.ts`** — seeds deliberately-wrong treatments to show the daily re-scrape "added/removed" diff. **Keep only if the rescrape diff is in the Monday demo.** Otherwise delete.
- **`seed-faqs.ts`, `seed-remaining-faqs.ts`, `seed-treatments.ts`** — these loaded the long-form editorial content. **Verify that content is captured in your new seed (§4.4) before deleting**, or you lose the ability to reproduce the rich pages.
- **`reset-db.ts`** — truncates all data (preserves admin). **Dangerous near a demo.** Either delete, or guard it to refuse a production `DATABASE_URL`. Do not leave it one command away from wiping the demo DB.

---

## 3. Task B — Prisma vs Drizzle vs stay-on-`pg`

You asked "if we use this, what happens; if we use that, what happens." Here it is honestly.

### 3.1 The deciding factor: your schema fights ORMs, and PostGIS decides it
No mainstream Node ORM fully abstracts PostGIS. Your spatial queries, the materialized view, and the rating-rollup trigger **stay as raw SQL no matter which tool you pick.** So the question isn't "ORM vs SQL" — it's "which tool coexists best with the ~300 raw statements you'll keep."

### 3.2 Option A — Prisma
**What you gain:** best-in-class migration workflow (`prisma migrate dev`/`deploy`), `prisma db seed`, Prisma Studio (nice for a demo), strong typed client, and `prisma db pull` can introspect your existing Neon DB to bootstrap the schema.

**What breaks / hurts here:**
- **PostGIS is second-class.** `geography(Point,4326)` maps to `Unsupported("...")` — Prisma Client **cannot read, write, or filter that column**. Every spatial query stays in `$queryRaw`. You already have working `ST_*` SQL; Prisma adds nothing there and takes away type-safety exactly where it's hardest.
- **Triggers, functions, the materialized view are not modeled.** `set_updated_at`, `slugify`, `refresh_clinic_rating`, `clinic_search_view` — all become hand-written raw SQL inside `--create-only` migrations. You're authoring SQL migrations anyway, minus the control.
- **Adoption is all-or-nothing-ish.** Prisma's value is the typed client replacing SQL. But your hardest queries can't move, so you'd carry both Prisma *and* 100+ raw call-sites — the worst of both, plus an engine binary and a codegen step.
- **Extensions** (`pg_trgm`, `unaccent`, PostGIS) via Prisma's `postgresqlExtensions` are still preview-flavored and finicky.

**Net:** Prisma shines on greenfield, relational, PostGIS-free schemas. Yours is the opposite.

### 3.3 Option B — Drizzle *(recommended, post-demo)*
**What you gain:**
- **SQL-first and thin.** Schema is TypeScript; `drizzle-kit generate` emits **plain, reviewable `.sql` migration files** checked into git; `drizzle-kit migrate` applies them once each via a `__drizzle_migrations` ledger (this is exactly the "flexible, no duplicates" migration you want).
- **`drizzle-kit pull`** introspects your existing Neon DB to generate the initial schema — fast adoption from where you already are.
- **Fits Postgres power features:** `customType` for PostGIS `geography`, the `sql` operator for raw fragments, first-class `jsonb`/`text[]`, partial & functional indexes expressible in schema. Triggers/functions/matview go in as custom SQL migration steps (easy — the migrations are just SQL files you edit).
- **Incremental & non-disruptive:** Drizzle uses the **same `node-postgres` Pool you already have**. No driver swap. Keep every raw `query()` call-site working and migrate them opportunistically. Adopt it for schema + migrations + seed first; convert queries later, or never.

**What still hurts:** PostGIS spatial *operations* still need raw `sql`fragments (same as Prisma — nobody escapes this). Introspection won't capture triggers/functions/the matview (you add them as custom SQL). Younger ecosystem, steeper query-builder learning curve than Prisma's.

### 3.4 Option C — Stay on `pg`, add only a migration runner *(recommended for Monday)*
Keep the data layer exactly as-is. Add a lightweight runner so schema changes are ordered and tracked. Options:
- **Consolidated idempotent bootstrap** (fastest — you already have the pieces): one script, all `IF NOT EXISTS`/`OR REPLACE`. Re-runnable. No version ledger. §4.1.
- **`node-pg-migrate`**: a real up/down migration ledger that works with your existing `pg` pool, zero ORM. Good middle ground if you want proper versioning without Drizzle.

**What you gain:** zero rewrite, lowest risk before the demo, PostGIS/FTS/`pg_trgm` all keep working natively. **What you don't get:** typed models — you keep hand-writing SQL (which, for a PostGIS/trigger-heavy schema, is arguably clearer anyway).

### 3.5 Verdict
| | Prisma | Drizzle | Stay on `pg` |
|---|---|---|---|
| Migration workflow | Excellent | Excellent (SQL files + ledger) | Manual / add `node-pg-migrate` |
| PostGIS | ❌ Unsupported type | ⚠️ via `customType` + raw | ✅ native raw SQL |
| Triggers / functions / matview | ❌ manual raw in migrations | ⚠️ manual SQL migrations | ✅ native |
| Reuse existing 100+ raw queries | Fights it | ✅ same pool, coexists | ✅ unchanged |
| Typed models (your stated goal) | ✅ (but not for geo) | ✅ (with raw escape hatch) | ❌ |
| Effort before it's productive | High (rewrite) | Medium (introspect + incremental) | **Low** |
| Risk before Monday | High | Medium | **Low** |

**Recommendation:** **Monday → Option C** (consolidated idempotent migration + seed, no ORM). **After the demo → Option B (Drizzle)** if you want typed models: `drizzle-kit pull` your Neon DB, then move to `drizzle-kit generate/migrate` for all future changes, converting query call-sites gradually. **Do not pick Prisma** for this schema.

---

## 4. Task C — Idempotent migration + seeding design

There are two independent idempotency problems. Solve them with different tools.

### 4.1 Schema idempotency (DDL)
**For Monday — one consolidated bootstrap** (`scripts/migrate.ts` rewritten, run as `bun run db:migrate`), harvested from your existing scripts, using statement-level idempotency:
- `CREATE EXTENSION IF NOT EXISTS postgis / pg_trgm / unaccent / pgcrypto / "uuid-ossp"`
- `CREATE TABLE IF NOT EXISTS ...` for all 19 tables
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` for every column the later `migrate-*.ts` added
- `CREATE INDEX IF NOT EXISTS ...` (incl. GiST/GIN/partial/functional)
- `CREATE OR REPLACE FUNCTION ...` for `set_updated_at`, `slugify`, `refresh_clinic_rating`
- Triggers: `DROP TRIGGER IF EXISTS x ON t; CREATE TRIGGER x ...` (drop-then-create = idempotent)
- `CREATE MATERIALIZED VIEW IF NOT EXISTS clinic_search_view ...`

This is safe to run against the already-populated Neon DB **and** against an empty one. It's the same pattern your current scripts already use — just consolidated and ordered (extensions → functions → tables → indexes → triggers → matview).

**After the demo — a real ledger.** `drizzle-kit migrate` (or `node-pg-migrate`) records applied migrations in a tracking table and applies each exactly once, in order. This is the "flexible, won't re-apply / won't duplicate" migration for ongoing schema evolution. The consolidated bootstrap above becomes your baseline migration `0000_init.sql`.

### 4.2 Seed idempotency (data) — use `ON CONFLICT`
Your uniqueness constraints already make this trivial and duplicate-proof:

| Data | Constraint | Upsert strategy |
|---|---|---|
| **Admin user** | `admin_users.email UNIQUE` | `INSERT ... ON CONFLICT (email) DO NOTHING` — don't clobber a rotated password. |
| **15 treatments** | `services.slug UNIQUE` | `INSERT ... ON CONFLICT (slug) DO UPDATE SET name/category/summary/... ` — keeps canonical fields in sync. |
| **10 concerns** | `concerns.slug UNIQUE` | `INSERT ... ON CONFLICT (slug) DO UPDATE SET ...` |
| **34 mappings** | `concern_services (concern_id, service_id) UNIQUE` | `INSERT ... SELECT` resolving slugs→ids, `ON CONFLICT DO NOTHING`. |

Re-running `db:seed` any number of times converges to the same state — never a duplicate. `seed-canonical.ts` already does exactly this for taxonomy.

**Admin credential hygiene:** today `seed.ts` hardcodes `admin@medspa.com` / `Admin1234!` (bcryptjs, cost 12). Move these to env (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`) so production doesn't ship a public default password. Hash at seed time with the same cost 12.

### 4.3 One command to provision a fresh DB
Add to `package.json`:
- `db:migrate` → consolidated idempotent DDL
- `db:seed` → admin (env) + 15 services + 10 concerns + 34 mappings (all `ON CONFLICT`) + editorial content (§4.4)
- `db:setup` → runs `db:migrate` then `db:seed`

Flow: point `DATABASE_URL` at the fresh DB → `bun run db:setup` → `REFRESH MATERIALIZED VIEW clinic_search_view` → `bun run verify-taxonomy.ts`.

> Neon tip: run migrations over the **direct (non-pooled)** connection string, not the `-pooler` (PgBouncer) URL — DDL and advisory locks behave better on a direct connection. Keep the pooled URL for the app.

### 4.4 ⚠️ The editorial-content gotcha (most important finding)
I verified against the live DB: **all 15 services have `summary`, `description`, and `faqs`; all 10 concerns have `overview` (5 have FAQs).** This rich content was loaded by `seed-faqs.ts` / `seed-treatments.ts` / manual admin edits — it is **not** fully present in `canonical.ts`.

**Consequence:** seeding a fresh DB from `canonical.ts` alone yields a **barebones site** (correct taxonomy, empty descriptions/FAQs) — bad for a demo. Two ways to avoid it:

1. **Capture the content into a version-controlled seed (recommended for repeatability).** Export the current rows and commit them as the seed source:
   - `services`, `concerns`, `concern_services`, `admin_users` → data-only export (SQL `INSERT`s or JSON), loaded with the same `ON CONFLICT` upserts. This makes `db:seed` reproduce today's curated site exactly, and lets you retire `seed-faqs.ts`/`seed-treatments.ts`.
2. **Neon-branch the current DB (recommended for Monday itself).** The current DB *is* the curated dataset. Create a Neon **branch** (or a dedicated project) as your "production" demo DB — an instant, identical copy, zero reconstruction risk. Run the idempotent `db:setup` against it too (safe) so you've proven the provisioning path, but you're not depending on rebuilding content under deadline.

**Best of both:** branch for Monday (safe), and in parallel build the exported seed so future environments are reproducible from code.

---

## 5. Recommended plan

### For Monday (low risk)
1. **Don't adopt an ORM.**
2. **Clean scripts** per §2 — delete the §2.3 throwaways; keep §2.1; leave §2.2 until after step 3.
3. **Consolidate** the `migrate-*.ts` DDL into one idempotent `db:migrate` (§4.1); then remove the harvested files (§2.2).
4. **Build `db:seed`**: env-driven admin + taxonomy + **exported editorial content** (§4.4), all `ON CONFLICT`.
5. **Provision the demo DB** by **Neon-branching** the current curated DB (§4.4 option 2); run `db:setup` against it to validate the path.
6. **Rotate secrets** (§6).
7. Smoke-test: admin login, treatment page, concern page, clinic page, search.

### After the demo (if you want typed models)
- Adopt **Drizzle**: `drizzle-kit pull` the Neon DB → commit generated schema → add triggers/functions/matview as custom SQL migrations → switch to `drizzle-kit generate/migrate` for the ledger → convert query call-sites incrementally (start with the simple CRUD in `src/lib/*/queries.ts`; leave spatial/FTS/matview as raw `sql`).

---

## 6. Security callouts (before any public demo)
- **Rotate these — they were shared in plaintext:** Neon DB password, `NEXTAUTH_SECRET`, `OPENROUTER_API_KEY` (memory already flags this), and the G99 credentials.
- **Move the admin password out of `seed.ts`** into env; never ship `Admin1234!` to production.
- `.env` is gitignored (confirmed) — keep it that way; don't commit the exported seed with real secrets.
- `CRON_SECRET` and `INTERNAL_API_SECRET` are still the `change-me-...` placeholders — set real values.

---

## 7. Open decisions for you
1. **Is the daily re-scrape "added/removed" diff part of the Monday demo?** → determines whether `demo-setup.ts` stays.
2. **"Production" DB = a Neon branch of the current DB, or a brand-new empty Neon project?** → branch = instant & identical (recommended for Monday); empty = truest test of `db:setup` (needs the exported editorial seed first).
3. **Adopt Drizzle now-ish or defer indefinitely?** → affects whether we invest in the export-seed as JSON (Drizzle-friendly) vs. SQL dump.
4. **Keep `reset-db.ts`?** → recommend delete or guard it against production URLs.
