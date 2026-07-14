# AI Extraction: Treatments & Concerns — Unified Brute-Force Pass (worked example: `ruma.com`)

> **2026-07-14 unified update:** `ingestTreatmentsAndConcernsByDomain()` is now the preferred treatments+concerns refresh. It performs **one AI extraction pass** that sees website content, known `services`, and known `concerns` together, then writes:
>
> - `clinic_services` (refreshed replacement set)
> - `clinic_concerns` with `source='scraped'` (refreshed replacement set)
> - `clinic_service_concerns` (new clinic-specific triples: `clinic_id + service_id + concern_id`)
>
> Evidence quotes are intentionally not required in this brute-force path. The goal is a simple current-state mapping: "this clinic solves this condition with this service." Stale scraped rows are deleted before the new scraped set is inserted, so if a clinic removes "dark spots" from the website, the next refresh removes that scraped clinic association too. Manual/admin rows remain a separate override layer.
>
> The older standalone `ingestServicesByDomain()` and `ingestConcernsByDomain()` modules still exist, but the combined script `bun scripts/ingest-treatments-concerns.ts ruma.com` now uses the unified one-pass AI layer instead of chaining those two extractors.

> **2026-07-14 update:** treatments/services extraction was split OUT of `ingestClinicByDomain()` into its own standalone module (`ingest-services.ts` / `ai-extract-services.ts`), the same way concerns already were — specifically so treatments+concerns can be re-run for one clinic without touching (or re-scraping/re-extracting) the rest of its details. The clinic-DETAILS pipeline (`ingestClinicByDomain`) now extracts only business info, locations, providers, images, hours, and booking; it no longer touches `clinic_services` at all. See the updated table and §A.1a below — the rest of this doc's prompt rules, resolution logic, and ruma.com examples are unchanged (they describe the SAME logic, just invoked from a different, dedicated call).
>
> Scope: **only** the treatment/service pipeline and the concern pipeline. Not covered: locations, images, providers, hours, booking (own pipeline: `ingestClinicByDomain`).
>
> Three **independent, composable** pipelines exist — they run separately, call different AI prompts, and write to different tables:

| | Clinic Details | Treatments / Services | Concerns |
|---|---|---|---|
| Entry point | `ingestClinicByDomain()` | `ingestServicesByDomain()` — standalone | `ingestConcernsByDomain()` — standalone |
| Script | `bun scripts/ingest-one.ts ruma.com` (details + services together) | `bun scripts/ingest-services.ts ruma.com` (alone) | `bun scripts/ingest-concerns.ts ruma.com` (alone) |
| AI call | `extractClinicDetails()` — business/locations/providers/images/hours/booking only | `extractClinicServices()` — services only | `extractClinicConcerns()` (1+ calls) — concerns only |
| Tables written | `clinics`, `clinic_locations`, `images`, `providers` | `clinic_services` → `services` | `clinic_concerns` + `clinic_concern_evidence` → `concerns` |
| Can create a clinic? | Yes (website-only ingest) | No — resolves an **existing** clinic only | No — resolves an **existing** clinic only |
| Depends on another? | No | No | **Yes** — a concern is only kept if it ties to one of this clinic's already-saved services (see Part B, step 6) |

**Treatments + concerns together, reusable per-clinic:** `ingestTreatmentsAndConcernsByDomain()` (`web/src/lib/ingest/ingest-treatments-concerns.ts`, script: `bun scripts/ingest-treatments-concerns.ts ruma.com`) composes `ingestServicesByDomain()` then `ingestConcernsByDomain()` — the only useful order, since concerns depend on services already existing. Touches nothing about clinic details. This is the one call to reach for when a clinic's treatments/concerns need refreshing without re-scraping its details.

All AI calls eventually reach the same low-level transport, `extractViaTool()` in `web/src/lib/ai/anthropic.ts`, which dispatches to Anthropic / Gemini / OpenAI based on `INGEST_PROVIDER`. Nothing below changes per-provider except which model actually answers.

---

## PART A — Treatments / Services

### A.0 What actually happened for ruma.com (ground truth, live DB)

`clinic_services` currently holds **29 rows** for `ruma-medical`. A representative slice:

