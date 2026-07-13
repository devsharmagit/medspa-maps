# Website URL → Data in the DB

> How the AI ingestion pipeline turns a single clinic **website URL** into structured rows in the medspa-map database — every strategy, every field, and exactly where the **LLM** decides vs. where **deterministic code (cheerio/regex)** does the work. Read alongside a worked example (§10).
>
> **Entry point:** `ingestClinicByDomain(domain)` in [web/src/lib/ingest/ingest-clinic.ts](web/src/lib/ingest/ingest-clinic.ts). **Companion docs:** [ARCHITECTURE.md](ARCHITECTURE.md), [medspa-map-db.md](medspa-map-db.md), [ai-vision-plan.md](ai-vision-plan.md). **Last updated:** 2026-07-10.
>
> **In scope now:** basic details, all locations, **images (via Claude vision)**, **before/after photos** (own resolution step, §8), booking URL, working hours, **providers**, and **services/treatments (AI-normalized to a general treatment)** — all via the main `ingestClinicByDomain` pipeline. **Concerns/conditions** (§9) are scraped **separately**, on demand, by a standalone `ingestConcernsByDomain` pipeline — not part of the default full ingest. Out of scope: reviews, ratings.
>
> **AI provider:** both pipelines call through `extractViaTool` ([ai/anthropic.ts](web/src/lib/ai/anthropic.ts)), which routes to Gemini instead of Anthropic when `INGEST_PROVIDER=gemini` is set ([ai/gemini.ts](web/src/lib/ai/gemini.ts)) — same forced-tool-call contract either way, so nothing below changes per provider except which one actually runs.

---

## 0. The core principle

We do **not** dump raw HTML at the LLM (token blowup + it hallucinates URLs). Instead:

> **cheerio gathers raw *candidates* (mechanical) → the LLM *decides* (judgement) → code *validates* the picks against the candidates (anti-hallucination) → heuristics *fall back* per field.**

So the AI does the semantic work (which image is the hero, which link is booking, what are the hours, who is the owner, what general treatment is "RUMA Gold Microchannel Treatment"), while cheerio supplies real material and code guarantees nothing is invented.

For images we go one step further: the AI doesn't just read a list of URLs, it actually **sees** the top images (Claude vision) and picks by sight.

---

## 1. Pipeline at a glance

```
 website domain  (e.g. bareskin-wellness.com)
      │
      ▼
 1. FETCH homepage (fetchHtml)                                      [code]
      │
 2. DISCOVER pages: sitemap.xml / wp-json / nav →                   [heuristic]
      │  locations, contact, about, team, SERVICES, BEFORE/AFTER (≤6 pages)
      ▼
 3. GATHER candidates from every fetched page (cheerio):           [heuristic]
      • page text (htmlToText, tags stripped)   → for the LLM
      • image candidates (img + CSS bg + og + preload + <style>)
      • booking-link candidates (<a> + platforms)
      • provider image candidates (team/about first)
      • SERVICE candidates (nav mega-menu + services page)
      • BEFORE/AFTER candidates (filename match + dedicated-page scan — §8)
      • Google-Maps anchor links
      • heuristic fallbacks: extractImages / extractBookingUrl /
        extractHours / extractProviders / extractServices
      ▼
 4. AI EXTRACT (forced tool `record_clinic`)                        [AI / LLM]
      │  page text + candidate lists + the TOP ~12 images as
      │  actual pictures (base64 vision) + KNOWN TREATMENTS list
      │  → one structured JSON object
      ▼
 4b. BEFORE/AFTER RESOLVE (§8): certain matches need no AI;         [heuristic + AI]
      │  uncertain gallery images → ONE bounded vision classify call
      ▼
 5. VALIDATE picks against candidate lists + FALL BACK to           [code + heuristic]
      │  heuristics per field (URLs must exist on the page)
      ▼
 6. GEOCODE each location (Nominatim: full addr → city-level)       [external API]
      ▼
 7. PERSIST (saveClinicBundle): businesses → clinics →              [code]
      clinic_locations, images (roles incl. before_after), providers,
      clinic_services (mapped to canonical treatments — §7)
      dedup by website domain; delete-then-insert on overwrite
      ▼
 8. REFRESH clinic_search_view (materialized view)                  [code]
```

> **Concerns are not in this diagram** — they run through a separate `ingestConcernsByDomain` pipeline (§9) against an *existing* clinic, with its own page discovery and its own AI call.

Model: **`claude-haiku-4-5`** by default (vision-capable), escalate once to **`claude-sonnet-5`** on parse failure or when zero locations come back. Forced `tool_choice`, `maxTokens 8192`, `retry-after`-aware backoff ([ai/anthropic.ts](web/src/lib/ai/anthropic.ts)).

---

## 2. Stage-by-stage (with examples)

Running example: **`bareskin-wellness.com`**.

