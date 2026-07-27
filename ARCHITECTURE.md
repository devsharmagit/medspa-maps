# MedSpa Maps — Architecture & Design

> A searchable directory of medical-spa clinics (search by treatment + location), where clinic/provider/service content is populated automatically by scraping clinic websites — with an AI extraction pipeline, an AI concierge chatbot, and a nightly re-scrape cron. This document explains the high-level system, the technologies used, and how the moving parts fit together.
>

---

## 1. High-level architecture

```
                       Public visitors                 Admin operators
                             │                                │
              ┌──────────────▼────────────────────────────────▼──────────────┐
              │                Next.js 16 App  (App Router, Bun)              │
              │  Public pages (RSC) + Chat widget  │  Admin (next-auth v4)    │
              │            Route handlers  →  /api/* (public + admin + internal)│
              └───┬───────────────────────┬───────────────────────┬───────────┘
                  │                        │                       │
        ┌─────────▼────────┐   ┌───────────▼──────────┐   ┌────────▼──────────┐
        │  Chatbot          │  │  Heuristic scraper    │  │  AI ingestion      │
        │  OpenRouter(free) │  │  cheerio + fetch      │  │  Anthropic         │
        │  data-grounded    │  │  add-clinic + rescrape│  │  Haiku→Sonnet(CLI) │
        └─────────┬─────────┘  └───────────┬──────────┘   └────────┬──────────┘
                  └────────────────────────┼───────────────────────┘
                            ┌───────────────▼─────────────────┐
                            │  Postgres 18 + PostGIS           │  (raw `pg`, no ORM)
                            │  businesses→clinics→locations/…  │
                            │  clinic_search_view (matview)    │
                            └───────────────▲─────────────────┘
                                            │ HTTP  (x-internal-secret)
                            ┌───────────────┴─────────────────┐
                            │  cron-server (Bun + node-cron)   │  daily 03:00
                            │  rescrape → diff → refresh view  │
                            └──────────────────────────────────┘
```

**Monorepo** (no root manifest); three units deployed as **one Docker image**:
- **`web/`** — the product: Next.js app (public site + admin + all API routes). *Runs the scrapers and AI too.*
- **`cron-server/`** — thin Bun scheduler; owns no logic, calls `web` over HTTP.
- **`ui/`** — design mockups + notes (not code).

---

## 2. Technology stack

| Layer | Choice | Notes |
|---|---|---|
| **Framework** | **Next.js 16.2.7** (App Router, RSC) + **React 19.2.4** | ⚠️ Newer than typical training data — see [web/AGENTS.md](web/AGENTS.md); verify APIs against bundled docs |
| **Language** | **TypeScript 5** (strict) | path alias `@/* → src/*` |
| **Runtime / PM** | **Bun** (scripts, cron, Docker) | `bun.lock` only — one lockfile per package |
| **Database** | **Postgres 18 + PostGIS 3.6** | accessed with raw **`pg` Pool** in [web/src/lib/db.ts](web/src/lib/db.ts) — **no ORM**; `geography(Point,4326)` + GiST; `clinic_search_view` matview |
| **Auth** | **next-auth v4** + **bcryptjs** | gates `/admin/(protected)/*` |
| **Styling** | **Tailwind v4** (CSS-first, no config file) + **shadcn/ui** (`radix-nova`) | tokens in [web/src/app/globals.css](web/src/app/globals.css); `radix-ui`, `lucide-react`, CVA, `tailwind-merge` |
| **Fonts** | Montserrat (body), Fraunces (headings), Inter, Geist Mono | via `next/font/google` in [web/src/app/layout.tsx](web/src/app/layout.tsx) |
| **Scraping** | **cheerio** + native `fetch` (static HTML, no headless browser) | UA `MedSpaMaps-Bot/1.0`, 15s timeout |
| **Validation** | **zod v4** | validates LLM extraction output |
| **AI** | **No SDK** — direct `fetch` to Anthropic + OpenRouter | keeps deps light |
| **Scheduler** | **node-cron** (in `cron-server`) | one job |
| **Deploy** | **Docker** (`oven/bun`), [start.sh](start.sh) runs Next.js **and** cron side-by-side | DB provisioning on boot; no migration ledger yet |

---

## 3. Frontend & styling

- **App Router, server-first.** Public routes (`clinics/[slug]`, `treatments/[slug]`, `conditions/[slug]`, `providers/[id]`, `locations/[state]/[city]`, `search/`) are React Server Components that query Postgres directly through `lib/*/queries.ts`. Admin lives under the auth-gated `admin/(protected)/*` route group.
- **Styling = utility-first Tailwind v4 + shadcn primitives** ([web/src/components/ui/](web/src/components/ui)). No CSS modules. Tailwind v4 is configured **CSS-first** (there is no `tailwind.config.*`): `globals.css` does `@import "tailwindcss"` and defines the design system in an `@theme` block.
- **Brand tokens:** coral `#de7f4c`, purple `#c341d7`, magenta `#aa4eb3`, plus a hero gradient and a radius scale — all CSS variables, consumed as Tailwind utilities.

