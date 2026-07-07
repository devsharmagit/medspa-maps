# MedSpa Maps — Master Task List & Gap Analysis

**Date:** 2026-07-07 · **Owner:** Mehul Kothari
**Goal:** End-to-end system matching the [Figma design](https://www.figma.com/proto/oBTUqk4OCHK22zKRoIf8iy/Med-Spa-maps?node-id=1-10444&p=f&page-id=1%3A9703) — search medspa clinics by treatment + location, with all clinic/provider/service content populated automatically by scraping clinic websites with AI.

---

## 1. Product requirements (agreed)

1. **Search** treatments by zipcode / city (autocomplete input) + treatment → matching clinics, with Figma filters (treatment type, distance radius, rating, provider type, availability) and sort.
2. **Automated ingestion**: give the system a website URL → scrape → AI-extract structured JSON → save to DB. No manual data entry as the primary path.
3. **Multi-location**: one website (e.g. `renovomedispa.com`) can have multiple clinics at different addresses — handled gracefully.
4. **Page discovery**: detect all pages of a (mostly WordPress) site — sitemap / wp-json / nav — so we can find and deep-scrape service pages and associate services to the clinic.
5. **G99 prod DB** is the **website discovery source** (its `clinics` table → unique websites). Its `services` data is NOT reliable — all content comes from scraping. Manual URL entry also supported (e.g. `ruma.com`).

---

## 2. Architecture (target)

```
G99 prod DB (Aurora, via SSH tunnel)          Manual URL entry (admin)
        │  clinics → unique websites                  │
        └───────────────┬─────────────────────────────┘
                        ▼
              import_queue (staging: domain, status, g99 hints)
                        ▼
        ┌── AI Scraping Pipeline (per domain) ──────────────┐
        │ 1. Page discovery: sitemap.xml / wp-json / nav    │
        │ 2. Page classification (service/team/contact/...) │
        │ 3. Fetch pages → LLM extraction → zod-valid JSON  │
        │ 4. Multi-location resolution                      │
        │ 5. Service matching → canonical taxonomy          │
        └────────────────────┬──────────────────────────────┘
                             ▼
      Preview → (auto-save high-confidence / admin review) → DB
   businesses → clinics → clinic_locations → clinic_services
        → providers → images → reviews
                             ▼
        Search API (PostGIS + zip geocode) → Figma frontend
        cron-server: nightly rescrape + G99 delta sync
```

---

## 3. Key facts discovered (codebase + DB scans, 2026-07-06/07)

### Already built (don't rebuild!)
- **Search API** (`web/src/app/api/search/route.ts`): treatment + city/state/zip text search, Haversine distance, radius, rating filter, sorts, multi-location aware, `clinic_search_view` matview.
- **Heuristic scraper** (`web/src/lib/scraper/` — 9 modules): contact, services (nav-based), providers (names), images, multi-location detection, reviews → structured JSON. **Cheerio/regex only — no AI.**
- **Admin panel** (`web/src/app/admin/`): full CRUD for clinics/locations/services/providers/images/concerns/reviews/businesses + **scrape-preview → edit → save** flow + unmatched-service queue + treatment-change audit log.
- **G99 read layer** (`web/src/lib/g99/`): reads G99 businesses/clinics (handles `tenant_id` join, `deleted` flag, test tenants); per-clinic **import-preview** that scrapes the website and overlays G99 metadata; imported/domain-match/new status UI.
- **Rescrape cron** (`cron-server/`): nightly re-scrape of all clinics via internal API, service change detection, matview refresh.
- **Service taxonomy**: 15 canonical services + 10 concerns, alias matching with confidence scores.

### DB (Neon Postgres 18 + PostGIS) — schema ~85% ready
20 tables incl. `businesses`, `clinics`, `clinic_locations`, `clinic_services` (with `price_from`, `match_confidence`), `providers`, `images`, `reviews`, `scrape_jobs`, `clinic_service_changes`. Currently seeded with ~12 demo clinics.

### G99 prod DB (via SSH tunnel → localhost:5434)
- PostgreSQL 17.7 Aurora; connection script: `scripts/g99/test_connection.py` (creds in gitignored `scripts/g99/.env.g99`).
- **1,068 live clinics with websites → 925 unique domains** (921 excluding growth99.* placeholders).
- **89 domains shared by multiple clinic rows** → multi-location candidates.
- `city`/`state` mostly NULL (only combined `address` string) → must parse/geocode ourselves.
- Website values dirty: missing protocol, `"n/a"` junk, mixed case → normalization required.
- `services` table (33k rows) exists but **is not trustworthy — do not import** (decision 2026-07-07).
- `all_review_count` (156k rows): per-clinic Google/Yelp/FB review **counts** — usable later for card counts.
- `google_place_id` / GMB URLs present on many clinics — useful for future ratings via Google Places.

---

## 4. Task list

Legend: ✅ done · 🟡 partial (gap noted) · 🔴 not started

### Phase 0 — Foundations
| # | Task | Status | Notes |
|---|------|--------|-------|
| 0.1 | Local dev env running (Node 24, deps, `.env`, Neon DB) | ✅ | http://localhost:3000 |
| 0.2 | SSH tunnel + G99 prod connection script | ✅ | `scripts/g99/test_connection.py --keep` holds tunnel on :5434 |
| 0.3 | Stable tunnel for automation (cron can't rely on laptop tunnel) | 🔴 | Options: run sync where tunnel lives, autossh service, or direct read-replica access |

### Phase 1 — Search per Figma
| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | `zip_codes` table (US zips → lat/lng/city/state, ~42k rows, free dataset) | 🔴 | Prereq: makes zip radius + autocomplete work without external APIs |
| 1.2 | Location autocomplete API (`/api/locations/suggest`) + typeahead input | 🔴 | City & zip suggestions |
| 1.3 | Geocode typed location → lat/lng in search API (today distance only works if browser sends coords) | 🔴 | |
| 1.4 | Distance-bucket filter (10-20 / 20-40 / 40-80 / 80-120 mi per Figma) | 🔴 | API accepts radius; UI buckets missing |
| 1.5 | Provider-type filter (NP / MD / Plastic Surgeon / Dermatologist) | 🔴 | Needs `providers.provider_type` column (see 5.3) |
| 1.6 | Availability filter (Open Today / Weekend) from `hours` jsonb | 🔴 | Data exists, logic missing |
| 1.7 | Starting price on clinic cards (`min(clinic_services.price_from)`) | 🟡 | Columns exist, never surfaced |
| 1.8 | Offers/discount badges ("15% OFF") | 🔴 | Needs `offers` table (see 5.1) |
| 1.9 | Pagination + total count in search API & UI | 🔴 | Currently hard cap 50 |
| 1.10 | Rebuild search results page to Figma (sidebar filters, cards, pagination, testimonials, booking CTA, newsletter) | 🔴 | Largest frontend task |
| 1.11 | Booking form (name, phone, treatment, preferred date/time) → leads | 🟡 | `medspa_leads` exists; add fields (see 5.4) |
| 1.12 | Extend `clinic_search_view` with price / provider types / open-today | 🔴 | Keeps filters fast |

### Phase 2 — AI scraping pipeline (core differentiator)
| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.1 | Page discovery v2: `sitemap.xml` / `wp-sitemap.xml` / `sitemap_index.xml` parsing | 🔴 | Requirement #4 |
| 2.2 | WordPress REST discovery (`/wp-json/wp/v2/pages`) fallback | 🔴 | Free structured page list on most WP sites |
| 2.3 | Page classification (service page vs team vs blog vs policy) — LLM or heuristics+LLM | 🔴 | Today: nav-link regex, 4 page types, ~5 pages max |
| 2.4 | **AI extraction layer**: page HTML→markdown → OpenRouter LLM → zod-validated JSON per entity | 🔴 | Replaces brittle heuristics; keep heuristics as cross-check |
| 2.5 | Deep-scrape individual service pages → per-service description/price/duration | 🔴 | `clinic_services.description/scraped_from_url` columns ready |
| 2.6 | AI provider extraction (name, credentials, specialties, experience, photo, provider_type) | 🟡 | Names-only today |
| 2.7 | Before/after extraction + pairing + treatment association | 🟡 | Heuristic stub exists |
| 2.8 | Clinic stats extraction (`stat_experts`, `stat_patients`, etc. — columns exist, empty) | 🔴 | Figma stats bar |
| 2.9 | Multi-location resolution v2 (scraper = source of truth; G99 rows = hints) | 🟡 | Works today via footer heuristics; add AI pass on /locations pages |
| 2.10 | Wire AI pipeline into existing preview→save flow + `scrape_jobs` tracking + confidence gating | 🟡 | Flow exists for heuristic scraper |
| 2.11 | Headless-browser fallback (Playwright) for JS-rendered sites | 🔴 | Minority of sites, else they scrape empty |
| 2.12 | Extraction quality eval (`eval-scrape-accuracy.ts` exists — extend for AI; measure field-fill rate) | 🟡 | |

### Phase 3 — G99 website ingestion
| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.1 | Website-list extractor: G99 clinics → normalize/dedupe domains (925) → `import_queue` staging table with status | 🔴 | G99 = discovery only; its services data ignored |
| 3.2 | `import_queue` table (domain, source, g99_clinic_ids[], status: pending/scraped/review/saved/failed, attempts, error) | 🔴 | New table (see 5.7) |
| 3.3 | Bulk runner: process queue through AI pipeline (rate-limited, resumable) | 🔴 | 925 domains ≈ batches over days |
| 3.4 | Auto-save high-confidence results; queue low-confidence for admin review | 🔴 | Reuses admin preview UI |
| 3.5 | Pilot run on ~10 domains incl. ruma.com + a multi-location (renovomedispa.com); review & iterate | 🔴 | Gate before bulk run |
| 3.6 | Manual "Add website" single-input flow using same pipeline | 🟡 | Exists for heuristic scraper |
| 3.7 | G99 delta sync (new clinics/websites appear → enqueue) — cron job | 🔴 | cron-server exists; add job |
| 3.8 | Review counts import from `all_review_count` → `clinics.ext_review_count` | 🔴 | Optional, cheap win |
| 3.9 | Image handling: validate/download/CDN (`images.scrape_status` stuck at 'pending') | 🔴 | Hotlinking risk otherwise |

### Phase 4 — Remaining Figma pages
| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.1 | Home page per Figma (hero search, treatment carousel, top cities, clinic/provider carousels) | 🟡 | Page exists, needs redesign to match |
| 4.2 | Search results page | 🔴 | = task 1.10 |
| 4.3 | Clinic individual page (gallery "+18", stats bar, treatment pills, providers, B/A, reviews, booking) | 🟡 | Page exists; needs redesign + data from Phase 2 |
| 4.4 | Provider individual page (credentials, specialties, B/A, reviews, colleagues) | 🟡 | Data model ok; page + data missing |
| 4.5 | Service/treatment individual page (pricing, duration, timeline, clinics near you, providers) | 🟡 | Page exists; fields partly empty |
| 4.6 | Concern pages with tabs (Overview / Clinics & Diagnosis / Doctors & Providers) | 🟡 | Content exists; tabbed filtered lists missing |
| 4.7 | Newsletter signup (footer + banner) | 🔴 | Needs table (see 5.5) |
| 4.8 | Graceful fallbacks for missing data (no price, no photos…) on all cards | 🔴 | Real scraped data will have gaps |

### Phase 5 — DB schema changes
| # | Task | Status | Notes |
|---|------|--------|-------|
| 5.1 | `offers` table (clinic_id, service_id?, label, pct, valid_until, source) | 🔴 | Figma discount ribbons |
| 5.2 | `zip_codes` table | 🔴 | = task 1.1 |
| 5.3 | `providers.provider_type` enum column (np/md/pa/plastic_surgeon/dermatologist/other) | 🔴 | Filter prereq |
| 5.4 | `medspa_leads` + clinic_id, service_id, preferred_date, preferred_time | 🔴 | Booking form |
| 5.5 | `newsletter_subscribers` table | 🔴 | |
| 5.6 | `clinics.highlights` jsonb (bullet tags: "Natural Looking Results"…) | 🔴 | Mirror `providers.highlights` |
| 5.7 | `import_queue` table | 🔴 | = task 3.2 |
| 5.8 | Before/after pairing: `images.pair_id` + `images.service_id` | 🔴 | B/A grouped by treatment |
| 5.9 | `reviews.reviewer_photo_url` | 🔴 | Minor |
| 5.10 | Badge strategy: `clinics.badge` or derive "Customer Favorite" from rating/review thresholds | 🔴 | Decide |
| 5.11 | Provider ↔ location link table | 🔴 | Later; fine on clinic for now |

### Phase 6 — Ops / hardening
| # | Task | Status | Notes |
|---|------|--------|-------|
| 6.1 | Nightly rescrape via cron-server | ✅ | Exists; point at AI pipeline once ready |
| 6.2 | Scheduled G99 sync job | 🔴 | = 3.7 |
| 6.3 | Rate limiting / robots.txt respect / user-agent policy for bulk scraping | 🔴 | 925 domains — be a good citizen |
| 6.4 | LLM cost controls (per-domain token budget, caching, model fallback) | 🔴 | OpenRouter already configured |
| 6.5 | Rotate secrets before launch (OpenRouter key, Neon password, G99 creds — all shared in plaintext) | 🔴 | ⚠️ Important |
| 6.6 | Search performance under real data volume (925+ clinics): indexes, matview refresh cadence | 🔴 | |

---

## 5. Open decisions (need product input)

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Ratings source for cards (4.8★) | (a) Google Places API ~$0.02/clinic · (b) G99 review counts only · (c) both | (c) — Places for rating value, G99/`all_review_count` for counts |
| Auto-save threshold | Fully automatic vs everything through admin review | Auto-save ≥ high confidence, review the rest; tighten after pilot |
| JS-rendered sites | Skip vs Playwright fallback | Playwright fallback, flag-gated (adds infra) |
| LLM model for extraction | Free-tier via OpenRouter vs paid (Claude Haiku/Sonnet) | Pilot with paid Haiku for reliability, measure cost, then decide |
| Tunnel for automation | Laptop tunnel / autossh service / run sync near bastion | Decide before 3.7 |

---

## 6. Suggested execution order

1. **Week 1:** 1.1–1.3 (zip + autocomplete + geocode) ∥ 2.1–2.4 (discovery + AI extraction core)
2. **Week 2:** 3.1–3.5 (queue + pilot on 10 domains) ∥ 5.1–5.7 (schema migrations)
3. **Week 3:** 3.3 bulk run (925 domains) ∥ 1.4–1.12 (filters + search UI rebuild)
4. **Week 4:** Phase 4 pages ∥ 6.x hardening

## 7. Confidence assessment

| Layer | Confidence |
|-------|-----------|
| Search + filters + autocomplete per Figma | ~95% — deterministic engineering |
| Frontend matching Figma (8 screens) | ~90% — build work; need Figma access for exact specs |
| G99 → website list → pipeline | ~90% |
| AI pipeline structure (discover → extract → save) | ~85% |
| **Per-clinic data completeness from scraping** | **~70–80% field fill** — a site can't yield data it doesn't publish (prices, credentials, B/A often absent). Mitigations: graceful UI fallbacks, admin edit, Google Places for ratings |
| Reviews via scraping alone | ~50% — review widgets are JS-injected; use Places API / G99 counts instead |
