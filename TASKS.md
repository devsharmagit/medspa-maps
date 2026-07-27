# MedSpa Maps — Task List

**Created:** 2026-07-27 · **Owner:** Mehul Kothari
Items are in **priority order** and executed **one at a time** — each is reviewed before the
next starts.

> The previous Figma-driven gap analysis moved to
> [docs/FIGMA-GAP-ANALYSIS-2026-07-07.md](docs/FIGMA-GAP-ANALYSIS-2026-07-07.md). It still holds
> open product items (search filters, page rebuilds) and is kept for reference, not as the
> active task list.

**Hard constraint for every task below:** do not break the *add website through AI
(domain → DB)* pipeline. Protected surface is listed in task 3.

---

## 1. ✅ Chatbot on OpenAI — done 2026-07-27

Was: free-tier OpenRouter models with a 4-model fallback chain to dodge 429 throttling.
Now: OpenAI Chat Completions, `OPENAI_CHAT_MODEL` (→ `OPENAI_MODEL`, default `gpt-4o-mini`),
one retry on 429/5xx, 12s timeout.

- `web/src/lib/chat/config.ts` — rewritten for OpenAI (`OPENAI_CHAT_URL`, `CHAT_MODEL`,
  `getOpenAIKey`, `openAiHeaders`); `CHAT_LIMITS` unchanged except `llmTimeoutMs` 18s → 12s.
- `web/src/app/api/chat/route.ts` — `callModel()` only; NDJSON event contract and
  `components/chat/chat-widget.tsx` untouched.
- The intent router, deterministic DB grounding, and templated-fallback ladder are unchanged —
  the model still never calls tools.
- `OPENROUTER_*` env vars are now unread (values left in `.env`; the key should be rotated
  since it was shared in plaintext).

Verified: grounded search answer with a real clinic link, clinic-page path with correct
followups + memory, and — with a deliberately bad key — a single 401 and a clean templated
real-data fallback (HTTP 200, no crash).

## 2. Missed-websites Excel export

Every harvested G99 website with no clinic row in the DB, as a spreadsheet.

- New re-runnable `web/scripts/export-missed-websites.ts` + `export:missed-websites` script.
- Live DB is the source: `g99_clinic_websites` LEFT JOIN `clinics` on normalised domain,
  reusing `websiteDomain()` from `web/src/lib/admin/clinic-save.ts` so the join matches how
  ingest dedupes.
- `reason_not_added` merged in from `SKIPPED-CLINICS.md` and `DUPLICATE-DOMAINS.md`; rows with
  no entry are the genuinely un-triaged ones — the point of the exercise.
- Output: `web/reports/missed-websites-<date>.xlsx`, sheets *Not in DB* / *Skipped (reason
  known)* / *Duplicates*, plus a CSV of sheet 1.

## 3. Code cleanup

**Protected — do not delete:** `admin/(protected)/add-website/`,
`api/admin/clinics/{ingest,scrape-preview,save,check-duplicate}`, `lib/admin/website-import.ts`,
`lib/admin/clinic-save.ts`, all of `lib/ingest/` and `lib/scraper/`,
`lib/ai/{anthropic,openai}.ts`, `lib/g99/*`, `lib/taxonomy/canonical.ts`, `lib/geocoder.ts`,
`lib/address-parser.ts`, `lib/ratings/`, `lib/concerns/catalog.ts`, and the `ingest-*.ts`
scripts.

