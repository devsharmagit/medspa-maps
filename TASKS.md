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

- **3a. Schema consolidation (correctness, not cleanup).** `start.sh` applies the *stale*
  `web/scripts/schema.sql` (15 tables) while `web/db/schema.sql` (17) is current. Fold the
  unapplied ad-hoc SQL into `web/db/schema.sql`, delete the duplicate schema/seed pair, and
  collapse `migrate.ts`/`db-migrate.ts`/`db-seed.ts` into one idempotent entrypoint.
- **3b. Secrets.** Untrack + gitignore `cron-server/.env` (contains `INTERNAL_API_SECRET`) and
  rotate it. Delete orphan `ui/package-lock.json`.
- **3c. Dead code.** `lib/constants.ts`, `lib/ai/gemini.ts`, `lib/sync/db-helpers.ts`,
  `lib/concerns/queries.ts`; 7 unmounted components; 5 uncalled API routes. Drop `date-fns`,
  and add the missing `@radix-ui/react-slot` (currently resolved transitively — a latent
  install break).
- **3d. One-off scripts.** Delete ~60 applied backfill/migration/test scripts;
  `web/scripts/` 88 → ~15 files. Safe because the production DB is being rebuilt from scratch.
- **3e. Stale docs/comments.** `ARCHITECTURE.md` §Scheduled work, `web/REFERENCE.md`
  (documents a nonexistent `/api/cron/sync`), `cron-server/README.md`; delete point-in-time
  reports; refresh `medspa-map-db.md` to 17 tables.

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
