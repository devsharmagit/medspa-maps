# Medspa refresh cron server

A thin orchestrator that keeps every clinic's **treatments and concerns** fresh.
It talks to the Next.js app over HTTP only — it never touches the database or
scrapes a site itself. Next.js does the crawling, extraction, diffing, applying
and change-logging.

## What it does

On `CRON_SCHEDULE` (**monthly by default**, 03:00 on the 1st):

1. `GET /api/internal/rescrape/clinics` — active clinics with a website,
   least-recently-refreshed first, skipping any refreshed within
   `RESCRAPE_STALE_DAYS`.
2. For each clinic (bounded concurrency): `POST /api/internal/rescrape/clinic/:id`
   — Next.js runs **the same AI engine the admin "Add Website with AI" button
   runs**, diffs the result against what the clinic had, applies the changes in
   one transaction, and records the run plus every added/removed catalog row.
3. `POST /api/internal/rescrape/refresh-view` — refresh the public search view,
   once at the end of the run.

All internal calls send `X-Internal-Secret: $INTERNAL_API_SECRET`.

**Scope is treatments + concerns only.** Clinic details, images, providers and
before/after photos are refreshed by the admin import path, not on a schedule.

## One engine, three surfaces

The admin "Add Website with AI" button, the g99-websites Import button and this
job all funnel into `ingestTreatmentsAndConcernsForClinic()`. A clinic's menu
therefore means the same thing regardless of which one last ran, and the safety
guards, the atomic save and the change log apply to all three. (Before
2026-07-27 this job ran a separate non-AI heuristic scraper that handled services
only and never touched concerns, so it could and did disagree with the importer.)

## Why monthly

Each clinic is a real AI crawl — roughly 130 pages plus several model calls — so
a full pass over the directory costs money and takes hours. Medspa menus don't
change week to week. Set `CRON_SCHEDULE=0 3 * * 0` for weekly if you want fresher
data at ~4× the cost.

## Run

```bash
bun install
bun run start        # scheduler
bun run run-once     # single pass now, then exit (manual runs / testing)
```

Measure before raising concurrency:

```bash
RESCRAPE_LIMIT=5 bun run run-once
```

## Config (env)

| Var | Default | Purpose |
|-----|---------|---------|
| `NEXTJS_URL` | `http://localhost:3000` | base URL of the Next.js app |
| `INTERNAL_API_SECRET` | — | shared secret for the internal API (**required**) |
| `CRON_SCHEDULE` | `0 3 1 * *` | when to run (monthly, 03:00 on the 1st) |
| `RESCRAPE_CONCURRENCY` | `2` | clinics refreshed in parallel |
| `RESCRAPE_STALE_DAYS` | `21` | skip clinics refreshed within N days |
| `RESCRAPE_ON_BOOT` | `false` | also run once at startup |
| `RESCRAPE_LIMIT` | (all) | cap clinics per run (useful for testing) |
| `RESCRAPE_REQUEST_TIMEOUT_MS` | `480000` | per-request ceiling |

> **A clinic refresh has a hard 300s ceiling you cannot configure away.** Node's
> undici enforces a 300s `headersTimeout`, and a route's headers are not sent
> until it returns — so a longer refresh fails on this client with an opaque
> "operation timed out" regardless of `RESCRAPE_REQUEST_TIMEOUT_MS`. That is why
> the engine's per-clinic budget is **240s**: it expires first, so a slow clinic
> becomes a recorded `skipped` run with a real reason and gets retried next cycle.

Two of those defaults are load-bearing:

- **`RESCRAPE_CONCURRENCY=2`** — each clinic runs several AI calls and ~10
  concurrent page fetches, on the same box that serves the public site. At 5 that
  is ~15 concurrent model calls and ~50 fetches from one IP, and provider 429s
  are exactly what blows the per-clinic time budget.
- **`RESCRAPE_ON_BOOT=false`** — with a monthly cadence, running on boot would
  mean every deploy kicks off a full paid pass over the whole directory.

`RESCRAPE_STALE_DAYS` is what makes a multi-hour pass restart-safe: because
`last_scraped_at` is bumped on every *attempt* (not only on success), a crashed
or redeployed run resumes where it stopped, and a permanently-failing clinic
can't monopolise the head of the queue.

## Where the history goes

- `clinic_refresh_runs` — one row per attempt, **including skipped ones**. A
  clinic whose crawl has been failing for months would otherwise look identical
  to one that genuinely hasn't changed.
- `clinic_catalog_changes` — the canonical treatment/concern rows gained and lost,
  keyed on catalog id rather than the scraped name, so a renamed service that
  still resolves to the same treatment isn't logged as a change. A first-ever
  import writes the run row but no change rows.

Both are readable at **`/admin/catalog-changes`** and on each clinic's admin
detail page.

## Safety

A transient outage or a markup change must never read as "this clinic dropped its
whole menu". The run aborts *without saving* — recording a `skipped` run with the
reason — when nothing parsed while the clinic already had a menu, when either
list collapsed by more than 80%, when crawl health is below 60% alongside a
halving, or when the 240s per-clinic budget runs out. Separately, a scraped name
that resolves to nothing in the `services` catalog is dropped rather than stored,
so a refresh cannot introduce junk treatments.
