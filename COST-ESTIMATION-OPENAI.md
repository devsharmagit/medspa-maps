# medspa-map — OpenAI & Google Places Cost Estimation (Full Pipeline)

**Prepared:** 2026-07-18 · **Scale:** ~750 clinics · **Providers:** OpenAI (API + vision) + Google Places API (New)

Estimates the cost of running the ingestion + enrichment pipeline **entirely on OpenAI** — including moving the chatbot off OpenRouter onto OpenAI — plus Google Places for ratings + review count + 5 reviews. Grounded in the actual per-clinic AI-call structure in the codebase.

> Companion doc: [COST-ESTIMATION.md](COST-ESTIMATION.md) prices the older single-clinic Claude/Haiku model. This file supersedes it for the OpenAI + full-scope scenario you asked about.

---

## 1. Pricing basis (confirmed July 2026)

| Item | Rate |
|---|---|
| OpenAI `gpt-4o-mini` (default ingest, vision-capable) | **$0.15** / 1M input · **$0.60** / 1M output |
| OpenAI `gpt-4o` (escalation only) | **$2.50** / 1M input · **$10.00** / 1M output |
| Google Places — Place Details, **Enterprise + Atmosphere** (rating + count + reviews) | **$25** / 1,000 |
| Google Places — Text Search, **Enterprise + Atmosphere** (rating + count + reviews from a name query) | **$40** / 1,000 |
| Nominatim / OpenStreetMap geocoding (already used) | Free |

**Read these caveats first:**
- `gpt-4o` at $2.50/$10 is **grandfathered** for existing accounts; new accounts default to `gpt-4.1` ($5/$15), which ~2× the escalation line only. The default model is `gpt-4o-mini`, unaffected.
- OpenAI **Batch API = 50% off** both directions. Every one-time and cron job below is batchable → **halve those figures** if run via Batch. Numbers below are full real-time price.
- Google Places has a **monthly per-SKU free allowance**. At 750 calls/run you likely fall **within the free tier** (~$0/month). The dollar figures below are the no-free-tier worst case.

### Token assumptions (from the code's char budgets + image caps)
- Text: ~4 chars/token; batches are 45K–70K chars → ~12–18K input tokens/call.
- Vision: up to **12 images/clinic**, effective **~10K billed tokens/image** on `gpt-4o-mini` (auto/high detail). This is the biggest swing factor — see §7.

---

## 2. One-time clinic ingest — 750 clinics (details + treatments + concerns + images)

Each **new** clinic runs the full pipeline: details + locations + providers + image selection (1 vision call), conditional before/after image classification (1 vision call), services extract + refine (2 text calls), and concerns (1 text call). `gpt-4o` escalation fires only on failure/zero-result.

**Per-clinic (blended, `gpt-4o-mini`):**

| Call | Model | ~Input | ~Output | Cost |
|---|---|---:|---:|---:|
| Details + vision (≤12 img) | 4o-mini | 140K (20K text + 120K img) | 5K | $0.024 |
| Before/after vision (~40% of clinics) | 4o-mini | 120K | 0.5K | $0.018 → amortized **$0.007** |
| Services — extract | 4o-mini | 18K | 3K | $0.0045 |
| Services — refine | 4o-mini | 14K | 4K | $0.0045 |
| Concerns | 4o-mini | 14K | 4K | $0.0045 |
| `gpt-4o` escalation (~15% of clinics) | 4o | 20K | 4K | $0.09 → amortized **$0.014** |
| **Per clinic (blended)** | | | | **≈ $0.058** |

| | Typical | High (heavy vision + more escalation) |
|---|---:|---:|
| Per clinic | $0.058 | ~$0.11 |
| **× 750 clinics (one-time)** | **≈ $45** | **≈ $85** |

> Via **Batch API**: ~$22–43. If images are sent low-detail, drops to **~$15–20** (see §7).

---

## 3. Cron — refresh Treatments + Concerns for all 750 clinics

> ⚠️ The **current** nightly cron uses **no AI** (heuristic regex/fuzzy match against the 15 canonical treatments; concerns untouched) → $0 AI today. This prices the **AI-based** cron you're asking for.

Per clinic/run = services extract + refine + concerns = **3 `gpt-4o-mini` text calls ≈ $0.0135**.

| Item | Cost |
|---|---:|
| Per clinic / run | ~$0.014 |
| **Full run (750 clinics)** | **≈ $10 / run** |

**By schedule:**

| Frequency | Monthly |
|---|---:|
| Daily | **≈ $300 / mo** |
| Weekly | **≈ $44 / mo** |
| Monthly | **≈ $10 / mo** |