---

## 4. Data model (summary)

Spine: **`businesses → clinics → { clinic_locations, clinic_services, providers, reviews, images, scrape_jobs }`**. Two locked catalogs — **`services` (15 canonical treatments)** and **`concerns` (10 conditions)** — linked M:N and matched against scraped text. Search is served by the **`clinic_search_view`** materialized view (aggregates services + cover/logo images per active clinic; GiST geo + GIN service-slug indexes). Full column/FK/index reference: **[medspa-map-db.md](medspa-map-db.md)**.

---

## 5. The three AI / scraping subsystems

These are **independent** systems (a common point of confusion). Two extract data; one talks to users.

### 5a. Heuristic scraper — `cheerio`, no AI · [web/src/lib/scraper/](web/src/lib/scraper)
The **production data path**. 11 modules orchestrated by [index.ts](web/src/lib/scraper/index.ts): fetch homepage + a few sub-pages, then extract **contact/booking URL, services (nav + menu anchors), providers, images (logo/cover/gallery), before/after, multi-location, reviews/ratings** — all from static HTML and schema.org JSON-LD. Page discovery here is nav-link + URL-guess only.
- **Powers:** the admin **Add-a-Clinic** flow (`POST /api/admin/clinics/scrape-preview` → human review/edit → `POST /api/admin/clinics/save`) and the nightly cron rescrape. Both share the same service-building code so they never diverge.

### 5b. AI ingestion pipeline — Anthropic · [web/src/lib/ingest/](web/src/lib/ingest) + [web/src/lib/ai/anthropic.ts](web/src/lib/ai/anthropic.ts)
A **website-only, CLI-only batch** ([web/scripts/ingest-g99-batch.ts](web/scripts/ingest-g99-batch.ts)) that reads candidate domains from `g99_clinic_websites` and, per domain:
1. **Discover pages** — `sitemap.xml` / `wp-sitemap.xml` / `sitemap_index.xml` **+ WordPress REST** (`/wp-json/wp/v2/pages`), falling back to heuristic discovery.
2. **HTML → text** (capped 8k chars/page) → **Anthropic Messages API** via raw fetch, **structured output via forced `tool_choice`** (one `record_clinic` tool whose schema is the target JSON).
3. **Validate** with zod. **Model escalation:** default **`claude-haiku-4-5`** (env `INGEST_MODEL`); retry once on **`claude-sonnet-5`** on failure or zero-locations.
4. Dedupe locations, attach per-location Google-Maps links, reuse heuristic image extraction, **geocode** via Nominatim, then persist with `saveClinicBundle`.
- **Scope:** basic clinic details + all physical locations *only* (deliberately not treatments/providers/reviews). **No admin UI and no review step — it saves directly.**

### 5c. Concierge chatbot — OpenAI · [web/src/lib/chat/](web/src/lib/chat) + [web/src/components/chat/chat-widget.tsx](web/src/components/chat/chat-widget.tsx)
A public chat widget mounted globally. **Data-grounded, *not* tool/function-calling:** an intent router ([intent.ts](web/src/lib/chat/intent.ts)) picks a route (`safety`/`search`/`combined`/`catalog`/`page_context`); the backend **deterministically runs plain DB functions** ([data.ts](web/src/lib/chat/data.ts): `searchClinics`, `getClinicBySlug`, `getTreatmentInfo`, `getConcernInfo`) and injects the facts into a single prompt.
- **Provider/model:** **OpenAI** Chat Completions via raw fetch; model `OPENAI_CHAT_MODEL` (falls back to `OPENAI_MODEL`), default **`gpt-4o-mini`**. One retry on 429/5xx — no model-fallback chain (that existed only to dodge free-tier throttling).
- **Transport:** LLM call is non-streaming; the route **fakes** word-by-word streaming as **NDJSON** events. Guardrails: per-IP rate limit (20/60s), message/size caps, timeouts, and a templated real-data fallback if the model call fails.
- ⚠️ **Note:** the chatbot shares `OPENAI_API_KEY` with the ingest pipeline, but its model id is set separately.

> Forced tool-use exists **only** in 5b (extraction), never in the chatbot.

---

## 6. Scheduling / background jobs

