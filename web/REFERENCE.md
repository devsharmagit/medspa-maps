# MedSpaMaps — Database Reference

## Stack
- PostgreSQL 15+
- Extensions: `uuid-ossp`, `pgcrypto`, `pg_trgm`, `unaccent`, `postgis`

---

## Key Rules

- All primary keys are `UUID` — never expose G99 bigint IDs publicly
- Every table has `created_at`, `updated_at`, `is_active` (or `deleted`)
- `updated_at` is auto-managed by the `set_updated_at()` trigger on every table
- Soft deletes only — never hard delete, use `is_active = false`
- Every table stores `g99_*_id` (bigint) and `data_source` for sync tracking
- `data_source` is always one of: `'g99'` `'scraped'` `'manual'`
- Slugs are generated via `slugify()` — URL-safe, lowercase, accent-stripped
- `clinic_search_view` is a materialized view — refresh after bulk inserts

---

## Tables

### businesses
The top-level entity. One business owns one or more clinic locations.

| column | type | source |
|---|---|---|
| id | UUID PK | generated |
| name | TEXT | G99: `businesses.name` |
| slug | TEXT UNIQUE | `slugify(businesses.name)` |
| website_url | TEXT UNIQUE | G99: `businesses.website` |
| logo_url | TEXT | G99: `businesses.logo_url` |
| phone | TEXT | G99: `businesses.phone` |
| email | TEXT | — |
| address | TEXT | G99: `businesses.address` |
| city | TEXT | G99: `businesses.city` |
| state | TEXT | G99: `businesses.state` |
| country | TEXT | G99: `businesses.country` |
| timezone | TEXT | G99: `businesses.timezone` |
| instagram_url | TEXT | G99: `businesses.instagram` |
| facebook_url | TEXT | G99: `businesses.facebook` |
| about | TEXT | G99: `businesses.about` |
| meta_title | TEXT | manual / AI-generated |
| meta_description | TEXT | manual / AI-generated |
| tier | TEXT | set to `'featured'` for all G99 clients |
| tier_expires_at | TIMESTAMPTZ | null = permanent (G99 clients never expire) |
| verified | BOOLEAN | `true` for all G99 clients |
| verified_at | TIMESTAMPTZ | migration timestamp |
| g99_business_id | BIGINT UNIQUE | G99: `businesses.id` |
| g99_tenant_id | BIGINT UNIQUE | G99: `businesses.id` (same value — used to join clinics) |
| data_source | TEXT | `'g99'` for migrated, `'scraped'` for others |
| last_synced_at | TIMESTAMPTZ | updated on each G99 sync |
| is_active | BOOLEAN | default true |

**G99 join key:** `clinics.tenant_id = businesses.id`

---

### clinics
Physical medspa locations. A business with one location has one clinic. Multi-location businesses have many.

| column | type | source |
|---|---|---|
| id | UUID PK | generated |
| business_id | UUID FK → businesses | resolved from `clinics.tenant_id` → `businesses.id` |
| name | TEXT | G99: `clinics.name` |
| slug | TEXT | `slugify(clinics.name)` — unique per business |
| address | TEXT | G99: `clinics.address` |
| city | TEXT | G99: `clinics.city` |
| state | TEXT | G99: `clinics.state` |
| zip | TEXT | — (not in G99, geocode later) |
| country | TEXT | default `'US'` |
| geo | GEOGRAPHY(POINT) | geocoded from address — PostGIS, not in G99 |
| lat / lng | NUMERIC | redundant copy of geo for quick access |
| phone | TEXT | G99: `clinics.contact_number` |
| email | TEXT | G99: `clinics.notification_email` |
| website | TEXT | G99: `clinics.website` → fallback `businesses.website` |
| booking_url | TEXT | G99: `clinics.appointment_url` |
| about | TEXT | G99: `clinics.about` |
| instagram_url | TEXT | G99: `clinics.instagram` |
| facebook_url | TEXT | G99: `clinics.facebook` |
| google_place_id | TEXT | G99: `clinics.google_place_id` |
| google_my_business | TEXT | G99: `clinics.google_my_business` |
| yelp_url | TEXT | G99: `clinics.yelp_url` |
| hours | JSONB | aggregated from G99: `clinic_business_hours` |
| tier | TEXT | inherited from business at migration |
| verified | BOOLEAN | `true` for G99 clients |
| featured | BOOLEAN | `true` for G99 clients |
| avg_rating | NUMERIC(3,2) | auto-computed by trigger from `reviews` |
| review_count | INTEGER | auto-computed by trigger from `reviews` |
| meta_title | TEXT | manual / AI-generated |
| meta_description | TEXT | manual / AI-generated |
| g99_clinic_id | BIGINT UNIQUE | G99: `clinics.id` |
| data_source | TEXT | `'g99'` for migrated |
| is_active | BOOLEAN | default true |

