# AI Extraction: Treatments & Concerns — Unified Brute-Force Pass (worked example: `ruma.com`)

> **2026-07-27 — one engine, three surfaces.** There is now exactly ONE way a
> clinic's treatments and concerns change:
> `ingestTreatmentsAndConcernsForClinic(clinicId, { trigger })` in
> [ingest-treatments-concerns.ts](web/src/lib/ingest/ingest-treatments-concerns.ts).
> The admin "Add Website with AI" button, the g99-websites Import button and the
> scheduled refresh all call it, so a clinic's menu means the same thing
> regardless of which one last ran.
>
> **Deleted with that change:** the standalone `ingestServicesByDomain()`
> (`ingest-services.ts` / `ai-extract-services.ts`) and
> `ingestConcernsByDomain()` (`ingest-concerns.ts` / `ai-extract-concerns.ts` /
> `concern-validate.ts`), plus their CLI scripts. Two helpers were salvaged:
> `normalizeServiceOutput()` → `service-normalize.ts` and
> `refineClinicServices()` → `ai-refine-services.ts`. The
> `clinic_service_concerns` table is also gone (written but never read).
>
> Part A below has been repointed at the live engine. **Part B is a stub** — the
> concerns pipeline it documented no longer exists; concerns now come out of the
> same call as treatments. The prompt rules, candidate gathering, catalog
> resolution and `ruma.com` worked examples are unchanged: same logic, one entry
> point instead of three.

## What one run does

One AI extraction pass per batch of pages sees website content, the known
`services` catalog and the known `concerns` catalog together, and writes:

- `clinic_services` — replacement set. A scraped name that resolves to nothing in
  the catalog is **dropped, not stored**: there is no `unmatched` state and no
  review queue (both deleted 2026-07-27, along with the raw-name fallback that
  had made those rows searchable). `match_status` is only `matched` or `auto`.
- `clinic_concerns` with `source='scraped'` — replacement set; `manual` rows and
  `removed` suppressions survive.
- `clinic_refresh_runs` — one row per attempt, including skipped ones.
- `clinic_catalog_changes` — the canonical rows added/removed, keyed on catalog
  id rather than the scraped `raw_name` (a rename that still resolves to the same
  treatment is not a change). A first-ever import writes no change rows.

Everything above happens in ONE transaction, after the crawl and the AI calls
finish. Evidence quotes are intentionally not required in this brute-force path —
the goal is a simple current-state answer to "what does this clinic offer, and
what does it treat". Guardrails instead: the extraction prompt's
problem-not-procedure rules, `isConcernNoise()`, `splitCompoundConcern()`, and
the degrade guards that abort the save when a crawl looks broken.

| | Clinic Details | Treatments + Concerns |
|---|---|---|
| Entry point | `ingestClinicByDomain()` | `ingestTreatmentsAndConcernsForClinic()` |
| Script | `bun --env-file=.env scripts/ingest-one.ts ruma.com` (runs both) | `bun --env-file=.env scripts/ingest-treatments-concerns.ts ruma.com` |
| AI call | `extractClinicDetails()` — business/locations/providers/images/hours/booking | `extractClinicTreatmentsConcerns()` per batch, then `refineClinicServices()` |
| Tables written | `clinics`, `clinic_locations`, `images`, `providers` | `clinic_services` → `services`, `clinic_concerns` → `concerns`, plus the two history tables |
| Can create a clinic? | Yes (website-only ingest) | No — resolves an **existing** clinic only |

All AI calls reach the same transport, `extractViaTool()` in
`web/src/lib/ai/anthropic.ts`. Despite the filename it **always** delegates to
OpenAI — `INGEST_PROVIDER` is deliberately ignored so a stale local `.env` cannot
reroute an admin import, and the Anthropic/Gemini clients are gone. Calls run at
`temperature: 0` with a stable per-domain `seed`, because run-to-run drift shows
up directly in `clinic_catalog_changes` as phantom additions and removals.

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

### A.1 Entry point · `ingestTreatmentsAndConcernsForClinic()` in [ingest-treatments-concerns.ts](web/src/lib/ingest/ingest-treatments-concerns.ts)

