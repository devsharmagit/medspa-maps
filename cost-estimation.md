# Cost to Add One Clinic (Website → Full DB Record)

> What it costs to ingest a single clinic website into medspa-map with **all** details — clinic info + locations, **providers**, **vision-selected images**, and **services/treatments**.
>
> **Entry point:** `bun scripts/ingest-one.ts <domain>`. **Companion docs:** [weburltodataindb.md](weburltodataindb.md), [ai-vision-plan.md](ai-vision-plan.md). **Last updated:** 2026-07-08.

---

## TL;DR

**≈ $0.03–0.05 per clinic** — one Claude call does everything (details + locations + providers + images + services). It's a **one-time** cost per clinic (the nightly rescrape cron uses the heuristic scraper, **not** the AI). Everything non-AI (fetching, geocoding, DB writes) is effectively **free**.

| Scenario | Per clinic |
|---|---:|
| Light (1 location, few services, small images) | **~$0.02** |
| **Typical** (vision + providers + ~15 services) | **~$0.03–0.04** |
| Heavy (multi-location, 12 large images, long menu) | **~$0.05–0.06** |
| + occasional Sonnet escalation (amortized) | +~$0.01 |

---

## 1. Pricing (per 1M tokens)

| Model | Role | Input | Output |
|---|---|---:|---:|
| `claude-haiku-4-5` | default ingest (vision-capable) | **$1.00** | **$5.00** |
| `claude-sonnet-5` | escalation only (text-only) | $3.00 ($2.00 intro→2026-08-31) | $15.00 ($10.00 intro) |

Standard-resolution vision ≈ **1.3–1.6K input tokens per image**.

---

## 2. What one clinic sends in a single Haiku call

Everything is extracted in **one** forced-tool call — the components below are all in that one request, not separate calls.

| Component | Direction | Tokens (observed / est.) | Notes |
|---|---|---:|---|
| System prompt (rules for all fields) | in | ~1.5K | fixed |
| Page text (homepage + ≤4 pages, 8K chars each) | in | ~6–14K | biggest text input |
| Image candidate list | in | ~0.5–1K | ~40 URLs+context |
| Booking + provider-image + Google-Maps candidates | in | ~1–2K | |
| **Service candidates + KNOWN TREATMENTS list** | in | ~1–1.5K | nav menu + catalog names |
| **Vision images (top ~12, base64)** | in | **~7–18K** | biggest single lever |
| **Output** (details+locations+providers+services JSON) | out | ~2–4K | grows with #providers/#services |

**Measured this session (Haiku):**
- germain, text-only: **in 7,507 / out 1,425**
- germain, **with vision**: **in 14,763 / out 1,940**  ← vision added ~7.3K input
- 88aesthetic, text-only: in 6,470 / out 775

So on real sites the vision images added **~7K input**, not the theoretical 18K (SVGs/failed fetches drop out; standard-res is cheap).

---

## 3. Per-clinic cost, built up by feature

Using the measured numbers + the services delta (candidates/catalog in, services array out):

| Line item | Δ Input | Δ Output | Δ Cost |
|---|---:|---:|---:|
| Base: details + locations + **providers** (text + candidates) | ~9K | ~1.5K | $0.009 + $0.008 = **$0.017** |
| **+ Vision images** (cover/logo/gallery by sight) | ~7K | ~0.5K | $0.007 + $0.003 = **$0.010** |
| **+ Services** (candidates + known catalog → mapped services) | ~1.5K | ~1K | $0.0015 + $0.005 = **$0.007** |
| **Per-clinic total (Haiku, all features)** | ~17.5K | ~3K | **≈ $0.034** |

Rounded: **~$0.03–0.04 per clinic**, all features on. Heavy clinics (multi-location, full 12 images, 30+ services) push toward **~$0.05–0.06**.

### Escalation (only when the primary call fails / returns 0 locations)
Text-only retry on Sonnet 5, ~12K in / ~3K out ≈ **$0.08/escalation** (standard) or ~$0.05 (intro). Fires on ~10–20% of clinics → **amortized ~$0.01/clinic**.

---

## 4. Non-AI costs (per clinic)

| Item | Cost |
|---|---|
| Fetch homepage + ≤4 pages (HTML) | ~free (bandwidth) |
| Fetch ~12 images for base64 encoding | ~free (a few MB) |
| Geocoding (Nominatim / OpenStreetMap) | **free** (rate-limited, not billed) |
| DB writes (postgres) | negligible |

The **only** metered cost is the Claude call.

---

## 5. Scaling to the corpus

| Volume | Typical (~$0.04) | With escalations (~$0.05 blended) |
|---|---:|---:|
| 15 clinics | ~$0.60 | ~$0.75 |
| 100 clinics | ~$4 | ~$5 |
| **~900 G99 domains (full run)** | **~$36** | **~$45** |

Consistent with [ai-vision-plan.md](ai-vision-plan.md) (~$0.05/clinic, ~$55–80 all-in with a conservative image-token assumption). Reality trends to the low end because observed image tokens (~7K) are below the 18K worst case.

---

## 6. Cost levers (if you need to tune)

| Lever | Effect |
|---|---|
| `VISION_IMAGE_CAP` (currently 12) | Each image ≈ 1.3–1.6K in. 12→6 saves ~$0.007/clinic; 12→20 adds ~$0.012. Biggest single lever. |
| `MAX_PAGE_CHARS` (8K/page) / #pages (≤5) | Trims the largest text input. |
| Turn vision off | Drops ~$0.01/clinic; images fall back to filename heuristics (lower quality). |
| Escalation model | Sonnet-only-on-failure keeps the expensive model rare. |
| Re-ingesting | Each re-ingest repeats the full per-clinic cost (delete-then-insert). |

---

## 7. What this cost does **not** include

- **Recurring/daily cost:** the nightly rescrape cron uses the **heuristic** scraper (no AI), so there is **no per-day Claude cost** — only initial ingest + manual re-ingests.
- **Reviews, before/after, ratings, rich provider bios** — not scraped (see [weburltodataindb.md §9](weburltodataindb.md)).

---

## 8. Throughput ≠ cost (a separate constraint)

Cost is low, but **speed** is capped by the org's Anthropic limits, not price:
- **~10K input tokens/minute (Haiku):** a vision call is ~15–17K tokens, so back-to-back clinics wait out `retry-after` backoff. A bulk run is throttled to roughly **<1 clinic/minute** until the org's rate limit is raised.
- A `400 "credit balance too low"` is a **billing** stop (top up in the Anthropic Console), not a timed limit.

So the money cost of a full corpus is small (~$36–45); the practical blocker is rate-limit throughput + having credits on the account.