**Hours JSONB shape:**
```json
{
  "MONDAY":    { "open": "09:00", "close": "17:00", "is_open": true },
  "TUESDAY":   { "open": "09:00", "close": "17:00", "is_open": true },
  "SATURDAY":  { "open": "10:00", "close": "14:00", "is_open": true },
  "SUNDAY":    { "open": null,    "close": null,    "is_open": false }
}
```
Source: G99 `clinic_business_hours` — `day_of_week`, `open_hour`, `close_hour`, `is_open` — aggregated with `jsonb_object_agg`.

**Multi-location:** query `WHERE business_id = ?` — returns all clinic locations for that business.

---

### providers
Practitioners who work at one or more clinic locations. Source is G99 `users` filtered by `is_provider = true`.

| column | type | source |
|---|---|---|
| id | UUID PK | generated |
| business_id | UUID FK → businesses | resolved via `users.tenant_id` → `businesses.id` |
| name | TEXT | G99: `users.first_name \|\| ' ' \|\| users.last_name` |
| slug | TEXT | `slugify(name)` — unique per business |
| title | TEXT | G99: `users.title` (e.g. "MD", "NP-C", "PA-C") |
| designation | TEXT | G99: `users.designation` (e.g. "Injectable Specialist") |
| bio | TEXT | G99: `users.description` |
| photo_url | TEXT | G99: `users.profile_image_url` |
| years_experience | SMALLINT | not in G99 — scraper or manual |
| specializations | TEXT[] | not in G99 — scraper or manual |
| avg_rating | NUMERIC(3,2) | computed from `reviews.provider_id` |
| review_count | INTEGER | computed from `reviews.provider_id` |
| g99_user_id | BIGINT UNIQUE | G99: `users.id` |
| data_source | TEXT | `'g99'` for migrated |
| is_active | BOOLEAN | default true |

**G99 filter:** `WHERE is_provider = true AND deleted = false`

**Important:** G99 `people` table is patients/leads — do NOT use for providers.

---

### clinic_providers
Junction: which provider works at which clinic. A provider can work across multiple locations.

| column | type | source |
|---|---|---|
| id | UUID PK | generated |
| clinic_id | UUID FK → clinics | G99: `user_clinic.clinic_id` |
| provider_id | UUID FK → providers | G99: `user_clinic.user_id` |
| is_primary | BOOLEAN | G99: `user_clinic.is_provider_clinic` |
| is_active | BOOLEAN | G99: `user_clinic.enabled` |

**G99 source:** `user_clinic WHERE is_provider_clinic = true`

---

### categories
Top-level service groupings. Displayed as the treatment grid on the homepage.

| column | type | source |
|---|---|---|
| id | UUID PK | generated |
| name | TEXT | G99: `service_categories.name` |
| slug | TEXT UNIQUE | `slugify(name)` |
| description | TEXT | manual |
| icon_url | TEXT | manual |
| display_order | SMALLINT | G99: `service_categories.position` |
| g99_category_id | BIGINT UNIQUE | G99: `service_categories.id` |
| is_active | BOOLEAN | default true |

---

### services
Master treatment catalog. One row per treatment type across the whole platform. Powers `/treatments/{slug}` pages.

| column | type | source |
|---|---|---|
| id | UUID PK | generated |
| name | TEXT | G99: `services.name` (deduped with `DISTINCT ON (slug)`) |
| slug | TEXT UNIQUE | `slugify(name)` |
| alias | TEXT[] | alternate names e.g. `['Neuromodulator','Dysport']` |
| summary | TEXT | AI-generated |
| what_it_is | TEXT | AI-generated |
| how_it_works | TEXT | AI-generated |
| cost_range_low | NUMERIC | G99: `services.cost` (used as low initially) |
| cost_range_high | NUMERIC | G99: `services.cost` (used as high initially) |
| cost_notes | TEXT | manual |
| recovery_time | TEXT | manual / AI-generated |
| duration_minutes | SMALLINT | G99: `services.duration_in_minutes` |
| faqs | JSONB | AI-generated — `[{"q": "...", "a": "..."}]` |
| medical_reviewer | TEXT | manual |
| reviewer_credentials | TEXT | manual |
| last_reviewed_at | TIMESTAMPTZ | manual |
| meta_title | TEXT | AI-generated |
| meta_description | TEXT | AI-generated |
| schema_markup | JSONB | MedicalEntity + FAQPage JSON-LD |
| is_published | BOOLEAN | default false — publish after medical review |
| g99_service_id | BIGINT | G99: `services.id` (one representative row) |
| data_source | TEXT | `'g99'` for migrated |