### Stage 1 — Fetch · *code*
`fetchHtml(url)` ([scraper/utils.ts](web/src/lib/scraper/utils.ts)) — static HTML only (no headless browser), 15s timeout, follows redirects (records `finalUrl`).
*Example:* `bareskin-wellness.com` → `https://bareskin-wellness.com/` (200, HTML loaded into cheerio as `$home`).

### Stage 2 — Page discovery · *heuristic*
`discoverContentPages($home, url)` ([ingest/discover.ts](web/src/lib/ingest/discover.ts)) finds up to **6** extra pages by combining sitemap(s), WordPress REST `/wp-json/wp/v2/pages`, and a nav-link scan + URL guesses ([scraper/pages.ts](web/src/lib/scraper/pages.ts)), then picking one page per category via `LOC_RE / CONTACT_RE / ABOUT_RE / TEAM_RE / SERVICES_RE / BEFOREAFTER_RE`.
*Example:* discovers `/services/`, `/about/`, `/contact/`, `/meet-the-team/`, `/before-and-after-treatment-images/`. Homepage + these become the `pages[]` array fed to the LLM.
> No URL is ever *guessed* for the before/after page — a dead guess (e.g. `/before-and-after`) would rank ahead of the real sitemap URL in `pick()` and shadow it. Only sitemap/WP-REST/nav hits are used.

### Stage 3 — Candidate gathering · *heuristic (cheerio/regex)*
Per fetched page:
- **Page text** — `htmlToText($)` strips tags → plain text (operates on a **clone**, so the live DOM stays intact for image extraction).
- **Image candidates** — `collectImageCandidates` ([scraper/images.ts](web/src/lib/scraper/images.ts)): every `<img>` (+ lazy attrs), `og:image`, schema.org `logo`, `<link rel=preload as=image>`, and **CSS `background-image`** (inline style, Elementor `data-settings`, `<style>` blocks). Each tagged with a `context` (og-image/header/hero/gallery/background/footer/…).
- **Booking-link candidates** — `collectBookingLinkCandidates` ([scraper/contact.ts](web/src/lib/scraper/contact.ts)): `<a>` signalling booking or pointing at a known scheduler (Vagaro, GlossGenius, Boulevard, Zenoti, Square…). Fragment/relative hrefs resolved to absolute.
- **Provider image candidates** — `collectImageCandidates` over **content/team pages first** (headshots live there), homepage as filler, cap 80.
- **Service candidates** — `extractServicesFromNav` (the nav mega-menu — captures the full catalogue site-wide) + `extractServiceAnchors` + `extractServices` on the services page ([scraper/services.ts](web/src/lib/scraper/services.ts)), cap 80.
  *Example (bareskin nav):* `Botox®`, `Chemical Peels`, `Dermaplaning`, `Fillers`, `Hair Restoration`, `Hormone Therapy`, `Hydrafacial`, `InBody Scan`, `Microneedling`, `RF Microneedling`, `PRP Injections`, `Vitamin B12 Injections`, `Weight Management Program`, … (16 found).
- **Before/after candidates** — every page is scanned for images whose **filename** matches the B&A pattern (`isBeforeAfterUrl`, [scraper/beforeafter.ts](web/src/lib/scraper/beforeafter.ts)); a page whose URL is a dedicated before/after page additionally has *every* content image pulled via `extractBeforeAfter`. Partitioned into **certain** (no AI needed) vs **uncertain** (§8). *Example (ruma.com):* `Dysport-BeforeandAfter-Ruma.webp`, `Fillers-BeforeandAfter-Ruma5-….webp` — filename-certain, no AI call needed.
- **Maps links** — `collectMapsLinks` / `pickMapsLink`.
- **Heuristic fallbacks** computed in parallel: `extractImages`, `extractBookingUrl`, `extractHours`, `extractProviders`, `extractServices`.

### Stage 4 — AI extraction (with vision) · *AI / LLM*
`extractClinicDetails` ([ingest/ai-extract.ts](web/src/lib/ingest/ai-extract.ts)) sends Claude, in **one forced tool call** (`record_clinic`):
1. the **page text** of every fetched page,
2. the **candidate lists** (images, booking, provider images, services),
3. the **top ~12 candidate images as actual pictures** — fetched by us and sent **base64** so the model judges the cover/logo/gallery *by sight* (see §6),
4. a **KNOWN TREATMENTS** list — the live catalog names so the model reuses an existing general treatment before inventing one (see §7).

The model returns one JSON object: business details, `locations[]`, `cover_image_url`/`logo_url`/`gallery_image_urls[]`, `working_hours[]`, `providers[]`, and `services[]` (`{raw_name, general_name, category}`). It must copy image/booking URLs **verbatim** from the candidate lists. Before/after images are **not** part of this call — they're resolved separately, next.

### Stage 4b — Before/after resolution · *heuristic + bounded AI vision* (full detail: §8)
`resolveBeforeAfter` ([ingest/before-after.ts](web/src/lib/ingest/before-after.ts)): **certain** candidates (filename match or dedicated-page origin) need no AI at all. **Uncertain** candidates (generic gallery/results page, no filename signal) are sent to `classifyBeforeAfterImages` — one bounded vision call, only when there's still room under the cap. Results are de-duped against the cover/logo/gallery URLs just chosen in Stage 4 (load-bearing — see the `images` unique-key gotcha in [medspa-map-db.md](medspa-map-db.md)), capped at **10**, and labelled from the filename's treatment token when present.