| `raw_name` (verbatim from the site) | → `service_id` resolves to | `match_status` | how it resolved |
|---|---|---|---|
| `Botox®` | Botox (`botox`, seed) | matched, 1.0 | curated alias match |
| `RUMA Gold Microchannel Treatment` | Microneedling (`microneedling`, seed) | matched, 1.0 | **hardcoded special-case** in `normalizeServiceOutput` |
| `Dysport®` | Dysport (`dysport`, **ai**-created) | matched, 1.0 | AI `public_decision="public"` → its own row, not folded into Botox |
| `Morpheus8 Treatment` | Morpheus8 (`morpheus8`, ai) | matched, 1.0 | AI public decision → own row |
| `Sculptra` / `Radiesse` (from one page `sculptra-radiesse-in-lehi-ut`) | Sculptra / Radiesse (2 separate rows) | matched, 1.0 | **hardcoded split** in `normalizeServiceOutput` |
| `Dexa Body Scan` | **NULL** | unmatched | AI omitted it entirely (out-of-scope diagnostic) — actually appears here because a heuristic fallback path picked it up; stored anyway, unresolved |
| `Men's Sexual Health` | Men's Sexual Health (ai) | auto, 0.92 | AI general_name fuzzy-created a new bucket |

This table is the running example for every step below.

### A.1 Entry point · `ingestServicesByDomain()` in [ingest-services.ts](web/src/lib/ingest/ingest-services.ts)