**Services are global** — not per-clinic. Per-clinic pricing lives in `clinic_services`.

---

### service_categories
Junction: a service can belong to multiple categories.

| column | type | source |
|---|---|---|
| service_id | UUID FK → services | resolved from G99: `services.service_category_id` |
| category_id | UUID FK → categories | resolved from G99: `service_categories.id` |
| is_primary | BOOLEAN | true = primary display category |

**G99 source:** `services.service_category_id` (direct FK in G99, junction in MedSpaMaps)

---

### clinic_services
Junction: which services a clinic offers, with location-specific pricing.

| column | type | source |
|---|---|---|
| id | UUID PK | generated |
| clinic_id | UUID FK → clinics | G99: `service_clinic.clinic_id` |
| service_id | UUID FK → services | G99: `service_clinic.service_id` |
| price_from | NUMERIC | G99: `services.cost` per clinic via `service_clinic` join |
| price_to | NUMERIC | same — G99 has single price, not a range |
| price_notes | TEXT | G99: `services.service_cost_pre_text` / `post_text` |
| price_varies | BOOLEAN | G99: `services.price_varies` |
| featured_service | BOOLEAN | default false |
| is_active | BOOLEAN | default true |
| g99_service_clinic_id | BIGINT UNIQUE | G99: `service_clinic.id` |

---

### images
All images across every entity. Scraper fills clinic/provider images. G99 fills logos and avatars.

| column | type | source |
|---|---|---|
| id | UUID PK | generated |
| entity_type | TEXT | `'business'` `'clinic'` `'provider'` `'service'` `'category'` |
| entity_id | UUID | the owning entity's UUID |
| source_url | TEXT | scraped `img src` or G99 URL |
| scraped_domain | TEXT | origin domain — used for batch re-scrape |
| role | TEXT | `'cover'` `'gallery'` `'avatar'` `'logo'` `'before_after'` |
| sort_order | SMALLINT | display order within a gallery |
| alt_text | TEXT | from scraper or manual |
| scrape_status | TEXT | `'ok'` `'pending'` `'failed'` `'broken'` |
| last_checked_at | TIMESTAMPTZ | last URL health check |
| cdn_url | TEXT | null at launch — populated when self-hosting images |
| storage_key | TEXT | null at launch — populated when uploading to R2 |
| g99_image_id | BIGINT | G99: `service_images.id` (all 0 rows — unused) |

**G99 image sources:**
- `businesses.logo_url` → `entity_type='business'`, `role='logo'`
- `users.profile_image_url` → `entity_type='provider'`, `role='avatar'`
- Clinic photos → none in G99, all from scraper

**Fetch pattern:**
```sql
-- cover image for a clinic card
SELECT source_url FROM images
WHERE entity_type = 'clinic' AND entity_id = $1
  AND role = 'cover' AND scrape_status = 'ok'
ORDER BY sort_order LIMIT 1;
```

---

### reviews
Patient reviews. G99 `clinic_review` is widget config — ignore it. `review_and_ratings` has the actual data.

| column | type | source |
|---|---|---|
| id | UUID PK | generated |
| clinic_id | UUID FK → clinics | G99: `review_and_ratings.clinic_id` |
| provider_id | UUID FK → providers | null — G99 reviews are per clinic only |
| rating | SMALLINT (1–5) | G99: `review_and_ratings.ratings` |
| body | TEXT | G99: `review_and_ratings.message` |
| reviewer_name | TEXT | display only — no PII |
| source | TEXT | mapped from G99: `review_and_ratings.channel` |
| is_approved | BOOLEAN | default true for migrated reviews |
| g99_review_id | BIGINT UNIQUE | G99: `review_and_ratings.id` |

**Channel mapping:**
- `GOOGLE` → `'google'`
- `GROWTH99` → `'internal'`

