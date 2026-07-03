# Medspa re-scrape cron server

A thin orchestrator that runs the **daily treatment re-scrape**. It talks to the
Next.js app over HTTP only — it never touches the database or scrapes a site
itself. Next.js does the scraping, diffing, applying, and change-logging.

## What it does

Every day at **03:00** (and once on boot):

1. `GET /api/internal/rescrape/clinics` — list every active clinic with a website.
2. For each clinic (bounded concurrency): `POST /api/internal/rescrape/clinic/:id`
   — Next.js re-scrapes the site with the same logic used when adding a clinic,
   diffs the detected treatments against what the clinic had, applies the
   changes, and records each canonical add/remove in `clinic_service_changes`.
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

Changes surface in the admin panel at **/admin/treatment-changes** and in the
"Treatment History" card on each clinic's detail page.