A **standalone, reusable pipeline** (mirrors `ingest-concerns.ts`/`ingest-before-after.ts`): resolves an **existing** clinic by domain (never creates one — creating a clinic is `ingestClinicByDomain`'s job, in the separate clinic-details pipeline) and touches **only** `clinic_services`. Callable any time to refresh just a clinic's treatments, independent of its details:

```bash
bun scripts/ingest-services.ts ruma.com          # treatments only
bun scripts/ingest-treatments-concerns.ts ruma.com  # treatments THEN concerns, one call
```

### A.1a Fetch + discover pages

```
fetchHtml("ruma.com") → https://ruma.com/  (home)
discoverContentPages($home, homeUrl)        [discover.ts]
```

`discoverContentPages()` ([discover.ts:95-146](web/src/lib/ingest/discover.ts)) tries, in order: sitemap.xml → wp-sitemap.xml → sitemap_index.xml → WordPress REST `/wp-json/wp/v2/pages` → nav-link scan + URL guesses. It picks **one page per category** (locations / contact / about / team / services / before-after), capped at **6 pages total** — the SAME function `ingestClinicByDomain` uses for its own page set, called independently here. For ruma.com this surfaces its `/services/` hub plus a handful of others; the **individual per-treatment pages** (`/botox-in-lehi-ut/`, `/dysport-in-lehi-ut/`, `/morpheus8-in-lehi-ut/`, …) are **not** separately fetched here — those get their raw text from the **service-candidate gathering** step below, and are not part of the `pages[]` array sent as page text (see A.2).

### A.2 Gather SERVICE candidates (cheerio, no AI) · [ingest-services.ts](web/src/lib/ingest/ingest-services.ts)

Two source functions, both in [scraper/services.ts](web/src/lib/scraper/services.ts):

- `extractServicesFromNav($home, url)` — walks the **nav mega-menu** (this is where the full catalogue lives site-wide — every page's nav lists all ~29 treatments).
- `extractServiceAnchors($home, url)` — `<a>` tags that look like a service link.
- On any page whose URL matches `/(services?|treatments?|menu|procedures|what-we-offer)/`, also calls `extractServices($p, u)` (card/heading/list scrape of that specific page).

All three feed one deduped list, capped at **80** (`SVC_CAND_CAP`), each entry `{ name, category, url }`. For ruma.com this candidate list is exactly the ~29 raw names above, each carrying its own detail-page URL (e.g. `Botox®` → `https://ruma.com/services/botox-in-lehi-ut/`).

### A.3 The AI call · `extractClinicServices()` in [ai-extract-services.ts](web/src/lib/ingest/ai-extract-services.ts)

One forced-tool call named `record_clinic_services` — **services only** (as of the 2026-07-14 split; previously this was bundled into the clinic-details call `extractClinicDetails`/`record_clinic`, which no longer touches services at all). What it is **shown**, assembled in `extractClinicServices()` ([ai-extract-services.ts:104-135](web/src/lib/ingest/ai-extract-services.ts)):

1. **Page text** of the ≤6 discovered pages (homepage + locations/contact/about/team/services hub), capped 16K chars/page.
2. **SERVICE CANDIDATES** block — every `{name, category, url}` gathered in A.2, formatted as a text list.
3. **KNOWN TREATMENTS** block — the *entire live `services` table* (`SELECT name FROM services WHERE is_active`, queried fresh in `ingestServicesByDomain`) — so the model reuses "Botox", "Dysport", "Morpheus8" etc. instead of inventing near-duplicates.

No vision/images here — this call is text-only (cheaper, faster; image judgement is the clinic-details pipeline's job).

The **system prompt** ([ai-extract-services.ts](web/src/lib/ingest/ai-extract-services.ts)) is the actual instruction the model follows (identical rules to the pre-split version, just its own dedicated prompt now):

- Extract only med-spa/aesthetic/wellness treatments; explicitly excludes urgent care, physicals, labs, vaccinations, diagnostics/InBody, retail product lines.
- `raw_name`: **verbatim**, keep ®/™/brand words.
- `public_decision` — a 3-way enum the model must choose per service:
  - `"public"` — a real, patient-searchable label. Explicitly whitelists brand/device names: *"Dysport, Sculptra, Radiesse, Renuva, Morpheus8, Sylfirm X RF Microneedling, MiraDry, BBL Laser, Exomind, EBOO/Ozone Therapy, IV Therapy, Hormone Therapy, Medical Weight Loss"* — this is why ruma's `Dysport®` and `Morpheus8 Treatment` become their **own** searchable rows instead of collapsing into Botox/Microneedling.
  - `"alias_only"` — clinic-owned/confusing name that should match but never be a public label. The prompt's own worked example is literally *"RUMA Gold Microchannel Treatment → general_name Microneedling"*.
  - `"ignored"` — category headers, blogs, gift cards, financing, consultations, memberships; dentistry is **always** ignored.
- `general_name` — the clean public label the model proposes to map to (e.g. `Botox®` → `"Botox"`; `RUMA Gold Microchannel Treatment` → `"Microneedling"`).
- `source_url` — copied from the candidate's URL when known.

The model's raw JSON for ruma.com's services array looks like:

```json
{ "raw_name": "Botox®", "general_name": "Botox", "category": "Injectables",
  "source_url": "https://ruma.com/services/botox-in-lehi-ut/", "public_decision": "public" }
{ "raw_name": "RUMA Gold Microchannel Treatment", "general_name": "Microneedling", "category": "Skin",
  "source_url": "https://ruma.com/ruma-gold-microchannel-treatment-in-lehi-ut/", "public_decision": "alias_only" }
{ "raw_name": "Dysport®", "general_name": "Dysport", "category": "Injectables",
  "source_url": "https://ruma.com/services/dysport-in-lehi-ut/", "public_decision": "public" }
```

Output is zod-validated (`ServiceItemSchema`, [ai-extract-services.ts](web/src/lib/ingest/ai-extract-services.ts)) — `public_decision` must be one of the 3 enum values or the whole call fails and retries/escalates.

### A.4 Deterministic post-processing · `normalizeServiceOutput()` in [ingest-services.ts](web/src/lib/ingest/ingest-services.ts)

Runs on every AI-returned service **before** it reaches the resolver. This is regex-based, not AI — a small set of hand-coded special cases for names the model handles inconsistently:

- `dentistry|dental|orthodont|veneers?` → force `ignored`.
- `ruma\s+gold` (case-insensitive) → **force** `general_name="Microneedling"`, `public_decision="alias_only"` — this is why RUMA Gold *always* maps to Microneedling regardless of what the AI said this run.
- `sculptra\s*&\s*radiesse` (or "and") → **splits into 2 rows**, `Sculptra` and `Radiesse`, both `public_decision="public"` — this is why one raw combined listing became 2 separate `clinic_services` rows in the DB.
- `sylfirm x ... rf microneedling`, `everesse ... skin tightening`, `regenerative aesthetics ... prp/prf` → pins `general_name` to a canonical phrasing (guards against the model drifting wording run-to-run).

### A.5 Canonicalization / resolution · `saveClinicServices()` in [clinic-save.ts](web/src/lib/admin/clinic-save.ts)

This is where the *raw_name → canonical `services` row* decision actually happens, deterministically, in code — not by the AI. As of the 2026-07-14 split this logic lives in its own exported function, `saveClinicServices(clinicId, services, opts)`, called by BOTH `ingestServicesByDomain()` (this pipeline) and `saveClinicBundle()` (the heuristic-scraper/admin-save/rescrape path) — so a raw name resolves to the exact same canonical row no matter which caller touched it. Per service, in order:

```
0. Deterministic junk backstop (added 2026-07-13):
   isServiceNoise(raw) — catches "View all X", nav/CTA/footer chrome, category
   headers, financing, out-of-scope diagnostics — even if public_decision="public".
   providerNorms.has(stripCredentials(raw)) — catches a scraped "service" that
   is actually a staff member's name (matched against this clinic's own
   providers[] in the same save). Either match → the row is DROPPED ENTIRELY,
   not even stored unmatched.
        ↓ (raw survives)
1. s.mapped_slug (admin override)          → exact row, done.
2. public_decision === "public"            → mapByGeneralName(forceCreatePublic=true):
      exact name match in live catalog?  → link it (confidence 1, "matched")
      else                               → CREATE a new services row, origin='ai'
                                            (this is how "Dysport" got its OWN
                                            row instead of merging into Botox)
3. else: curated matchService(raw)         → the 15 + hand-curated brand aliases
                                              (Dice ≥ 0.55). "Botox®" hits here
                                              via the alias table, not path 2,
                                              since public_decision wasn't forced.
4. else: AI general_name, ≥3 chars         → mapByGeneralName(forceCreatePublic=false):
      exact match  → link
      bestCatalogMatch(gen, catalog, 0.72) → link the closest existing row
      else                                 → CREATE new origin='ai' row
5. else (no AI suggestion at all)          → bestCatalogMatch(raw, catalog, 0.55)
                                              or leave service_id = NULL (still
                                              stored by raw_name — "unmatched")
```

Every successful match also calls `addAiAlias(row, raw)` — the raw name is appended to the resolved row's `aliases[]` array, so a **future** raw-name search for "RUMA Gold Microchannel Treatment" or "Botox®" still hits the clean canonical row.

`INSERT INTO clinic_services (..., raw_name, service_id, match_status, match_confidence, ...) ON CONFLICT (clinic_id, raw_name) DO UPDATE ...` ([clinic-save.ts:722-736](web/src/lib/admin/clinic-save.ts)) — raw_name is **always** stored, service_id is nullable (unmatched but still searchable via `slugify(raw_name)` at the DB view layer).

### A.6 Why Dysport/Morpheus8 don't collapse into Botox/Microneedling

This is the single most important design decision in the resolver, and it's explicit in a code comment at [clinic-save.ts:683-686](web/src/lib/admin/clinic-save.ts):

> *"Public AI decision wins before the old alias matcher so real searchable brands/devices (Dysport, Morpheus8, MiraDry) do not collapse into broad buckets like Botox or Microneedling."*

Path 2 (public AI decision) is checked **before** path 3 (curated `matchService`) specifically so that even though `canonical.ts`'s alias table lists `"dysport"` as an alias of Botox (for search-matching purposes), the *save* path doesn't use that alias table for genuinely public brand names — it creates Dysport its own row instead. `RUMA Gold Microchannel Treatment`, by contrast, gets `public_decision="alias_only"` (forced by A.4) so it **skips path 2** and falls to path 3/4, landing on the existing Microneedling row rather than creating "RUMA Gold" as its own searchable label.

---

## PART B — Concerns

Concerns are a **separate, standalone pipeline** — `ingestConcernsByDomain()` is never called by the main ingest. It must be run explicitly per clinic, and requires the clinic (and its services) to already exist.

### B.0 What actually happened for ruma.com (ground truth, live DB)

`clinic_concerns` has **17 rows**, each `source='scraped'`, each backed by ≥1 row in `clinic_concern_evidence` (**28 evidence rows** total). Two concrete examples:

| Concern | `raw_phrase` | Evidence quote (verbatim, machine-verified) | Paired treatment | Source page |
|---|---|---|---|---|
| Forehead Lines | "Forehead Lines" | *"Forehead Lines 15 MINUTES (12–20 units) Eliminate horizontal lines across your forehead! Botox® helps maintain a youthful and vibrant appearance…"* | Botox | `/services/botox-in-lehi-ut/` |
| Forehead Lines | "forehead lines" | *"This proven treatment effectively addresses forehead lines, frown lines, and crow's feet."* | Dysport | `/services/dysport-in-lehi-ut/` |
| Hyperpigmentation | "hyperpigmentation" | *"Helps address: Fine lines and wrinkles Hyperpigmentation Acne scars Skin laxity Rosacea Stretch marks Texture problems Enlarged pores."* | Morpheus8 | `/morpheus8-in-lehi-ut/` |
| Urinary Incontinence | "urinary incontinence" | *"Concerns Treated Urinary Incontinence Urinary incontinence is the involuntary leakage of urine."* | Women's Health | `/services/womens-health-at-ruma-medical/` |

Note the same concern (e.g. Forehead Lines) has **two separate evidence rows** — one from the Botox page, one from the Dysport page — because each is independently verified and both survived. Note also each stayed its **own specific concern row** (Forehead Lines, Bunny Lines, Crow's Feet are 3 distinct DB rows, not merged into "Wrinkles & Fine Lines").

### B.1 Resolve the clinic · `ingestConcernsByDomain()` in [ingest-concerns.ts:181-206](web/src/lib/ingest/ingest-concerns.ts)

```
findClinicsByDomain("ruma.com") → clinicId
```

If no clinic exists for the domain, the run aborts with `status: "skipped"` — this pipeline **never creates** a clinic.

### B.2 Discover CONCERN-specific pages · `discoverConcernPages()` in [discover.ts:148-262](web/src/lib/ingest/discover.ts)

Deliberately different discovery from Part A. Two page classes, found separately:

- **`concernPages`** (cap 6, [discover.ts:180]) — pages whose *path itself* names a condition or hub: `CONCERN_HUB_RE` (`/concerns/`, `/conditions/`, `/what-we-treat/`, `/self-assessment/`) or `CONCERN_WORD_RE` (path contains `acne`, `rosacea`, `wrinkles`, `sagging`, `double-chin`, etc. as a path token). Ruma.com doesn't have a dedicated `/concerns/` hub, so this list is typically empty/small for it.
- **`servicePages`** (cap 12/45 depending on nav count) — `SERVICE_DETAIL_RE` matches: any `/services?/`, `/treatments?/`, or a hardcoded list of specific treatment slugs (`botox`, `dysport`, `morpheus8`, `microneedling`, …). This is where ruma.com's real evidence lives — `/services/botox-in-lehi-ut/`, `/services/dysport-in-lehi-ut/`, `/morpheus8-in-lehi-ut/` all match here.

Two explicit exclusions, both load-bearing for accuracy:
- **Per-city SEO duplicates** are deduped to one (`-in-tampa-fl` ≡ `-in-melbourne-fl` via `pathKey()`, [discover.ts:238-239]) — ruma.com's URLs are literally `-in-lehi-ut` suffixed, so this matters.
- **Blog posts are never a source** — excluded by the sitemap's own post/page classification (`isPost` flag from a `post-sitemap.xml` sub-sitemap) *and* a slug-shape heuristic (`looksLikeBlogSlug`) as backup. Policy stated directly in the code: *"concern evidence may come ONLY from the homepage, condition pages, or treatment pages — never blog posts."*

### B.3 Condense page text · `condenseForConcerns()` in [ai-extract-concerns.ts:38-61](web/src/lib/ingest/ai-extract-concerns.ts)

Each fetched page's plain text is shrunk to only its **condition-relevant sentences** (matched against a hardcoded vocabulary regex `CONDITION_VOCAB` covering ~60 condition-ish words: acne, wrinkles, crow's feet, hyperpigmentation, sagging, double chin, etc.) plus one sentence of context on either side, plus a 300-char lead so the AI still knows what page it's reading. A 16K-char treatment page shrinks to ~2-4K. This is why a whole clinic (all its treatment pages) usually fits in **one** AI call instead of several — and critically, **the exact same condensed text is later re-checked by the validator** (B.6), so a quote can never be "verified" against text the model wasn't shown.

### B.4 The AI call · `extractClinicConcerns()` in [ai-extract-concerns.ts](web/src/lib/ingest/ai-extract-concerns.ts)

One forced-tool call, `record_clinic_concerns`, called per **batch** (pages packed by a 45K-char budget, [ingest-concerns.ts:266-285]) — for a normal-size clinic this is one call. What it's shown:

1. Condensed page text of every discovered concern/service page, each headed `### PAGE: <url>`.
2. **KNOWN CONCERNS** — every live `concerns.name` (curated 10 + all previously AI-grown), so the model reuses "Forehead Lines" if it already exists rather than creating "Forehead Lines 2".
3. **THIS CLINIC'S KNOWN TREATMENTS** — the clinic's own already-saved `clinic_services` canonical names (from Part A!) — explicitly captioned *"helps you recognize treatment names for paired_treatments; NEVER a reason to record a concern"*.

The **system prompt** ([ai-extract-concerns.ts:122-134]) is unusually strict — 10 numbered rules, the two most important being:

- **Rule 2**: *"NEVER infer a concern from a treatment name alone. A page that merely lists 'Botox' or 'Microneedling' with no condition language yields NOTHING from that page."* — this is the anti-hallucination guarantee for the whole system: offering Botox does **not** imply "treats wrinkles" unless the page's own text says so.
- **Rule 8**: *"Do NOT collapse 'Forehead Lines', 'Frown Lines', 'Bunny Lines', 'Crow's Feet', or 'Scowl Lines' into 'Wrinkles & Fine Lines'."* — this is the explicit instruction behind ruma.com keeping 17 distinct concern rows instead of one big bucket.

The model's raw output for the Botox page evidence looks like:

```json
{ "raw_phrase": "Forehead Lines", "general_name": "Forehead Lines",
  "paired_treatments": ["Botox"],
  "source_url": "https://ruma.com/services/botox-in-lehi-ut/",
  "evidence_quote": "Forehead Lines 15 MINUTES (12–20 units) Eliminate horizontal lines across your forehead! Botox® helps maintain a youthful and vibrant appearance..." }
```

### B.5 Deterministic non-AI backstop · `extractTreatmentAreaConcerns()` in [ingest-concerns.ts:110-139](web/src/lib/ingest/ingest-concerns.ts)

Runs **in addition to** the AI call, on the same condensed pages, with **no AI involved**. For any page whose service is on a "neurotoxin" page (`NEUROTOXIN_PAGE_RE` — botox/dysport/xeomin/daxxify/jeuveau/tox), it regex-scans for a fixed list of `TREATMENT_AREA_TERMS` (Forehead Lines, Scowl Lines (11s), Bunny Lines, Brow Lift, Crow's Feet, Lip Flip, Dimpled Chin, Platysma, Hyperhidrosis, Masseter/TMJ, Headache/Migraine Relief). If a term is found **and** the surrounding text shows treatment intent (`smooth|soften|reduce|treat|address|…`), it emits a synthetic "extracted concern" with the quote sliced straight from the page. This is exactly why ruma.com's Botox and Dysport pages — which list treatment areas as short bolded headers rather than full sentences — still produced clean evidence: the AI prose-extraction and this deterministic list-scan both ran, and both found real hits.

### B.6 Machine verification · `validateConcerns()` in [concern-validate.ts](web/src/lib/ingest/concern-validate.ts)

Every item from B.4 + B.5 (AI and deterministic alike) runs through the same gate, in this exact order — first failure wins:

1. Empty `raw_phrase`/`general_name`/`evidence_quote` → rejected.
2. `general_name` < 3 chars → rejected.
3. `VAGUE_NAME_RE` — marketing fluff ("wellness", "confidence", "glow", "rejuvenation") → rejected.
4. `GENERIC_SYMPTOM_RE` — general-medicine noise ("pain", "stress", "cholesterol", "migraines") → rejected (this is the rule that keeps concerns *medspa-specific*).
5. `TESTIMONIAL_RE` — first-person "I did/had/loved…" → rejected (patient voice ≠ clinic assertion).
6. `SIDE_EFFECT_RE` — "side effects", "may cause", "bruising", "increased hair growth" → rejected (a side effect is not a treated concern).
7. `DEFINITION_ONLY_RE` **and not** `TREATED_INTENT_RE` → rejected ("X is a condition where…" with no "we treat" language).
8. **`source_url` must be one of the pages actually supplied** — anti-hallucination; the model can't cite a page it wasn't shown.
9. **`evidence_quote` must genuinely be on that page** — `normText()`-normalized substring match; falls back to a 90%-similarity `windowDice()` shingle comparison for minor whitespace/entity drift. **Fails → rejected, "invented/paraphrased."** This is the core integrity guarantee.
10. The quote must actually **mention** the claimed `raw_phrase` (direct substring or ≥0.6 fuzzy) — blocks a real quote about something else being misattributed to this concern.
11. Duplicate `(concern, page, phrase)` → rejected.
12. **`paired_treatments` must resolve to ≥1 of this clinic's own approved services** (`resolvePairedService`, Dice ≥ 0.72, or a match on the page's own `scraped_from_url` against `clinic_services.scraped_from_url`) — **"concern is not tied to an approved public clinic service"** if none resolve. This is the hard dependency on Part A: a concern with a perfectly good quote is still discarded if it can't be pinned to a real, already-resolved treatment.

Everything that survives all 12 checks is grouped by `general_name` (so 2 pages both evidencing "Forehead Lines" merge into one concern with 2 evidence entries) and returned; nothing is capped per-clinic — ruma.com's 17 concerns all survived.

### B.7 Canonicalize onto the concerns catalog · `resolveConcernRow()` in [ingest-concerns.ts:352-372](web/src/lib/ingest/ingest-concerns.ts)

For each validated `general_name`, in order:

1. **Exact** normalized match on an existing concern's `name`, `slug`, or `aliases[]`.
2. **Fuzzy Dice ≥ 0.82** against the whole catalog — deliberately high, so only true synonyms merge (e.g. "Fine Lines and Wrinkles" → "Wrinkles & Fine Lines").
3. **Token-prefix** — one name's tokens are a strict prefix of the other's (e.g. "Crow's Feet Around the Eyes" → "Crow's Feet").
4. Otherwise **create** a new `concerns` row, `origin='ai'`, `is_published=false` (stays off the public `/conditions` index until curated, but is fully usable for clinic-page chips and search).

This 4-tier scheme is intentionally narrower than the services resolver's 0.72 threshold — it exists specifically so "Forehead Lines" and "Crow's Feet" never accidentally merge into each other or into "Wrinkles & Fine Lines" (that would defeat the whole point of Rule 8 in B.4).

### B.8 Persist · [ingest-concerns.ts:402-443](web/src/lib/ingest/ingest-concerns.ts)

Replace-scraped-state pattern, scoped to *this clinic only*:
```sql
DELETE FROM clinic_concern_evidence WHERE clinic_id = $1;
DELETE FROM clinic_concerns WHERE clinic_id = $1 AND source = 'scraped';
-- then re-INSERT clinic_concerns (source='scraped') + clinic_concern_evidence per resolved concern
```
Admin-added (`source='manual'`) and admin-suppressed (`source='removed'`) rows are **never touched** — the `WHERE clinic_concerns.source <> 'removed'` guard on the upsert protects a suppression from being silently reinstated by the next scrape.

---

## Quick-reference function map

| Step | Function | File |
|---|---|---|
| Ingest orchestrator (clinic details — no services) | `ingestClinicByDomain()` | `web/src/lib/ingest/ingest-clinic.ts` |
| Ingest orchestrator (services, standalone/reusable) | `ingestServicesByDomain()` | `web/src/lib/ingest/ingest-services.ts` |
| Ingest orchestrator (treatments + concerns together) | `ingestTreatmentsAndConcernsByDomain()` | `web/src/lib/ingest/ingest-treatments-concerns.ts` |
| Page discovery (shared by details + services) | `discoverContentPages()` | `web/src/lib/ingest/discover.ts` |
| Service candidate scraping | `extractServicesFromNav`, `extractServiceAnchors`, `extractServices` | `web/src/lib/scraper/services.ts` |
| AI call (services only) | `extractClinicServices()` | `web/src/lib/ingest/ai-extract-services.ts` |
| AI call (clinic details only — no services) | `extractClinicDetails()` | `web/src/lib/ingest/ai-extract.ts` |
| Hardcoded post-fixes | `normalizeServiceOutput()` | `web/src/lib/ingest/ingest-services.ts` |
| Canonicalization + persistence (services, shared) | `saveClinicServices()` | `web/src/lib/admin/clinic-save.ts` |
| Junk backstop | `isServiceNoise()`, `stripCredentials()` | `web/src/lib/taxonomy/canonical.ts` |
| Curated alias matcher | `matchService()` | `web/src/lib/taxonomy/canonical.ts` |
| Live-catalog fuzzy matcher | `bestCatalogMatch()` | `web/src/lib/taxonomy/canonical.ts` |
| Ingest orchestrator (concerns) | `ingestConcernsByDomain()` | `web/src/lib/ingest/ingest-concerns.ts` |
| Page discovery (concerns) | `discoverConcernPages()` | `web/src/lib/ingest/discover.ts` |
| Page condensing | `condenseForConcerns()` | `web/src/lib/ingest/ai-extract-concerns.ts` |
| AI call (concerns) | `extractClinicConcerns()` | `web/src/lib/ingest/ai-extract-concerns.ts` |
| Deterministic backstop | `extractTreatmentAreaConcerns()` | `web/src/lib/ingest/ingest-concerns.ts` |
| Machine verification | `validateConcerns()` | `web/src/lib/ingest/concern-validate.ts` |
| Concern canonicalization | `resolveConcernRow()` | `web/src/lib/ingest/ingest-concerns.ts` |
| Low-level AI transport | `extractViaTool()` | `web/src/lib/ai/anthropic.ts` (routes to gemini.ts / openai.ts per `INGEST_PROVIDER`) |

## Key design decisions worth remembering

0. **Three fully independent pipelines**: clinic details (`ingestClinicByDomain`), treatments (`ingestServicesByDomain`), concerns (`ingestConcernsByDomain`) — each can be re-run for one clinic without touching the other two's data. `ingestTreatmentsAndConcernsByDomain()` is the one call for "refresh this clinic's treatments+concerns" without re-scraping its details. A brand-new clinic needs details run first (it creates the clinic row), then treatments, then optionally concerns.
1. **Services and concerns are separate pipelines that run at separate times.** A freshly-ingested clinic (details only) has zero treatments/concerns until `ingest-services.ts`/`ingest-concerns.ts` are run for it separately.
2. **Concerns structurally depend on services.** `concern-validate.ts` step 12 discards any concern that can't tie to an already-resolved `clinic_services` row — so re-running concerns before services exist yields nothing, and a real concern with no matching service is silently dropped.
3. **`public_decision` is the pivot that keeps brand names searchable without letting every proprietary name become its own row.** "Public" brands (Dysport, Morpheus8, MiraDry) create their own canonical row; "alias_only" clinic-owned names (RUMA Gold) fold into the nearest real treatment.
4. **Both AI calls are anti-hallucination by construction, not by trust**: services validate URLs against candidate lists; concerns machine-verify the evidence quote against the exact page text the model was shown, word for word.
5. **Deterministic code is a first-class contributor, not just a fallback** — `normalizeServiceOutput` (services) and `extractTreatmentAreaConcerns` (concerns) run on every ingest, unconditionally, alongside the AI.
