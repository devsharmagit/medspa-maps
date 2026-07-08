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
| **Runtime / PM** | **Bun** (scripts, cron, Docker) | `web/` keeps both `bun.lock` + `package-lock.json` |
| **Database** | **Postgres 18 + PostGIS 3.6** | accessed with raw **`pg` Pool** in [web/src/lib/db.ts](web/src/lib/db.ts) — **no ORM**; `geography(Point,4326)` + GiST; `clinic_search_view` matview |
| **Auth** | **next-auth v4** + **bcryptjs** | gates `/admin/(protected)/*` |
| **Styling** | **Tailwind v4** (CSS-first, no config file) + **shadcn/ui** (`radix-nova`) | tokens in [web/src/app/globals.css](web/src/app/globals.css); `radix-ui`, `lucide-react`, CVA, `tailwind-merge` |
| **Fonts** | Montserrat (body), Fraunces (headings), Inter, Geist Mono | via `next/font/google` in [web/src/app/layout.tsx](web/src/app/layout.tsx) |
| **Scraping** | **cheerio** + native `fetch` (static HTML, no headless browser) | UA `MedSpaMaps-Bot/1.0`, 15s timeout |
| **Validation** | **zod v4** | validates LLM extraction output |
| **AI** | **No SDK** — direct `fetch` to Anthropic + OpenRouter | keeps deps light |
| **Scheduler** | **node-cron** (in `cron-server`) | one job |
| **Deploy** | **Docker** (`oven/bun`), [start.sh](start.sh) runs Next.js **and** cron side-by-side | migrations run on boot |

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

### 5c. Concierge chatbot — OpenRouter · [web/src/lib/chat/](web/src/lib/chat) + [web/src/components/chat/chat-widget.tsx](web/src/components/chat/chat-widget.tsx)
A public chat widget mounted globally. **Data-grounded, *not* tool/function-calling:** an intent router ([intent.ts](web/src/lib/chat/intent.ts)) picks a route (`safety`/`search`/`combined`/`catalog`/`page_context`); the backend **deterministically runs plain DB functions** ([data.ts](web/src/lib/chat/data.ts): `searchClinics`, `getClinicBySlug`, `getTreatmentInfo`, `getConcernInfo`) and injects the facts into a single prompt.
- **Provider/model:** **OpenRouter** via raw fetch; model `OPENROUTER_MODEL`, default **`openai/gpt-oss-20b:free`** with a **free-tier fallback chain** (llama-3.3-70b, qwen3, gpt-oss-120b) because free models get 429-throttled.
- **Transport:** LLM call is non-streaming; the route **fakes** word-by-word streaming as **NDJSON** events. Guardrails: per-IP rate limit (20/60s), message/size caps, timeouts, and a templated real-data fallback if every model fails.
- ⚠️ **Note:** the chatbot uses an OpenRouter API key.

> Forced tool-use exists **only** in 5b (extraction), never in the chatbot.

---

## 6. Scheduling / background jobs

**Exactly one scheduled job in the whole repo.** [cron-server/src/index.ts](cron-server/src/index.ts) (Bun + node-cron, **`0 3 * * *`**, also once on boot / `--run-once`) is a thin orchestrator that **never touches the DB** — it calls Next.js internal routes with a shared `x-internal-secret`:

1. `GET /api/internal/rescrape/clinics` — list active clinics with a website (least-recently-scraped first).
2. `POST /api/internal/rescrape/clinic/[id]` — up to 5 in parallel → [rescrape-clinic.ts](web/src/lib/rescrape/rescrape-clinic.ts): open a `scrape_jobs` row, re-scrape (same heuristic code as add-clinic), **diff canonical services vs. previous**, write add/remove rows to `clinic_service_changes`, refresh scraped images (curated rows protected), bump `last_scraped_at`. Safety guard: a parse hiccup (0 pages/0 services) aborts *unchanged* — it never wipes a menu.
3. `POST /api/internal/rescrape/refresh-view` — `REFRESH MATERIALIZED VIEW CONCURRENTLY clinic_search_view`.

The matview is otherwise refreshed **on-demand** after admin writes. **G99 sync and image processing are not separately scheduled** (G99 is admin/CLI on-demand; images refresh inline during rescrape).

---

## 7. Taxonomy matching — [web/src/lib/taxonomy/canonical.ts](web/src/lib/taxonomy/canonical.ts)

Every scraped service name is reconciled to the **15 canonical services** (with aliases) via `matchService()`: normalized exact/alias hit → confidence `1.0`; else **Sørensen–Dice** token similarity, best score **≥ 0.55** wins, otherwise `unmatched`. `isLikelyNoise()` strips nav/social/legal/address junk. Concerns are derived from a service→concern map. This one module is shared by the preview, rescrape, and diff paths so classification is consistent everywhere.

---

## 8. Deployment & configuration

- **Single container** ([Dockerfile](Dockerfile), `oven/bun`, multi-stage): builds Next.js, then runs **both** Next.js (`next start -p 3000`) and `cron-server` as sibling processes via [start.sh](start.sh) (`wait -n` — container exits if either dies). Cron talks to Next.js over `localhost`.
- **Migrations** run on boot (`bun scripts/migrate.ts`); schema source of truth is raw SQL in [web/db/schema.sql](web/db/schema.sql).
- **Key env vars:** `DATABASE_URL`, `G99_DATABASE_URL` (lazy read-replica pool), `INTERNAL_API_SECRET` (cron↔web), `OPENROUTER_API_KEY` (chatbot), `NEXTAUTH_*` (admin auth).