- **3a. Schema consolidation (correctness, not cleanup). — DONE 2026-07-27.**
  Scoped as "prod applies the stale 15-table schema"; the reality was that **no automated
  provisioning path worked at all**. Four independent breakages, each proven against a
  throwaway empty database:
  1. Both schema files began with `\restrict …`, a **psql meta-command, not SQL**. Sent over
     the wire by `client.query()` it is a syntax error, so `bun scripts/migrate.ts` — run by
     `start.sh` under `set -e` — died on line 5 of *every* boot, on any database.
  2. `pg_dump` on Neon emits **no `CREATE EXTENSION`** statements, so the schema could never
     build an empty DB: the DDL calls `public.uuid_generate_v4()`/`unaccent()` and uses
     postgis types. The block is now maintained by hand in `db/schema.sql`.
  3. The dump sets `search_path = ''` for the whole session, so every unqualified statement
     after it (the admin insert, the verification counts) failed to resolve.
  4. `db/seed.sql` and three scripts still wrote `services.category` and
     `concern_services` — both dropped on 2026-07-18. `seed.sql` is regenerated as the
     curated 15 services + 10 concerns; there is no global link table any more.

  Result: one entrypoint, `web/scripts/db-setup.ts` (`bun run db:setup`, also called by
  `start.sh`), replacing `migrate.ts` / `db-migrate.ts` / `db-seed.ts` / `seed.ts`. One
  schema source, `web/db/`; the duplicate pair under `scripts/` and nine applied ad-hoc SQL
  fragments are deleted. The Dockerfile now copies `web/db` (it never did — which is why the
  duplicate existed). Verified: empty DB → provisioned in one command, three consecutive runs
  idempotent, and the fresh DB is **structurally identical to production** (18 tables, 234
  columns, 1 matview, 10 triggers, 78 indexes all matching).

  Known gap, deliberately not faked: this provisions and seeds, it does **not** migrate an
  existing database onto a changed schema. That is Task 5.
- **3b. Secrets. — DONE 2026-07-27** (one item left for a human, below).
  `cron-server/.env` untracked (`.gitignore`'s `.env*` already covered it — being tracked is
  what defeated the ignore; the local file is untouched so dev still runs). Orphan
  `ui/package-lock.json` deleted — 81 bytes, empty `packages`, no sibling `package.json`.

  **The leak is not the problem; the value is.** The committed `INTERNAL_API_SECRET` is the
  literal placeholder `change-me-to-a-long-random-string` from `.env.example` — byte-identical
  in `cron-server/.env` *and* `web/.env`. So there is nothing secret to rotate out of git
  history, but if any deployed environment inherited that value then
  `/api/internal/rescrape/*` (trigger a rescrape of any clinic, refresh the search matview) is
  guarded by a string published in this repo. `isInternalAuthorized()` itself is sound — it
  requires a configured secret and compares exactly.

  **Needs a human:** confirm the deployed `INTERNAL_API_SECRET` is a real random value, not
  the placeholder (`openssl rand -hex 32`). Deliberately not enforced in code: making the
  placeholder fail closed would break a production cron that is currently relying on it, which
  is a decision, not a cleanup.
- **3c. Dead code. — DONE 2026-07-27.** Deleted, each verified to have zero *import-path*
  importers (a bare basename grep gives false positives — `treatments-carousel` matches
  `clinic-treatments-carousel`, and `testimonials` matches prose in the scrapers):
  - libs: `lib/constants.ts`, `lib/ai/gemini.ts`, `lib/sync/db-helpers.ts`,
    `lib/concerns/queries.ts`
  - components: `faq-accordion`, `shared/{clinics,reviews,treatments}-carousel`,
    `hero/{conditions-nav,treatments-nav,testimonials}`
  - routes: `api/businesses/with-clinics`, `api/scrape`, `api/clinics/[slug]`
  - deps: dropped `date-fns` (0 uses), moved `shadcn` to devDeps, dropped `tsx` (repo runs
    bun), **added `@radix-ui/react-slot`** — `components/ui/button.tsx` imports it while it was
    only ever resolved transitively, i.e. one dependency bump from an install break.

  Deleting `api/scrape` also closes a public, unauthenticated endpoint that fetched an
  arbitrary caller-supplied URL server-side (SSRF). It was not part of the protected ingest
  path, which goes through `api/admin/clinics/*`.

  **Two on the list were kept deliberately** — both would have been outages or amputations,
  not cleanups:
  - `api/health` is *not* a safe dupe of `app/health`. Both return 200 and **neither is
    referenced anywhere in the repo**, because the ECS/ALB health check lives in the task
    definition, which `deploy.yml` pulls from AWS at deploy time and is not in git. The
    Dockerfile installs `curl` solely for it. Deleting the wrong one takes the service down.
    *Needs a human:* check which path the task definition probes, then delete the other.
  - `api/patient-leads` is uncalled, but it is the **only writer** of `patient_leads`, a table
    the admin dashboard and `api/admin/leads` both read. The capture form was never wired up.
    Deleting it would make the feature structurally impossible rather than merely unfinished.
    *Needs a decision:* wire the form, or delete both sides together.

  Verified: `bun run build` clean, `tsc` clean, lint 66 → 63 problems, and a smoke pass over
  `/`, `/search`, `/conditions`, `/skin-navigator`, `/clinics/[slug]`, `/providers`,
  `/admin/add-website`, both health paths — all 200, no new console errors. (`/treatments/botox`
  404s, but that route has never existed; treatments link to `/search?q=…`.)