### Stage 5 — Validate + fallback · *code + heuristic*
For each AI pick, code checks the URL is actually in the candidate set (drops hallucinations). If the AI returns nothing/invalid for a field, the pipeline falls back to the heuristic extractor for that field ("AI-first, heuristic-fallback").

### Stage 6 — Geocode · *external API*
`geocodeAddress` ([lib/geocoder.ts](web/src/lib/geocoder.ts)) → Nominatim. Tries the full street address, then a city-level "City, State ZIP" query. Fills `lat`/`lng`/`geo` per location.

### Stage 7 — Persist · *code*
`saveClinicBundle(bundle, {overwrite:true})` ([admin/clinic-save.ts](web/src/lib/admin/clinic-save.ts)). Dedup key = **website domain**. On overwrite, `clinic_locations`, `clinic_services`, scraped `images`, and `providers` are **delete-then-inserted** (curated CDN'd image rows preserved). Services go through the **canonical resolver** (§7).

### Stage 8 — Refresh
`REFRESH MATERIALIZED VIEW clinic_search_view`. *(The public search route reads live base tables; the matview is refreshed for consumers that use it — it holds the GIN-indexed `service_slugs[]` used for treatment filtering.)*

---

## 3. Where AI vs heuristic vs code vs external

| Concern | Who does it |
|---|---|
| Page fetch, redirects | **code** (`fetchHtml`) |
| Page discovery (sitemap/wp-json/nav) | **heuristic** |
| Gather image/booking/provider/service/maps candidates, page text | **heuristic** (cheerio/regex) |
| Business name, about, tagline, email, phone, socials | **AI** |
| Locations (address/city/state/zip/phone split per branch) | **AI** (+ `parseUSAddress` fallback) |
| Cover / logo / gallery **selection** | **AI vision** (sees the images) → **heuristic** fallback |
| Booking URL **selection** | **AI** picks from candidates → **heuristic** fallback |
| Working hours **parsing** | **AI** → **heuristic** fallback |
| Providers (name / title / headshot / owner / tagline) | **AI** picks from candidates → **heuristic** fallback |
| Services: extract raw name + propose **general treatment** | **AI** (sees candidates + known catalog) → **heuristic** fallback |
| Service **normalization / canonical mapping** | **code** (`matchService` + `bestCatalogMatch` + find-or-create) |
| Before/after: filename match / dedicated-page origin | **code** (regex — no AI, "certain") |
| Before/after: generic gallery-page image classify | **AI vision**, bounded (only "uncertain" candidates, §8) |
| Before/after: label, de-dup vs cover/gallery, cap | **code** |
| Concerns: does the page explicitly name a condition? | **AI**, text-only, evidence-quote required (§9) |
| Concerns: quote genuinely on the page? | **code** — machine-verified, invented quotes discarded (§9) |
| Concerns: canonical mapping (curated match / AI-grown create) | **code** (`bestCatalogMatch` + find-or-create, same shape as services) |
| Validate AI URLs exist on page (anti-hallucination) | **code** |
| Owner-only tagline + owner-first ordering | **code** |
| State full-name, slug, domain dedup, delete-then-insert | **code** |
| Geocoding (lat/lng) | **external API** (Nominatim) |

---

## 4. Field-by-field resolution

### `businesses`
| Field | Source | How |
|---|---|---|
| `name` | AI | `business_name` (fallback: domain) |
| `data_source`, `tier`, `verified`, `is_active` | code | `'scraped'`, `free`, false, true |

### `clinics` (clinic-level mode — headline address/geo blank; detail in `clinic_locations`)
| Field | Source | How |
|---|---|---|
| `name` | AI | `business_name` (fallback domain) |
| `slug`, `website` | code | `uniqueClinicSlug`; resolved `finalUrl` |
| `booking_url` | **AI → heuristic** | AI `booking_url` validated ∈ booking candidates; else `extractBookingUrl` |
| `hours` (jsonb) | **AI → heuristic** | AI `working_hours[]` → `{DAY:{open,close,is_open}}`; else `extractHours` |
| `about`, `tagline`, `email`, `phone` | AI | from page text |
| `instagram_url`…`yelp_url` | AI | social URLs copied from text |
| address/city/state/zip/lat/lng/geo | — | **blank at clinic level** (per-location) |
| `avg_rating`, `review_count`, `stat_*`, `founded_year` | — | **not scraped** |

### `clinic_locations` (one row per AI-detected location)
| Field | Source | How |
|---|---|---|
| `address`, `city`, `zip`, `phone` | AI | AI `locations[]` (+ `parseUSAddress` fallback) |
| `state` | AI + code | stored as **full name** via `stateFullName` |
| `google_maps_url` | heuristic | `pickMapsLink` — on-page Maps anchor matched to this location |
| `hours` (jsonb) | AI → heuristic | inherits clinic-wide hours |
| `lat`, `lng`, `geo` | external | `geocodeAddress` (Nominatim) |
| `is_primary`, `sort_order` | code | false / array index |

### `images` (polymorphic, `entity_type='clinic'`)
| Role | Source | How |
|---|---|---|
| `cover` | **AI vision → heuristic** | AI `cover_image_url` (validated ∈ candidates; logo excluded); else `extractCover`. *Example (germain): `homepageslider2.webp`.* |
| `logo` | **AI vision → heuristic** | AI `logo_url` (validated); else schema.org/header. *Example: `Asset-1.png`.* |
| `gallery` | **AI vision → heuristic** | AI `gallery_image_urls[]` (validated, minus cover/logo, promos filtered); else `extractGallery`. Cover stored first. |
| `before_after` | **heuristic ("certain") → bounded AI vision ("uncertain")** | see §8 — filename/dedicated-page matches need no AI; only ambiguous gallery images go through one bounded classify call. Cap 10; disjoint from `gallery` (shown in its own carousel, never the regular gallery). |

### `providers` (owner/CEO/founder first)
| Field | Source | How |
|---|---|---|
| `name` | AI | person name (credentials stripped) |
| `title` | **AI → heuristic** | role/credentials, prefers medical designation ("DNP, FNP-C", "CEO, Medical Director, Founder") |
| `image_url` | **AI → heuristic** | headshot verbatim from provider candidates, matched by name; NULL → UI placeholder |
| `card_tagline` | AI | **owner only** — also the owner-first sort key (`ORDER BY (card_tagline IS NOT NULL) DESC, name`) |
| bio/credentials/specialties/… | — | **intentionally not populated** |

### `clinic_services` + `services` (the treatment mapping — see §7)
| Field | Source | How |
|---|---|---|
| `raw_name` | AI | service **exactly as written** (keeps `®/™`, brand words) |
| `service_id` | **AI + code** | AI proposes `general_name`; code resolves it to a canonical `services` row (curated match → DB catalog → create). NULL if it doesn't resolve. |
| `match_status`, `match_confidence` | code | `matched` (exact/alias, conf 1), `auto` (fuzzy/AI-created), or `unmatched` |
| `data_source`, `scraped_from_url` | code | `'scraped'`, the source page |
| `services.origin` | code | `'seed'` (curated 15), `'ai'` (created by the resolver), or `'manual'` |

### `clinic_concerns` + `clinic_concern_evidence` (evidence-based — see §9; **separate pipeline**, not part of `ingestClinicByDomain`)
| Field | Source | How |
|---|---|---|
| `clinic_concerns.source` | code | `'scraped'` — set only when ≥1 evidence row survives verification for that concern |
| `clinic_concerns.concern_id` | **AI + code** | AI proposes `general_name`; code resolves it to a canonical `concerns` row (curated match → DB catalog → create), same shape as services §7 |
| `clinic_concern_evidence.raw_phrase` / `.evidence_quote` / `.source_url` | AI, machine-verified | AI returns the concern phrase + a verbatim quote + the page it came from; code re-checks the quote is genuinely on that page before anything is stored (§9) — an invented quote is discarded, not stored |
| `clinic_concern_evidence.paired_treatments` / `.paired_service_ids` | AI + code | treatment names the SAME page connects to the concern (verbatim), resolved against the clinic's own `clinic_services` where confident |
| `concerns.origin` | code | `'seed'` (curated 10), `'ai'` (created by the resolver, `is_published=false`), or `'manual'` |

---

## 5. Anti-hallucination validation

The LLM copies image/booking URLs **verbatim** from the candidate lists. After extraction, code re-checks: `cover_image_url`, `logo_url`, each `gallery_image_urls[]`, each provider `image_url` must be in the image-candidate set (else dropped/nulled); `booking_url` must be in the booking-candidate set (else heuristic fallback). Services keep their **raw_name always** — the AI's `general_name` is only a *suggestion* for the canonical mapping, which code re-derives (§7), so a bad suggestion can't corrupt the stored raw offering.

The concerns pipeline (§9) applies the same principle one level deeper: it's not enough for a URL to be *real* — the AI's claim that a page "says X" must be checked against what the page **actually says**. Every concern's `evidence_quote` is machine-verified as a genuine (fuzzy-tolerant) substring of that exact page's text before anything is stored; a quote that doesn't check out is discarded, not silently trusted.

---

## 6. Images via Claude vision · *AI*

Instead of guessing the cover/logo/gallery from filenames, the model **sees** them ([ai-vision-plan.md](ai-vision-plan.md)):
- `buildVisionImages()` ranks the image candidates by context (`og-image → schema-logo → preload → header → hero → background → gallery → footer → body`), takes the **top 12**, and **fetches + base64-encodes** each (jpeg/png/gif/webp; SVG unsupported → stays a text-only candidate).
- They're sent as image blocks interleaved with a text label carrying each URL, so the model returns the chosen URL verbatim.
- **Why base64, not URL source:** the org's "URL Content Fetching" limit is ~10 req/min, so sending 12 image URLs 429s immediately — we fetch the bytes ourselves instead.
- Vision runs on the **primary Haiku attempt only**; the escalation retry is **text-only**, so a broken image can't fail extraction.
*Example result (germain): cover = `homepageslider2.webp` (real hero, not the logo), logo = `Asset-1.png`, gallery = 11 real clinic photos, no promos/icons.*

---

## 7. Services → AI-grown canonical catalog · *AI + code*

**Goal:** store every service a clinic offers, and resolve each to a **general treatment name** so users search by treatment and variants collapse — `Botox®` and `botox` are one treatment; a clinic maps *to* `botox`, never the reverse.

**The catalog is AI-grown** (not frozen at the 15 Phase-0 treatments). The `services` table is the canonical catalog (`origin='seed'` for the 15; `origin='ai'` for ones the AI grew; `origin='manual'` for admin). `clinic_services` is the clinic⇄treatment join, keyed `(clinic_id, raw_name)`, with `service_id` pointing at a canonical row (NULL = unresolved).

**AI step:** for each service the model returns `{ raw_name (verbatim), general_name (the general treatment; prefer a KNOWN TREATMENT, else a new generic name — no brand/®/™), category }`. It's *shown the current catalog names* so it reuses them.

**Code step — the resolver** ([admin/clinic-save.ts](web/src/lib/admin/clinic-save.ts)), per service, raw name always stored:
1. **Admin override** (`mapped_slug`) → that canonical row.
2. **Curated `matchService(raw)`** — the 15 + rich brand aliases (`normalize()` strips `®™`; Dice ≥0.55). *Example:* `Botox®`, `Dysport®` → `botox`; `RUMA Gold Microchannel Treatment` → `microneedling`.
3. **`bestCatalogMatch(raw, liveCatalog)`** — matches against the **live DB catalog** (includes previously AI-grown rows), so a later clinic's `IV Therapy` links to the row an earlier clinic created.
4. **AI `general_name`** — de-dup against the catalog (`bestCatalogMatch(gen, 0.72)`; higher bar to avoid over-merging). If a close treatment exists → link it; otherwise **create a new `services` row** (`origin='ai'`, slug from `slugify`, seeded with the raw name as an alias). *Example:* `Hormone Therapy` → creates `hormone-therapy`; a second clinic's `Bioidentical Hormone Replacement` (general_name "Hormone Therapy") → **links to the same row**, no duplicate.
5. Else → `service_id = NULL` (stored, still searchable via `slugify(raw_name)` in the view).

**De-dup happens at two levels:** variant → one canonical (step 2), and new-canonical → existing-canonical (step 4).

**reconcile stays safe:** `reconcile-taxonomy.ts` only deletes `origin='seed'` rows outside the 15, so AI-grown treatments survive; its re-match uses `matchService` then `bestCatalogMatch` against the full catalog so AI-grown links aren't nulled.

**Search is automatic:** `/api/search`, `/treatments/[slug]`, `/api/services`, and `clinic_search_view.service_slugs[]` all read the `services` table, so AI-grown treatments become searchable/browseable with no extra wiring.

---

## 8. Before/After images · *heuristic + bounded AI vision*

**Goal:** capture a clinic's before-&-after **composite** photos (single image, before+after already side by side — e.g. `Dysport-BeforeandAfter-Ruma.webp`) as their own `images.role='before_after'`, disjoint from the regular `gallery`, capped at **10/clinic**. Some clinics genuinely have none (e.g. a JS-rendered gallery with no static filename signal) — that's a correct "skip", not a failure.

**Classification — 3 tiers, cap 10, most need no AI at all:**
1. **Certain — filename match.** `isBeforeAfterUrl` ([scraper/beforeafter.ts](web/src/lib/scraper/beforeafter.ts)) tests `BA_FILENAME_RE` (`before[-_. ]*(and[-_. ]*)?after`, `beforeafter`, `b&a`, `b2a`) against every image URL on every fetched page — homepage included. No AI.
2. **Certain — dedicated before/after page.** When a fetched page's URL itself reads as a before/after page (`BA_DEDICATED_RE`), **every** content image on it is trusted via `extractBeforeAfter($, url)` ([scraper/beforeafter.ts](web/src/lib/scraper/beforeafter.ts)) — that's exactly what a dedicated page is for. No AI.
3. **Uncertain — generic gallery/results page.** An image with no filename signal, from a page that only generically looks gallery-ish (`gallery`, `results`, `transformations`), is not trusted automatically. These go to `classifyBeforeAfterImages` ([ingest/ai-extract.ts](web/src/lib/ingest/ai-extract.ts)) — **one bounded vision call** (cap 12 images sent), asking "which of these are before-&-after composites?" — and **only runs at all** when certain matches haven't already filled the cap. Confirmed URLs are validated against the candidate set (anti-hallucination, same as cover/logo/gallery).

**Collection is shared code** ([ingest/before-after.ts](web/src/lib/ingest/before-after.ts)) — `newBeforeAfterCandidates` / `scanPageForBeforeAfter` / `resolveBeforeAfter` — used by both the full ingest (`ingestClinicByDomain`) and the standalone refresh below, so the two paths can't drift apart.

**Resolution** (`resolveBeforeAfter`): de-dup candidates against the cover/logo/gallery URLs already chosen for this clinic — **load-bearing**, not cosmetic: the `images` unique key is `(entity_type, entity_id, source_url)` with **no `role` column in the key**, so a URL inserted as `gallery` first would make a later `before_after` insert of the *same URL* a silent `ON CONFLICT DO NOTHING` no-op. Then cap at `BA_CAP = 10`, keeping certain matches first.

**Labelling:** `alt_text` prefers a treatment token parsed from the **filename**, checking both conventions (`Dysport-BeforeandAfter-Ruma` → "Dysport"; `Before-and-After-Botox-k-<hash>` → "Botox" — treatment can sit on either side of the before/after anchor). Falls back to a non-generic on-page `alt`, else the clinic name. *(Site `alt` text is frequently one generic SEO string repeated on every image — trusting it directly would caption every tile identically.)*

**Persisted via `saveClinicBundle`** (no schema change needed — `images.role='before_after'` already existed): inserted after `gallery`, curated `cdn_url`/`storage_key` rows preserved on rescrape. The daily rescrape cron does **not** delete `before_after` rows (its detector never produces them, so deleting would just wipe scraped B&A every night with nothing to replace it).

**Standalone refresh** — touches ONLY this role, nothing else on the clinic (no re-scrape of locations/images/providers/services):
```bash
bun --env-file=.env scripts/ingest-before-after.ts <domain> [more…]
#   → prints: saved | slug=… | found=N inserted=N deleted=N
```
`ingestBeforeAfterByDomain` ([ingest/ingest-before-after.ts](web/src/lib/ingest/ingest-before-after.ts)) resolves the clinic by domain (never creates one), re-runs discovery + collection + resolution, then deletes this clinic's existing scraped `before_after` rows and re-inserts (idempotent).

**Verified example (`ruma.com`):** 16 filename-certain candidates found on its dedicated `/before-and-after-treatment-images/` page → capped to **10** → 0 overlap with `gallery`/`cover` → labels `"Dysport before & after"`, `"Fillers before & after"` ×8, `"Kybella before & after"`.

---

## 9. Concerns → evidence-based AI-grown catalog · *AI + code* (standalone pipeline)

**Goal:** show patients what **conditions** a clinic treats (sagging skin, acne scars, hyperpigmentation…) rather than only treatment names — and do it **accurately**: a clinic "treats" a concern only when its own website **explicitly says so**, never inferred from a treatment name alone ("offers Botox" does **not** imply "treats wrinkles"). The same concern can be paired with a different treatment per clinic (a non-surgical facelift might mean Ultherapy at one clinic, PDO threads at another) — that per-clinic pairing is captured too, when the page states it.

**This is a separate pipeline from the main ingest** — `ingestConcernsByDomain` ([ingest/ingest-concerns.ts](web/src/lib/ingest/ingest-concerns.ts)) resolves an **already-existing** clinic by domain and touches **only** the concern layer (`clinic_concerns` rows with `source='scraped'` + their `clinic_concern_evidence` rows). It never creates a clinic and never touches locations/images/providers/services.

### 9.1 Page discovery — condition pages + per-treatment pages
`discoverConcernPages` ([ingest/discover.ts](web/src/lib/ingest/discover.ts)) is deliberately different from the main ingest's discovery: concern evidence lives on **condition-named pages** (`/acne/`, `/acne-scarring/`, `/self-assessment/` — `CONCERN_HUB_RE` + `CONCERN_WORD_RE`) and on **individual treatment pages** (`SERVICE_DETAIL_RE` — that's where a site's "X treats concerns like Y, Z" prose actually sits, not on the services hub page the main ingest fetches). Up to **4 condition pages + 6 service pages** (constants, tunable). Per-city SEO variants of the same page (`/acne-scarring-in-tampa-fl/` vs `-in-melbourne-fl/`) are deduped to one; noise (blog/shop/location-SEO) is filtered; shorter/dedicated paths are preferred over long blog-post slugs that merely mention a condition word.

### 9.2 AI extraction — one forced tool call, text-only
`extractClinicConcerns` ([ingest/ai-extract-concerns.ts](web/src/lib/ingest/ai-extract-concerns.ts)), forced tool `record_clinic_concerns`. For each concern found, the model returns `{ raw_phrase, general_name, paired_treatments[], source_url, evidence_quote }`. The system prompt is explicit about what's forbidden, not just what's wanted:
- Record a concern **only** when the page text explicitly treats/addresses/targets/names the condition — never infer from a treatment name alone.
- `evidence_quote` must be copied **verbatim** — it will be machine-verified (§9.3); a paraphrased or invented quote is worthless to the model since it just gets discarded.
- `paired_treatments` only when the *same* sentence/section connects a treatment to the concern.
- Ignore marketing adjectives with no named condition ("radiant", "refreshed"), vague umbrella phrases ("skin challenges"), and **patient testimonials/reviews** (that's the patient talking, not the clinic asserting what it treats).
- A `KNOWN CONCERNS` block (live catalog names + aliases) is injected so the model reuses an existing concern before inventing one — same convention as `knownTreatments` in §7.

### 9.3 Machine verification — the accuracy guarantee
`validateConcerns` ([ingest/concern-validate.ts](web/src/lib/ingest/concern-validate.ts)) re-checks every returned item; nothing is trusted on the AI's word:
1. `source_url` must be one of the pages actually supplied.
2. `evidence_quote` must genuinely appear on that page — normalized substring match, with a token-shingle Dice-≥0.9 fallback for minor whitespace/entity drift. **Not found → discarded.**
3. The quote must actually name the claimed concern (substring or fuzzy ≥0.6) — blocks a real quote about something else being misattributed.
4. Rejects vague marketing categories (regex against words like "challenge", "journey", "wellness", "confidence") and testimonial-voice quotes ("I did…", "I had…").
5. Dedupes; caps at **`CONCERN_CAP = 12`/clinic**, keeping known-catalog concerns first, then most-evidenced.

Every rejection is reported with its reason (`scripts/ingest-concerns.ts` prints them) — nothing fails silently.

### 9.4 Canonicalization — AI-grown catalog (same shape as services, §7)
Validated `general_name` → `bestCatalogMatch` (≥0.72) against the live `concerns` catalog (curated 10 + previously AI-grown). Hit → reuse the row, append the raw phrase as an alias (only on `origin='ai'` rows — curated rows are never mutated). Miss → create a new `concerns` row (`origin='ai'`, `is_published=false` — no editorial copy yet, so it stays off the public `/conditions` index while still usable for clinic-page chips). `reconcile-taxonomy.ts` only ever deletes non-priority `origin='seed'` rows, so AI-grown concerns survive taxonomy re-runs, identical to the services protection.

### 9.5 Persistence — replace-scraped-state, admin overrides untouched
Deletes this clinic's `clinic_concern_evidence` rows + `clinic_concerns WHERE source='scraped'`, then re-inserts. **Never touches** `source='manual'` (admin-added) or `source='removed'` (admin-suppressed) rows — an admin's edits survive every re-scrape. Effective membership (what the clinic page shows) = `(scraped ∪ manual) − removed` — **no service-derived fallback**; a clinic with nothing scraped and nothing manual simply shows no concerns section, which is correct (§9 gotcha in [medspa-map-db.md](medspa-map-db.md)).

### 9.6 Run / verify
```bash
bun --env-file=.env scripts/ingest-concerns.ts <domain> [more…]
#   → prints, per clinic: concerns accepted (each with its verbatim quote + page +
#     paired treatments) AND every rejected AI item with its reason
```

**Verified examples (all three quotes spot-checked against the live sites):**
| Clinic | Concerns | Sample |
|---|---|---|
| `ruma.com` | 12 | "Helps address: Fine lines and wrinkles Hyperpigmentation Acne scars Skin laxity Rosacea…" (Morpheus8 page) → Wrinkles & Fine Lines, Hyperpigmentation, Rosacea, … each paired with the treatment named alongside |
| `ar-aesthetics.com` | 10 | "An FDA-approved injectable medication called Kybella is used to treat submental fat, also referred to as double chin" → Double Chin, paired with `["Kybella"]` |
| `medimorph.com` | 9 | "Acne scarring occurs when the dermis and epidermis are destroyed" (dedicated `/acne-scarring/` page) → Acne Scars |

Negative test that matters most: none of the three produced an unevidenced concern from a bare treatment listing (e.g. ruma's Botox mentions with no condition language attached yielded nothing from those pages) — confirming the "never infer from a treatment name" rule holds in practice, not just in the prompt.

---

## 10. Models, escalation, cost, rate limits

- **Transport:** Anthropic Messages API via raw `fetch` (no SDK), forced `tool_choice` on `record_clinic`, `ANTHROPIC_API_KEY`.
- **Default model:** `claude-haiku-4-5` (env `INGEST_MODEL`), vision-capable. **Escalation:** `claude-sonnet-5` — once, **text-only**, if the first call throws/zod-fails or Haiku returns zero locations.
- **One LLM call per clinic** (+ at most one escalation). Images, booking, hours, providers, and services all reuse that single structured response — no per-field calls.
- **Rate limits (this org):** `postWithRetry` retries `429`/`529` honouring `retry-after`. The Haiku input budget is ~**10K tokens/min** (a vision call is ~15K, so back-to-back calls wait) — bulk runs are throttled; raise the org limit before a full corpus pass.
- **Billing:** a `400 "credit balance too low"` is a **depleted-balance** error (top up in the Anthropic Console) — not a timed rate limit; it does not reset on its own.
- **Cost:** ~$0.05/clinic all-in on Haiku; the nightly rescrape cron uses the **heuristic** scraper (no AI), so this is an initial-ingest / manual-re-ingest cost, not a daily one.

---

## 11. What is intentionally NOT scraped (current scope)

`reviews`, clinic `stat_*`, ratings/review counts, and rich provider fields (bio/credentials/specialties). Services, providers, images (including before/after, §8), booking, and hours **are** scraped by the main ingest. Concerns (§9) **are** scraped, but only via the standalone `ingestConcernsByDomain` pipeline — not automatically as part of every full ingest yet (deliberate: verify a clinic's concerns look right before making it default behavior for every new clinic).

---

## 12. Worked example — `bareskin-wellness.com` end to end

| Step | What happens |
|---|---|
| **Fetch** | `https://bareskin-wellness.com/` loaded. |
| **Discover** | `/services/`, `/about/`, `/meet-the-team/`, `/contact/` picked (≤5). |
| **Gather** | Page text per page; image candidates (hero, logo, gallery, CSS-bg); booking candidate (its scheduler link); provider headshots from the team page; **16 service candidates** from the nav mega-menu (`Botox®`, `Hydrafacial`, `Hormone Therapy`, `RF Microneedling`, `Weight Management Program`, `Vitamin B12 Injections`, …). |
| **AI extract** | One Haiku call: sees the top 12 images (base64), the candidate lists, and the KNOWN TREATMENTS list. Returns business/about/socials, locations, cover/logo/gallery URLs, hours, providers, and `services[]` like `{raw_name:"Botox®", general_name:"Botox"}`, `{raw_name:"RF Microneedling", general_name:"Microneedling"}`, `{raw_name:"Weight Management Program", general_name:"Medical Weight Loss"}`. |
| **Validate** | Cover/logo/gallery URLs confirmed to exist on the page; booking URL confirmed ∈ candidates. |
| **Geocode** | Location address → lat/lng via Nominatim. |
| **Persist → services** | `Botox®` → curated `botox`; `Hydrafacial` → curated `hydrafacial`; `RF Microneedling` → curated `microneedling`; `Hormone Therapy` / `Vitamin B12 Injections` / `Weight Management Program` → **created `origin='ai'`** (not in the 15) and reused by the next clinic that offers them. Each stored in `clinic_services` with its `raw_name` + resolved `service_id` + `match_status`. |
| **Refresh** | `clinic_search_view` rebuilt; `service_slugs` now include `botox`, `hydrafacial`, `microneedling`, `hormone-therapy`, … so the clinic surfaces for those treatment searches. |

Net result: one `businesses` row, one `clinics` row, its `clinic_locations`, `images` (one `cover`, one `logo`, clean `gallery`), `providers` (owner first), and ~16 `clinic_services` rows each mapped to a clean general treatment.

---

## 13. Run / re-run / verify

```bash
cd web
# single or several sites (full AI pipeline — locations/images incl. before_after/
# providers/services/booking/hours; does NOT touch concerns, see below):
bun --env-file=.env scripts/ingest-one.ts <domain> [more…]
#   → prints: saved | model=… | locs=N | geo=N | imgs=N | providers=N | services=N | b&a=N

# before/after ONLY, for an EXISTING clinic — no other field touched (§8):
bun --env-file=.env scripts/ingest-before-after.ts <domain> [more…]
#   → prints: saved | slug=… | found=N inserted=N deleted=N

# concerns ONLY, for an EXISTING clinic — no other field touched (§9):
bun --env-file=.env scripts/ingest-concerns.ts <domain> [more…]
#   → prints, per clinic, accepted concerns w/ quotes + rejected items w/ reasons

# isolated heuristic scrape check (no DB / no API key):
bun scripts/check-scrape.ts <domain>
# isolated vision image-pick check (needs API key, no DB):
bun scripts/check-vision.ts <domain>

# taxonomy reconcile (idempotent; --dry to preview). Protects origin!='seed'
# on BOTH services and concerns.
bun scripts/reconcile-taxonomy.ts --dry

# one-time migrations (or apply via a bun query):
psql "$DATABASE_URL" -f scripts/add-services-origin.sql        # services.origin
psql "$DATABASE_URL" -f scripts/add-concern-evidence.sql       # concerns.origin + clinic_concern_evidence
```

Re-ingest is idempotent: dedup by website domain + delete-then-insert refreshes locations/images/providers/services in place; the before/after- and concerns-only scripts are equally idempotent but scoped to just that one field. Needs `DATABASE_URL` + an AI key — either `ANTHROPIC_API_KEY`, or set `INGEST_PROVIDER=gemini` + `GEMINI_API_KEY` to route every call in this doc through Gemini instead (both pipelines share the same `extractViaTool` entry point, so nothing else changes).