**avg_rating and review_count on clinics are auto-updated** by a trigger on every INSERT / UPDATE / DELETE on this table. Never update them manually.

---

### concerns
The `/conditions/{slug}` pages. Patient knows their problem (acne scars, loose skin) not the treatment.

| column | type | source |
|---|---|---|
| id | UUID PK | generated |
| name | TEXT | G99: `symptoms.name` |
| slug | TEXT UNIQUE | `slugify(name)` |
| overview | TEXT | AI-generated |
| faqs | JSONB | AI-generated |
| meta_title / meta_description | TEXT | AI-generated |
| schema_markup | JSONB | MedicalCondition + FAQPage JSON-LD |
| is_published | BOOLEAN | default false |
| g99_symptom_id | BIGINT UNIQUE | G99: `symptoms.id` |

---

### concern_services
Junction: which treatments address which concern. Powers the CTA on condition pages.

| column | type | source |
|---|---|---|
| concern_id | UUID FK → concerns | G99: `symptoms_services.symptom_id` |
| service_id | UUID FK → services | G99: `symptoms_services.service_id` |
| display_order | SMALLINT | manual |

---

### listing_claims
Claim flow for unclaimed listings. No G99 equivalent — new table.

| column | type | notes |
|---|---|---|
| id | UUID PK | generated |
| business_id | UUID FK → businesses | the listing being claimed |
| contact_name | TEXT | from 3-field claim form |
| contact_email | TEXT | from 3-field claim form |
| contact_phone | TEXT | from 3-field claim form |
| spa_name | TEXT | from 3-field claim form |
| status | TEXT | `'pending'` → `'verified'` → `'approved'` or `'rejected'` |
| verification_token | TEXT UNIQUE | emailed to claimant |
| verified_at | TIMESTAMPTZ | when email link clicked |
| approved_at | TIMESTAMPTZ | when admin approves |
| source_page | TEXT | which page the form was on |
| utm_source / utm_medium / utm_campaign | TEXT | lead attribution |

---

## Search Query

The main search (service + city) hits the `clinic_search_view` materialized view:

```sql
SELECT *
FROM clinic_search_view
WHERE lower(city) = lower($1)          -- 'miami'
  AND $2 = ANY(service_slugs)          -- 'botox'
ORDER BY
  CASE tier WHEN 'elite' THEN 1 WHEN 'featured' THEN 2 ELSE 3 END,
  avg_rating DESC,
  review_count DESC
LIMIT 20;
```

Radius search (Phase 2):
```sql
WHERE ST_DWithin(geo::geography, ST_Point($lng, $lat)::geography, $radius_meters)
  AND $2 = ANY(service_slugs)
```

