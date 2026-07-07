# G99 prod DB ↔ MedSpa Maps DB — Schema Mapping & Gap Analysis

**Date:** 2026-07-07 · Analyzed live G99 prod (Aurora PG 17.7, read-only via SSH tunnel) against our Neon DB.
**Population analyzed:** 1,241 live clinics belonging to 1,062 live, non-training businesses.

---

## 1. What G99 actually has (with real fill rates)

### 1.1 `g99.clinics` (1,241 live rows) — the useful table

| G99 column | Fill % | Verdict | Maps to (our DB) |
|---|---:|---|---|
| `name` | 100% | ✅ use | `clinics.name` (hint; scrape may refine) |
| `website` | 86% | ✅ **primary key for import** | `clinics.website` → dedup by domain |
| `address` | 95% | ✅ use, **needs parsing** | `clinics.address/city/state/zip` via address-parser + geocode |
| `city` / `state` / `country` | **0%** | ❌ empty | — (parse from `address` instead) |
| `contact_number` | 95% | ✅ use | `clinics.phone` |
| `about` | 79% | ✅ use as fallback | `clinics.about` (prefer scraped/AI version) |
| `google_my_business` | 69% | ✅ use | `clinics.google_my_business` |
| `google_place_id` | 43% | ✅ use | `clinics.google_place_id` (future: Places ratings) |
| `google_profile_id` | 47% | ✅ use | `clinics.google_place_id` fallback |
| `yelp_url` | 31% | ✅ use | `clinics.yelp_url` |
| `instagram` | 75% | ✅ use | `clinics.instagram_url` |
| `facebook` | 63% | ✅ use | `clinics.facebook_url` |
| `twitter` | 4% | ✅ use | `clinics.x_url` |
| `tiktok` | 3% | ✅ use | `clinics.tiktok_url` |
| `appointment_url` | 78% | ✅ use | `clinics.booking_url` — **high value, hard to scrape reliably** |
| `clinic_url` | 65% | ⚠️ inspect | often a G99 booking-page URL; secondary |
| `timezone` | 100% | ✅ use | needed for "Open Today" logic (no column yet — see gap #5) |
| `currency` | 100% | ✅ use | for price display (no column yet — minor) |
| `secondary_urls` | 54% | ⚠️ inspect | may contain extra domains per clinic |
| `id`, `tenant_id` | 100% | ✅ use | `clinics.g99_clinic_id`, `businesses.g99_business_id` (columns exist) |
| ~50 other columns (booking config, CSS, notification settings) | — | ❌ ignore | G99 CRM internals |

**Data-quality caveats:** websites missing protocol / `"n/a"` junk / mixed case → normalize. Address strings contain encoding artifacts (`Arizona � 85249`) → clean before parsing. `services`/`service_clinic` **excluded by decision (2026-07-07): unreliable data — services come from AI scraping only.**

### 1.2 `g99.businesses` (1,062 live) — nearly empty except identity

| G99 column | Fill % | Verdict | Maps to |
|---|---:|---|---|
| `name` | 100% | ✅ use | `businesses.name` |
| `logo_url` | 90% | ✅ use | `images(entity_type='business', role='logo')` — **great, logos are hard to scrape well** |
| `sub_domain_name` | 100% | ⚠️ | G99-hosted subdomain; possible fallback site |
| `specialization_id` | 84% | ⚠️ | could filter out non-medspa businesses (dental etc.) — **check the lookup table before bulk import** |
| `website`, `about`, `address`, `city`, `state`, `phone`, socials | **0–1%** | ❌ empty | all of it lives on `clinics`, not `businesses` |

### 1.3 `g99.clinic_business_hours` — 🎁 unexpected win

156,868 rows covering **2,296 distinct clinics**: `day_of_week`, `open_hour`, `close_hour` (timestamps — take time part), `is_open`, plus rows keyed by `tenant_id` when `clinic_id` is null (business-level default hours).

→ Maps to `clinics.hours jsonb` / `clinic_locations.hours jsonb` (columns already exist, currently unpopulated). **This directly enables the Figma "Open Today / Weekend Availability" filter without scraping hours.** Import rule: prefer clinic-level rows, fall back to tenant-level.

### 1.4 Review-related tables — counts yes, content no

| Table | Rows | Verdict |
|---|---:|---|
| `all_review_count` | 156,732 | ✅ per-clinic Google/Yelp/FB/Demandforce **counts** over time → take latest per clinic → `clinics.ext_review_count` |
| `clinic_review` | 2,079 | ❌ it's review-**widget config** (button text, CSS), NOT review content |
| `review_and_ratings` | 320 | ⚠️ tiny; inspect later |

**Conclusion: G99 has no review text and no rating values.** Rating source remains an open decision (Google Places API recommended — `google_place_id` is 43% filled which helps).

### 1.5 Not in G99 at all (must come from scraping or elsewhere)
- Providers / team members (G99 `users` = 25 internal accounts, `provider_schedules` is booking infra)
- Service menus w/ descriptions & pricing (excluded by decision)
- Photos/galleries (only business logo), before/afters
- Review text & rating values
- Hours for clinics not using G99 booking (~clinics beyond the 2,296 covered)

---

## 2. Our DB — target tables (Neon PG 18 + PostGIS)

Core hierarchy (all exist): `businesses` → `clinics` → `clinic_locations`; content: `clinic_services`, `providers`, `images`, `reviews`, `concerns`, `clinic_concerns`; ops: `scrape_jobs`, `clinic_service_changes`.
G99 linkage columns already present: `businesses.g99_business_id`, `businesses.g99_tenant_id`, `clinics.g99_clinic_id`, `reviews.g99_review_id`, `images.g99_image_id`, `last_synced_at`, `data_source`.

## 3. Field-by-field import mapping (G99 → ours)

| Our field | Source | Rule |
|---|---|---|
| `businesses.name` | G99 `businesses.name` | direct |
| `businesses.g99_business_id/g99_tenant_id` | G99 `businesses.id` | stamp on import |
| `clinics.name` | G99 `clinics.name`, refined by scrape | G99 wins for identity, scrape may add display name |
| `clinics.website` | G99 `clinics.website` normalized | strip protocol/www, lowercase, drop junk (`n/a`) |
| `clinics.address` | G99 `clinics.address` | clean encoding artifacts first |
| `clinics.city/state/zip` | parsed from G99 address | `address-parser.ts`; fallback: scrape contact page; fallback: Nominatim reverse |
| `clinics.lat/lng/geo` | geocoded | Nominatim (rate-limited) or zip-centroid fallback |
| `clinics.phone` | G99 `contact_number`, else scrape | G99 preferred (verified data) |
| `clinics.about` | **scrape/AI**, else G99 `about` | scraped richer; G99 as fallback |
| `clinics.booking_url` | G99 `appointment_url`, else scrape | G99 preferred |
| `clinics.instagram_url/facebook_url/x_url/tiktok_url/yelp_url` | G99, else scrape | G99 preferred where filled |
| `clinics.google_my_business/google_place_id` | G99 | direct |
| `clinics.hours` | G99 `clinic_business_hours`, else scrape | transform to our jsonb shape |
| `clinics.ext_review_count` | G99 `all_review_count` (latest) | sum of sources or per-source; decide display |
| `clinics.g99_clinic_id`, `data_source='g99'`, `last_synced_at` | — | stamp on import |
| `clinic_locations.*` | scraper multi-location detection | G99 clinic rows sharing a domain = **hint** for expected location count |
| `clinic_services.*` | **AI scrape only** | G99 services excluded |
| `providers.*` | **AI scrape only** | not in G99 |
| `images` (logo) | G99 `businesses.logo_url` | role='logo' |
| `images` (gallery/B&A) | **AI scrape only** | |
| `reviews.*` | ❌ neither | Google Places API or manual (open decision) |

## 4. Multi-location handling (req #3)

- **89 domains** are shared by 2+ G99 clinic rows (e.g. `renovomedispa.com` → Etobicoke / Burlington / Vaughan).
- Import unit = **domain**, not G99 clinic row (925 unique domains, 1 scrape each).
- Scraper's location detection = source of truth; G99 rows = expected-count hint + per-location metadata (address, phone, hours) matched by address similarity.
- Unmatched G99 rows (scraper found fewer locations) → flag for admin review, don't drop silently.

## 5. Schema gaps in OUR db (delta to add)

| # | Gap | Change | Driven by |
|---|---|---|---|
| 1 | `import_queue` staging table | new table: `domain, source(g99/manual), g99_clinic_ids bigint[], status, attempts, last_error, scraped_at, saved_clinic_ids uuid[]` | bulk pipeline |
| 2 | `offers` table | new: `clinic_id, service_id?, label, pct, valid_until, source` | Figma discount ribbons |
| 3 | `zip_codes` table | new: `zip, city, state, lat, lng` (~42k rows) | autocomplete + radius |
| 4 | `providers.provider_type` | new enum-ish text column | Figma provider-type filter |
| 5 | `clinics.timezone` | new column (G99 has it 100%) | correct "Open Today" evaluation |
| 6 | `clinics.currency` | new column (G99 100%) | price display (minor) |
| 7 | `medspa_leads` booking fields | add `clinic_id, service_id, preferred_date, preferred_time` | Figma booking form |
| 8 | `newsletter_subscribers` | new table | Figma footer/banner |
| 9 | `clinics.highlights jsonb` | new column | card bullet tags |
| 10 | `images.pair_id`, `images.service_id` | add columns | before/after grouped by treatment |
| 11 | `reviews.reviewer_photo_url` | add column | testimonial avatars (minor) |
| 12 | `clinic_search_view` | add min_price, provider_types[], open-today inputs | filter performance |

No changes needed for: multi-location model, service matching, scrape-job tracking, G99 linkage — all already designed correctly.

## 6. Import pipeline order (updated)

1. **Extract** — G99 query (live business + live clinic + website) → normalize domains → upsert 925 rows into `import_queue`, carrying G99 metadata (ids, name, address, phone, socials, booking URL, place ids, hours, logo, review counts).
2. **Scrape+AI** per domain → structured JSON (locations, services, providers, images, about).
3. **Merge** — field precedence per §3 (G99 wins: identity/phone/booking/socials/hours; scrape wins: about/services/providers/images/locations).
4. **Geocode** parsed addresses → `geo` points.
5. **Save** via existing preview→save path; stamp `g99_clinic_id`; auto-save high confidence, queue rest for admin.
6. **Sync** — nightly: new G99 clinics → enqueue; changed `all_review_count` → refresh counts.