> Halve with Batch. **Recommendation:** weekly or monthly — treatment/concern data drifts slowly; daily (~$300/mo) buys little extra freshness.

---

## 4. AI treatment help (Treatment/Skin Navigator) — per request

One `gpt-4o-mini` **vision** call per request (1 uploaded photo + prompt, ~2.4K max output).

| Volume | Cost |
|---|---:|
| Per request | ~$0.003 |
| **1,000 requests** | **≈ $3** |
| 5,000 requests | ≈ $15 |
| 10,000 requests | ≈ $30 |

> "Thousands of requests" = **single-digit to low-tens of dollars**. Cheap.

---

## 5. Chatbot — OpenRouter (free today) → OpenAI

> ⚠️ Today the chatbot runs on OpenRouter **`:free`** models → **$0**. Moving to OpenAI introduces real cost. It's **1 model call per user message** (no tool loop): ~900-token system prompt + injected search/clinic context (~4K tokens), capped at 900 output tokens.

| Model | Per message | Per 1,000 msgs | @ 10,000 msgs/mo |
|---|---:|---:|---:|
| **`gpt-4o-mini`** (recommended) | ~$0.0013 | **$1.30** | **≈ $13 / mo** |
| `gpt-4o` | ~$0.0215 | $21.50 | ≈ $215 / mo |

> **Recommendation:** `gpt-4o-mini` — ~16× cheaper and fine for grounded, fact-injected answers. Only reach for `gpt-4o` if quality proves insufficient.

---

## 6. Google Places — rating + review count + 5 reviews × 750 clinics

> ⚠️ Current code (`lib/ratings/fetch-rating.ts`) fetches only `rating` + `userRatingCount` (no review text). Pulling **5 reviews needs the Atmosphere field mask** → a small code change **and** the higher SKU below.

| Approach | SKU | Per 1,000 | 750 clinics |
|---|---|---:|---:|
| **B — Place Details** (if `place_id` derivable from the stored Google Maps URL) | Enterprise + Atmosphere | $25 | **≈ $19** |
| A — Text Search by name/address (no `place_id`) | Enterprise + Atmosphere | $40 | ≈ $30 |

- Prefer **Approach B ($19)** — Maps links are already scraped, so `place_id` is usually derivable and avoids the pricier Text Search.
- **Free tier:** 750 calls likely sits within Google's monthly per-SKU free allowance → potentially **$0/month**. Budget **$19–30** as safe worst case.
- A monthly review refresh = same ~$19–30/run (again likely $0 under free tier).

---

## 7. Biggest cost driver & how to control it

**Vision image tokens dominate the ingest cost** (~85% of the details call). Levers:
- **`detail: "low"`** on vision → images drop to ~2.8K tok each → roughly halves ingest cost.
- **Lower `VISION_IMAGE_CAP`** 12 → 6–8.
- **Batch API** on one-time ingest + cron → 50% off.
- If images run low-detail (or the code's own "~1.5K tok/image" estimate holds), one-time ingest drops from ~$45 to **~$15–20**.

---

## 8. Summary

| Workload | Scale | Cost |
|---|---|---|
| **One-time full ingest** | 750 clinics | **~$45** one-time (range $30–85; ~$22 Batch) |
| **AI cron — treatments + concerns** | 750/run | **~$10/run** → $10/mo (monthly) · $44/mo (weekly) · $300/mo (daily) |
| **Treatment/Skin Navigator** | per 1,000 req | **~$3** |
| **Chatbot on OpenAI** (`gpt-4o-mini`) | per 1,000 msgs | **~$1.30** (~$13/mo @10K); `gpt-4o` ≈ $215/mo |
| **Google Places** (rating + count + 5 reviews) | 750 clinics | **~$19** one-time (Place Details); ~$0 if within free tier |

### Illustrative first-month total (recommended config)
Ingest **$45** + Places **$19** + weekly cron **$44** + chatbot `gpt-4o-mini` @10K msgs **$13** + navigator @2K req **$6** ≈ **~$127 first month**, dropping to **~$63/mo recurring** (cron $44 + chatbot $13 + navigator $6). Batch API halves the ingest + cron lines.

> All OpenAI figures scale linearly with volume and image-detail settings. The single most effective cost control is image detail/count on the vision calls (§7).

---

### Sources
- [OpenAI API Pricing](https://developers.openai.com/api/docs/pricing) · [gpt-4o-mini](https://devtk.ai/en/models/gpt-4o-mini/) · [gpt-4o](https://pecollective.com/tools/gpt-4o-pricing/)
- [Google Places API — Usage & Billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing) · [Places pricing 2026](https://mapatlas.eu/blog/google-maps-api-pricing-2026)