Refresh the view after bulk inserts:
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY clinic_search_view;
```

---

## G99 Migration Order

Run in this exact order — each step depends on the previous:

1. `businesses` ← G99 `businesses` (WHERE `deleted = false`)
2. `clinics` ← G99 `clinics` (join via `clinics.tenant_id = businesses.id`)
3. `categories` ← G99 `service_categories`
4. `services` ← G99 `services` (DISTINCT ON slug — dedup across tenants)
5. `service_categories` ← G99 `services.service_category_id`
6. `clinic_services` ← G99 `service_clinic` (+ price from `services.cost`)
7. `providers` ← G99 `users WHERE is_provider = true`
8. `clinic_providers` ← G99 `user_clinic WHERE is_provider_clinic = true`
9. `reviews` ← G99 `review_and_ratings`
10. `images` (logos) ← G99 `businesses.logo_url` as `entity_type='business'`
11. `images` (avatars) ← G99 `users.profile_image_url` as `entity_type='provider'`
12. `clinics.hours` ← G99 `clinic_business_hours` via `jsonb_object_agg`
13. `concerns` ← G99 `symptoms` (run after first migration, not blocking)
14. `concern_services` ← G99 `symptoms_services`
15. Geocode clinics → populate `lat`, `lng`, `geo` from address

---

## What G99 Does Not Have

These fields have no G99 source and must come from the scraper or be entered manually:

| field | how to fill |
|---|---|
| `clinics.geo` / `lat` / `lng` | geocode address via Google Maps API |
| `clinics.zip` | parse from address string |
| `images` (clinic photos) | scraper — `entity_type='clinic'` |
| `providers.years_experience` | scraper or manual |
| `providers.specializations` | scraper or manual |
| `services.what_it_is` / `how_it_works` | AI-generated content |
| `services.faqs` | AI-generated content |
| `services.cost_range_high` | manual — G99 has single price not a range |
| `services.recovery_time` | manual / AI-generated |
| `services.medical_reviewer` | manual |
| `concerns.*` | AI-generated (G99 has `symptoms` names only) |

---

## Tiers

| tier | who | features |
|---|---|---|
| `free` | scraped / unclaimed listings | basic card, no priority sort |
| `featured` | G99 clients (all at launch) | gold badge, priority sort, expanded profile |
| `elite` | top-tier paying clients | above featured in sort, video, offers |

Sort order in search: `elite → featured → free`, then `avg_rating DESC`.

---

## Daily Sync Cron Job

### Overview

A daily sync pipeline keeps the MedSpaMaps database fresh. It runs every night at 03:00 UTC and has four phases:

| Phase | File | What it does |
|---|---|---|
| 1 — G99 Sync | `src/lib/sync/g99-sync.ts` | Reads G99 DB and upserts businesses, clinics, providers, services, reviews |
| 2 — Non-G99 Scrape | `src/lib/sync/web-scraper.ts` | Scrapes websites of manually-entered businesses for fresh phone/social data |
| 3 — Image Finder | `src/lib/sync/image-finder.ts` | Finds clinic cover images by scraping website pages |
| 4 — View Refresh | `src/lib/sync/index.ts` | `REFRESH MATERIALIZED VIEW CONCURRENTLY clinic_search_view` |

### Environment Variables

| Variable | Purpose |
|---|---|
| `G99_DATABASE_URL` | Read-only PostgreSQL connection string to G99 database |
| `CRON_SECRET` | Bearer token that authorizes the `/api/cron/sync` endpoint |
| `DATABASE_URL` | Existing — MedSpaMaps Neon DB (already used everywhere) |

### How to Trigger

**Production (cron-job.org):**
```
URL:    https://yourdomain.com/api/cron/sync
Method: GET
Header: Authorization: Bearer <CRON_SECRET>
Schedule: 0 3 * * *
```

**Local / manual run:**
```bash
bun scripts/sync/run.ts
```

---

## Phase 1 — G99 Sync (`g99-sync.ts`)

G99 is the source of truth. We read from it, never write to it.

### Business-first flow

The sync is driven **per business**, not per entity type. Every valid G99 business is processed in full before moving to the next.

```
getValidG99Businesses()
  → for each business:
      fetchG99BusinessBundle(g99BusinessId)   ← one pass, all data
      syncOneBusiness(bundle)
        → upsertBusiness()
        → for each clinic:
            upsertClinic()
            syncClinicServices()   ← upserts categories + services on-demand
            syncReviews()
        → syncProviders()          ← handles active + deleted
```

### Filtering valid G99 businesses

Only businesses that pass both checks are synced:
```sql
SELECT b.id, b.name
FROM businesses b
JOIN business_config bc ON bc.business_id = b.id
WHERE b.deleted = false
  AND bc.is_test_business = false
