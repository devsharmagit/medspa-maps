# Medspa re-scrape cron server

A thin orchestrator that runs the **daily treatment re-scrape**. It talks to the
Next.js app over HTTP only — it never touches the database or scrapes a site
itself. Next.js does the scraping, diffing, applying, and change-logging.

## What it does

Every day at **03:00** (and once on boot):

1. `GET /api/internal/rescrape/clinics` — list every active clinic with a website.
2. For each clinic (bounded concurrency): `POST /api/internal/rescrape/clinic/:id`
   — Next.js re-scrapes the site with the same logic used when adding a clinic,
   diffs the detected treatments against what the clinic had, and applies the
   changes.
3. `POST /api/internal/rescrape/refresh-view` — refresh the public search view.

All internal calls send `X-Internal-Secret: $INTERNAL_API_SECRET`.

## Run

```bash
bun install
bun run start        # scheduler (daily @ 03:00 + one run on boot)
bun run run-once     # single pass now, then exit (manual runs / testing)
```

## Config (env)

| Var | Default | Purpose |
|-----|---------|---------|
| `NEXTJS_URL` | `http://localhost:3000` | base URL of the Next.js app |
| `INTERNAL_API_SECRET` | — | shared secret for the internal API (**required**) |
| `RESCRAPE_CONCURRENCY` | `5` | clinics scraped in parallel |
| `RESCRAPE_LIMIT` | (all) | cap total clinics per run (useful for testing) |

## Not implemented yet

The add/remove deltas are computed and returned per clinic, then **discarded** —
the `clinic_service_changes` audit table was dropped in the 2026-07-18 schema
simplification, so treatment history does not survive a run. The
`/admin/treatment-changes` page and the per-clinic "Treatment History" card that
earlier versions of this README promised **have never existed**.

Reinstating the table, persisting the deltas, and adding the admin page is Task 4
in the root [TASKS.md](../TASKS.md).