- **3d. One-off scripts. — DONE 2026-07-27.** `web/scripts/` 75 → **17 files** (58 deleted).
  Nothing in `src` imports `scripts/` at runtime and no script imports another, so the cut is
  compile-safe; the surviving references were all comments, and each has been corrected.

  **Kept (17):** `db-setup.ts`, `export-missed-websites.ts`, `import-postal-codes.mjs`; the six
  protected ingest scripts (`ingest-one`, `ingest-g99-batch`, `ingest-treatments-concerns`,
  `ingest-services`, `ingest-concerns`, `ingest-before-after`); `scrape-digest.ts` (the no-LLM
  fallback path when the Anthropic spend cap kills sub-agents); `clean-catalog-junk.ts` +
  `dedupe-services.ts` + `dedupe-concerns.ts` (re-runnable catalog maintenance the AI ingest
  keeps needing); and the four rescrape/accuracy harnesses Task 4 will verify against
  (`test-rescrape-e2e`, `test-rescrape-serve`, `test-rescrape-live`, `eval-scrape-accuracy`).

  Two corrections to the plan, from reading the files rather than their names:
  - The plan said keep `cleanup-catalog.ts` because `api/search/route.ts` references it. It
    references it **in a comment only**, and the script is self-described as a one-off that
    also reads the dropped `clinic_concern_evidence` table. Of the three near-identical catalog
    cleaners, the reusable one is `clean-catalog-junk.ts` — it applies the *same* noise filters
    ingestion applies, has a preview/`--apply` split, and only touches `origin='ai'` rows.
    Kept that; deleted `cleanup-catalog.ts` and `catalog-cleanup.ts`.
  - `reconcile-taxonomy.ts` was deleted despite three lib docstrings naming it as *the* taxonomy
    seeder: it writes `concern_services` and the per-service price/recovery columns, all dropped
    on 2026-07-18. Seeding is now `web/db/seed.sql` via `db-setup.ts`. Those docstrings are
    fixed.

  Also fixed while here: `spotlight-static.ts` pointed at `scripts/dump-owners.ts` and
  `lib/g99/prod.ts` + the g99-websites route pointed at `scripts/g99/prod_tunnel.py` — **neither
  path has ever existed in this repo**. Removed the `migrate:providers` package alias.

  The applied backfills (`fix-clinic-maps`, `fix-clinic-images`, `fill-clinic-providers`,
  `fill-clinic-before-after`, the `geocode-*`/`backfill-*` set) are gone per the "prod DB gets
  rebuilt from scratch" decision. If a fresh ingest turns out to miss a field one of them
  repaired, they are recoverable from git history — `git log --diff-filter=D --stat`.

  Note the four rescrape harnesses currently **fail**: they reference `scrape_jobs` /
  `clinic_service_changes`, dropped on 2026-07-18. Repairing them is part of Task 4, which is
  why they were kept rather than deleted and rewritten.