**Exactly one scheduled job in the whole repo.** [cron-server/src/index.ts](cron-server/src/index.ts) (Bun + node-cron, schedule from `CRON_SCHEDULE`, **default monthly `0 3 1 * *`**; `--run-once` for a manual pass) is a thin orchestrator that **never touches the DB** — it calls Next.js internal routes with a shared `x-internal-secret`:

1. `GET /api/internal/rescrape/clinics` — list active clinics with a website, least-recently-refreshed first, filtered by `?staleDays` so a multi-hour pass is restart-safe.
2. `POST /api/internal/rescrape/clinic/[id]` — `RESCRAPE_CONCURRENCY` in parallel (default **2**) → [refresh-clinic.ts](web/src/lib/rescrape/refresh-clinic.ts), which delegates to **the same engine the admin importers use** ([ingest-treatments-concerns.ts](web/src/lib/ingest/ingest-treatments-concerns.ts)).
3. `POST /api/internal/rescrape/refresh-view` — `REFRESH MATERIALIZED VIEW CONCURRENTLY clinic_search_view`, once at the end of the run.

**One engine, three surfaces.** The admin "Add Website with AI" button, the g99-websites Import button and this schedule all funnel into `ingestTreatmentsAndConcernsForClinic(clinicId, { trigger })`. That is what guarantees a clinic's menu means the same thing regardless of which one last ran — it also means the guards, the atomic save and the change log apply everywhere. (Until 2026-07-27 the schedule ran a separate non-AI heuristic scraper that handled services only and never touched concerns.)

- **Scope:** treatments + concerns only. Details, images, providers and before/after are refreshed by the admin import path, not on a schedule.
- **Safety:** the run crawls and calls the AI with no transaction held, then aborts *without* saving if nothing parsed while the clinic already had a menu, if either list collapsed by >80%, if crawl health <60% with a halving, or if the wall-clock budget (240s/clinic, set just under undici's non-configurable 300s headersTimeout) ran out. Every abort still records a `skipped` run row with its reason.
- **Atomicity:** the snapshot, service write, concern write, diff, history rows and `last_scraped_at` bump all happen in ONE transaction, so a failure can never leave a half-written menu.
- **Junk never enters:** a scraped name that resolves to nothing in the `services` catalog is dropped, not stored. There is no `unmatched` state and no review queue — the AI mints a catalog row whenever it recognises a real treatment, so the leftovers are junk by construction.
- **History:** `clinic_refresh_runs` (one row per attempt, including skips) + `clinic_catalog_changes` (added/removed canonical rows, keyed on catalog id, not `raw_name`). A first-ever import writes the run row but no change rows. Readable at `/admin/catalog-changes` and on each clinic's admin detail page.
- **Boot run is off by default** (`RESCRAPE_ON_BOOT`) — with a monthly cadence, running on boot would mean every deploy triggers a full paid AI pass.

The matview is otherwise refreshed **on-demand** after admin writes. **G99 sync and image processing are not separately scheduled** (G99 is admin/CLI on-demand; images refresh during the admin import).

---

## 7. Taxonomy matching — [web/src/lib/taxonomy/canonical.ts](web/src/lib/taxonomy/canonical.ts)

Every scraped service name is reconciled against the catalog: the AI's `general_name` (which may mint a new `origin='ai'` row), the curated 15 + aliases via `matchService()` (normalized exact/alias hit → confidence `1.0`), else **Sørensen–Dice** token similarity with the live catalog. A name that resolves to none of those is **dropped, not stored** — there is no `unmatched` state. `isLikelyNoise()` / `isServiceNoise()` / `isConcernNoise()` strip nav/social/legal/address junk and treatment-shaped concern names. This module is shared by the preview, refresh and diff paths so classification is consistent everywhere, and by `lib/search/resolve-query.ts` so a typed search term is resolved the same way.

---

## 8. Deployment & configuration

- **Single container** ([Dockerfile](Dockerfile), `oven/bun`, multi-stage): builds Next.js, then runs **both** Next.js (`next start -p 3000`) and `cron-server` as sibling processes via [start.sh](start.sh) (`wait -n` — container exits if either dies). Cron talks to Next.js over `localhost`.
- **Database provisioning** runs on boot (`bun scripts/db-setup.ts` — the single entrypoint, also `bun run db:setup`): applies [web/db/schema.sql](web/db/schema.sql) only when the schema is absent, then converges the canonical taxonomy seed and the admin user. Schema source of truth is raw SQL in `web/db/`. This is **not** a migration tool — it cannot converge an existing DB onto a changed schema; see [TASKS.md](TASKS.md).
- **Key env vars:** `DATABASE_URL`, `G99_DATABASE_URL` (lazy read-replica pool), `INTERNAL_API_SECRET` (cron↔web), `OPENAI_API_KEY` (ingest + chatbot), `NEXTAUTH_*` (admin auth).