Takes a clinic **id** (never creates one — that is `ingestClinicByDomain`'s job in the separate clinic-details pipeline) and touches only `clinic_services`, `clinic_concerns` and the two history tables. `ingestTreatmentsAndConcernsByDomain(url)` is a thin wrapper for callers that only have a URL. Callable any time to refresh a clinic's treatments and concerns independently of its details:

```bash
bun --env-file=.env scripts/ingest-treatments-concerns.ts ruma.com
bun scripts/ingest-treatments-concerns.ts ruma.com  # treatments THEN concerns, one call
```

### A.1a Fetch + discover pages

```
fetchHtml("ruma.com") → https://ruma.com/  (home)
discoverContentPages($home, homeUrl)        [discover.ts]
```

`discoverContentPages()` ([discover.ts:95-146](web/src/lib/ingest/discover.ts)) tries, in order: sitemap.xml → wp-sitemap.xml → sitemap_index.xml → WordPress REST `/wp-json/wp/v2/pages` → nav-link scan + URL guesses. It picks **one page per category** (locations / contact / about / team / services / before-after), capped at **6 pages total** — the SAME function `ingestClinicByDomain` uses for its own page set, called independently here. For ruma.com this surfaces its `/services/` hub plus a handful of others; the **individual per-treatment pages** (`/botox-in-lehi-ut/`, `/dysport-in-lehi-ut/`, `/morpheus8-in-lehi-ut/`, …) are **not** separately fetched here — those get their raw text from the **service-candidate gathering** step below, and are not part of the `pages[]` array sent as page text (see A.2).

### A.2 Gather SERVICE candidates (cheerio, no AI) · [ingest-treatments-concerns.ts](web/src/lib/ingest/ingest-treatments-concerns.ts)

Two source functions, both in [scraper/services.ts](web/src/lib/scraper/services.ts):

- `extractServicesFromNav($home, url)` — walks the **nav mega-menu** (this is where the full catalogue lives site-wide — every page's nav lists all ~29 treatments).
- `extractServiceAnchors($home, url)` — `<a>` tags that look like a service link.
- On any page whose URL matches `/(services?|treatments?|menu|procedures|what-we-offer)/`, also calls `extractServices($p, u)` (card/heading/list scrape of that specific page).

All three feed one deduped list, capped at **80** (`SVC_CAND_CAP`), each entry `{ name, category, url }`. For ruma.com this candidate list is exactly the ~29 raw names above, each carrying its own detail-page URL (e.g. `Botox®` → `https://ruma.com/services/botox-in-lehi-ut/`).

### A.3 The AI call · `extractClinicTreatmentsConcerns()` in [ai-extract-treatments-concerns.ts](web/src/lib/ingest/ai-extract-treatments-concerns.ts)

One forced-tool call named `record_clinic_treatments_concerns`, returning `treatments[]` and `concerns[]` as two independent lists. Pages are batched (70k chars per call, 3 calls in flight); a batch that fails is dropped rather than aborting the clinic, and the degrade guards then decide whether what survived is enough to save. What the model is **shown**, assembled in `extractClinicTreatmentsConcerns()` ([ai-extract-treatments-concerns.ts](web/src/lib/ingest/ai-extract-treatments-concerns.ts)):

1. **Page text** of the ≤6 discovered pages (homepage + locations/contact/about/team/services hub), capped 16K chars/page.
2. **SERVICE CANDIDATES** block — every `{name, category, url}` gathered in A.2, formatted as a text list.
3. **KNOWN TREATMENTS** block — the *entire live `services` table* (`SELECT name FROM services WHERE is_active`, queried fresh in `ingestServicesByDomain`) — so the model reuses "Botox", "Dysport", "Morpheus8" etc. instead of inventing near-duplicates.

No vision/images here — this call is text-only (cheaper, faster; image judgement is the clinic-details pipeline's job).

The **system prompt** ([ai-extract-treatments-concerns.ts](web/src/lib/ingest/ai-extract-treatments-concerns.ts)) is the actual instruction the model follows. A second pass, `refineClinicServices()` ([ai-refine-services.ts](web/src/lib/ingest/ai-refine-services.ts)), then re-reviews the merged treatment list as a quality gate:

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

Output is zod-validated (`TreatmentSchema` / `ConcernSchema`, [ai-extract-treatments-concerns.ts](web/src/lib/ingest/ai-extract-treatments-concerns.ts)) — `public_decision` must be one of the 3 enum values or the call fails and retries/escalates.

### A.4 Deterministic post-processing · `normalizeServiceOutput()` in [service-normalize.ts](web/src/lib/ingest/service-normalize.ts)

Runs on every AI-returned service **before** it reaches the resolver. This is regex-based, not AI — a small set of hand-coded special cases for names the model handles inconsistently:

- `dentistry|dental|orthodont|veneers?` → force `ignored`.
- `ruma\s+gold` (case-insensitive) → **force** `general_name="Microneedling"`, `public_decision="alias_only"` — this is why RUMA Gold *always* maps to Microneedling regardless of what the AI said this run.
- `sculptra\s*&\s*radiesse` (or "and") → **splits into 2 rows**, `Sculptra` and `Radiesse`, both `public_decision="public"` — this is why one raw combined listing became 2 separate `clinic_services` rows in the DB.
- `sylfirm x ... rf microneedling`, `everesse ... skin tightening`, `regenerative aesthetics ... prp/prf` → pins `general_name` to a canonical phrasing (guards against the model drifting wording run-to-run).

### A.5 Canonicalization / resolution · `saveClinicServices()` in [clinic-save.ts](web/src/lib/admin/clinic-save.ts)

This is where the *raw_name → canonical `services` row* decision actually happens, deterministically, in code — not by the AI. This logic lives in its own exported function, `saveClinicServices(clinicId, services, opts)`, called by BOTH the unified engine (this pipeline) and `saveClinicBundle()` (the heuristic-scraper / admin-save path) — so a raw name resolves to the exact same canonical row no matter which caller touched it. Per service, in order:

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

> **Deleted 2026-07-27.** This section used to document a standalone
> evidence-quote concerns pipeline (`ingestConcernsByDomain()`,
> `extractClinicConcerns()`, `condenseForConcerns()`, `validateConcerns()`,
> `resolveConcernRow()` in `ingest-concerns.ts`). None of it exists any more: it
> was CLI-only, nothing in the app ever called it, and the live path had already
> stopped requiring evidence quotes.
>
> Concerns now come out of the **same AI call as treatments** (Part A, step A.3),
> which returns `treatments[]` and `concerns[]` as two independent lists. See
> [§9 of weburltodataindb.md](weburltodataindb.md) for how they are kept honest
> without quote verification: the prompt's problem-not-procedure rules,
> `isConcernNoise()`, `splitCompoundConcern()`, and catalog resolution via
> exact → Dice ≥0.82 → token-prefix containment → create `origin='ai'`.
>
> Two pieces of the old design DID survive into the unified engine and are worth
> knowing about:
>
> - **`discoverConcernPages()`** ([discover.ts](web/src/lib/ingest/discover.ts))
>   still finds condition-named pages and still excludes blog posts. Note its
>   `hasConditionsSection` flag no longer gates which pages may contribute
>   concerns — that gate was silently discarding ~90% of concerns on
>   treatment-first sites and was removed.
> - **`deterministicNeurotoxinConcerns()`** — the non-AI regex backstop for
>   neurotoxin treatment areas (forehead lines, crow's feet, masseter/TMJ…). It
>   now runs on every site shape, and emits the CONCERN rather than the procedure
>   ("brow lift" → Drooping Brows).

## Quick-reference function map

| Step | Function | File |
|---|---|---|
| Ingest orchestrator (clinic details — no services) | `ingestClinicByDomain()` | `web/src/lib/ingest/ingest-clinic.ts` |
| Ingest orchestrator (treatments + concerns together) | `ingestTreatmentsAndConcernsByDomain()` | `web/src/lib/ingest/ingest-treatments-concerns.ts` |
| Page discovery (shared by details + services) | `discoverContentPages()` | `web/src/lib/ingest/discover.ts` |
| Service candidate scraping | `extractServicesFromNav`, `extractServiceAnchors`, `extractServices` | `web/src/lib/scraper/services.ts` |
| AI call (clinic details only — no services) | `extractClinicDetails()` | `web/src/lib/ingest/ai-extract.ts` |
| Canonicalization + persistence (services, shared) | `saveClinicServices()` | `web/src/lib/admin/clinic-save.ts` |
| Junk backstop | `isServiceNoise()`, `stripCredentials()` | `web/src/lib/taxonomy/canonical.ts` |
| Curated alias matcher | `matchService()` | `web/src/lib/taxonomy/canonical.ts` |
| Live-catalog fuzzy matcher | `bestCatalogMatch()` | `web/src/lib/taxonomy/canonical.ts` |
| Page discovery (concerns) | `discoverConcernPages()` | `web/src/lib/ingest/discover.ts` |
| Low-level AI transport | `extractViaTool()` | `web/src/lib/ai/anthropic.ts` — always delegates to `openai.ts`; the name is historical |

## Key design decisions worth remembering

0. **Three fully independent pipelines**: clinic details (`ingestClinicByDomain`), treatments (`ingestServicesByDomain`), concerns (`ingestConcernsByDomain`) — each can be re-run for one clinic without touching the other two's data. `ingestTreatmentsAndConcernsByDomain()` is the one call for "refresh this clinic's treatments+concerns" without re-scraping its details. A brand-new clinic needs details run first (it creates the clinic row), then treatments, then optionally concerns.
1. **Treatments and concerns come from ONE pass, and one engine serves all three surfaces.** A freshly-ingested clinic (details only) has zero treatments/concerns until `ingestTreatmentsAndConcernsForClinic()` runs for it — which the admin importers do automatically, and the scheduled job does on its cadence.
2. **Concerns no longer depend on services.** The old pipeline discarded any concern it could not tie to an already-resolved `clinic_services` row; that gate is gone along with `concern-validate.ts`, so a real concern is kept even when the clinic's matching service did not resolve.
3. **`public_decision` is the pivot that keeps brand names searchable without letting every proprietary name become its own row.** "Public" brands (Dysport, Morpheus8, MiraDry) create their own canonical row; "alias_only" clinic-owned names (RUMA Gold) fold into the nearest real treatment.
4. **Both AI calls are anti-hallucination by construction, not by trust**: services validate URLs against candidate lists; concerns machine-verify the evidence quote against the exact page text the model was shown, word for word.
5. **Deterministic code is a first-class contributor, not just a fallback** — `normalizeServiceOutput` (services) and `extractTreatmentAreaConcerns` (concerns) run on every ingest, unconditionally, alongside the AI.