- **3e. Stale docs/comments. — DONE 2026-07-27.**
  - **Deleted `web/REFERENCE.md` (24 KB).** Not "a few stale lines" — it is a pre-build spec of
    a schema that no longer exists: `businesses`, `categories`, `service_categories`,
    `listing_claims`, `concern_services`, per-table `data_source`/`g99_*_id` columns, plus a
    three-phase daily sync (`g99-sync.ts`, `web-scraper.ts`, `image-finder.ts`) that was never
    built. It contradicted `medspa-map-db.md` on nearly every table. Nothing linked to it.
  - Deleted the point-in-time reports: `DB_MIGRATION_AND_DEMO_PREP_REPORT.md`,
    `cost-estimation.md` (superseded by `COST-ESTIMATION-OPENAI.md`), and the three
    `web/reports/*.md` ingest write-ups. **Kept `ai-vision-plan.md`** against the plan — it is
    linked twice from `weburltodataindb.md` and documents live vision-based image selection.
  - `ARCHITECTURE.md`: §6 no longer claims the rescrape opens a `scrape_jobs` row and writes
    `clinic_service_changes` (both dropped) — it now says the deltas are returned and
    discarded, and points at Task 4. Also fixed "keeps both `bun.lock` + `package-lock.json`"
    (there is no `package-lock.json`) and "migrations run on boot".
  - `cron-server/README.md`: gained a **"Not implemented yet"** section. It was advertising an
    `/admin/treatment-changes` page and a per-clinic "Treatment History" card that have never
    existed, as though they shipped.
  - `medspa-map-db.md`: 15 → **17 base tables** (`clinic_leads`, `patient_leads`).
  - `weburltodataindb.md`: removed the `INGEST_PROVIDER=gemini` / `GEMINI_API_KEY` routing
    story. `extractViaTool` explicitly ignores `INGEST_PROVIDER` and always delegates to
    OpenAI, so those env vars have done nothing for some time — the doc was wrong before
    `lib/ai/gemini.ts` was deleted, not because of it.

  **Found while checking links: `cron-server/node_modules` was committed — 1731 files, 36 MB.**
  `.gitignore` said `/node_modules`, which is root-anchored, so only the root one was ever
  ignored. Changed to `node_modules/` (matches at any depth) and untracked the directory; the
  files stay on disk and the Dockerfile runs its own `bun install --frozen-lockfile`, so
  neither local dev nor the image is affected.

  Verified: a link-checker over every tracked `.md` reports **zero** broken relative links to
  files, down from the several the deletions would otherwise have left.

  Follow-up worth doing sometime: `lib/ai/anthropic.ts` no longer talks to Anthropic — it is
  the OpenAI dispatcher. The name is actively misleading, but it sits on the protected ingest
  path so renaming it deserves its own change.

## 4. Fix the treatments/services cron

The reconciliation logic in `lib/rescrape/rescrape-clinic.ts` is sound; its surroundings are not.

1. `start.sh` runs `scripts/migrate-treatment-changes.ts`, whose SQL references the dropped
   `scrape_jobs` table — a boot-time failure. Remove it.
2. Re-add a lean `clinic_service_changes` table (no `scrape_jobs` FK) and persist the
   already-computed added/removed deltas, so treatment history stops being ephemeral.
3. Add the `/admin/treatment-changes` page that `cron-server`'s README already promises and
   which never existed.
4. `cron-server/.env.example` documents `SYNC_LIMIT`; the code reads `RESCRAPE_LIMIT`.
5. Scope stays treatments/services only — not concerns, providers, or before/after.

## 5. Data model + migrations — DEFERRED (needs senior approval)

No migration ledger exists today; schema history lives in ~20 ad-hoc scripts.

**Recommendation: Drizzle.** It layers onto the existing `pg` pool (`lib/db.ts`) without
rewriting ~200 raw queries, `drizzle-kit introspect` baselines the live schema in one command,
and PostGIS `geometry` + the `clinic_search_view` materialized view keep working — both need
`Unsupported`/raw escapes under Prisma, which also wants to own the whole schema.

**Prerequisite:** task 3a, so there is exactly one schema file to baseline from.