```

### `fetchG99BusinessBundle()` — single data fetch per business

This exported function gathers everything G99 has for one business in one logical pass:

- Business core fields
- All clinics → with hours (from `clinic_business_hours`) + services (from `service_clinic` JOIN `services` JOIN `service_categories`) + reviews (from `review_and_ratings`)
- All providers (active and deleted) → with their `user_clinic` assignments

This keeps all G99 reads together and makes the function reusable outside the cron (e.g. an admin "force sync" button).

### Compare before writing

Every entity is fetched from our DB first. Only fields that actually changed are written — no unnecessary UPDATE statements. Hours are compared as JSON strings.

If nothing changed, businesses still get `last_synced_at = NOW()` to record the check.

### Per-entity upsert rules

| Entity | Conflict key | On insert defaults |
|---|---|---|
| `businesses` | `g99_business_id` | `tier='featured'`, `verified=true`, `data_source='g99'` |
| `clinics` | `g99_clinic_id` | `tier='featured'`, `verified=true`, `featured=true` |
| `categories` | `g99_category_id` | — |
| `services` | `slug` (globally deduplicated) | `is_published=false` |
| `clinic_services` | `g99_service_clinic_id` | — |
| `providers` | `g99_user_id` | `data_source='g99'` |
| `clinic_providers` | `(clinic_id, provider_id)` | — |
| `reviews` | `g99_review_id` | `is_approved=true` |
| `images` | `(entity_type, entity_id, source_url)` | — |

### Soft-delete rules

- **Never hard-delete.** `is_active = false` only.
- Provider `deleted = true` in G99 → `is_active = false` in `providers` + `clinic_providers`.
- Businesses deleted in G99 are excluded from the sync query — they are not processed, but also never disabled automatically. Manual admin action required to disable a business.

### Images written during G99 sync

| Source | `entity_type` | `role` |
|---|---|---|
| `businesses.logo_url` | `'business'` | `'logo'` |
| `users.profile_image_url` | `'provider'` | `'avatar'` |

Clinic cover photos are **not** in G99 — those come from Phase 3 (image finder).

### G99 join keys

```
G99 clinics.tenant_id     = G99 businesses.id  (→ our businesses.g99_tenant_id)
G99 users.tenant_id       = G99 businesses.id
G99 user_clinic.user_id   = G99 users.id
G99 user_clinic.clinic_id = G99 clinics.id
```

---

## Phase 2 — Non-G99 Web Scraper (`web-scraper.ts`)

Runs for every business where `data_source != 'g99'` and `is_active = true` and `website_url IS NOT NULL`.

Uses `fetch` + **Cheerio** (HTML parser, no headless browser).

### What is extracted

| Field | How |
|---|---|
| `phone` | `<a href="tel:...">` first, then regex `\d{3}[\s.\-]\d{3}[\s.\-]\d{4}` |
| `instagram_url` | `<a href="*instagram.com*">` |
| `facebook_url` | `<a href="*facebook.com*">` |

Only non-null found values are written — existing values are not overwritten with null.
Clinic `phone` is updated only if currently null (non-destructive).

### Error handling

- HTTP errors (4xx/5xx) → logged, business skipped, no DB update.
- Network timeout → 10 second `AbortSignal.timeout`, same skip behavior.

---

## Phase 3 — Clinic Image Finder (`image-finder.ts`)

Finds cover images for clinics that have no `role='cover'` image with `scrape_status='ok'` in the `images` table.

### Strategy

Pages tried in order for each clinic:
1. Homepage (`website`)
2. `/about`
3. `/team`

An image is selected if its `alt` attribute contains the clinic name, the business name, or any of: `location`, `clinic`, `spa`, `medspa`, `exterior`, `building`, `office`, `facility`.

Small images (width or height < 100px per HTML attributes) are skipped to avoid icons.

### Result written to `images` table

```
entity_type   = 'clinic'
entity_id     = <our clinic UUID>
role          = 'cover'
scrape_status = 'ok'   (or 'failed' if nothing found)
sort_order    = 0
scraped_domain = <hostname>
```

If no image is found across all pages, a `scrape_status='failed'` placeholder is inserted so the clinic is not retried every run. Reset `scrape_status` to `'pending'` to force a retry.

---

## Edge Cases

| Scenario | Handling |
|---|---|
| G99 business not in our DB | INSERT with `tier='featured'`, `verified=true` |
| G99 business is a test account (`is_test_business=true`) | Skipped entirely — not synced |
| Provider `deleted=true` in G99 | `is_active = false` in `providers` + `clinic_providers` |
| No fields changed on existing record | Skip UPDATE; still bump `last_synced_at` on business |
| Duplicate slug on new business/clinic/provider | Append `-2`, `-3` via `uniqueSlug()` in `db-helpers.ts` |
| Clinic image scrape fails | `scrape_status='failed'` — retried only when reset to `'pending'` |
| Website timeout / bad HTTP | Logged, entity skipped, sync continues |
| `clinic_search_view` not yet created | Refresh step catches error and logs a warning — not fatal |
| `fetchG99BusinessBundle()` throws | Error caught per-business, logged, sync continues with next business |

---

## File Reference

```
src/lib/sync/
  index.ts          ← runSync() — orchestrates all 4 phases
  db-helpers.ts     ← ourPool, g99Pool, query helpers, slugify, uniqueSlug
  g99-sync.ts       ← Phase 1: business-first G99 sync
                       exports: syncG99(), fetchG99BusinessBundle()
  web-scraper.ts    ← Phase 2: Cheerio scraper for non-G99 businesses
  image-finder.ts   ← Phase 3: clinic cover image finder

scripts/sync/
  run.ts            ← CLI entry point: bun scripts/sync/run.ts

src/app/api/cron/sync/
  route.ts          ← GET /api/cron/sync — authenticated by CRON_SECRET
```