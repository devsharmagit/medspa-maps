# AI Vision for Image Selection — Plan, As-Built & Cost

> **Status:** IMPLEMENTED (2026-07-08). Verified on germaindermatology.com + 88aestheticandwellness.com — Haiku vision now picks cover/logo/gallery by sight, no Sonnet escalation, and the picks render on the clinic page.
> **Goal:** let Claude *look at* candidate images and choose a better cover, logo, and gallery — instead of guessing from URL/alt/context text alone.
> **Scope:** cover + logo + **gallery cleanup**. Provider headshots excluded (vision can't match a face to a name). **Always on.** Model: `claude-haiku-4-5`.
> **Transport (CHANGED during build):** ~~URL image source~~ → **base64**. The URL source hit this org's "URL Content Fetching" rate limit (~10 req/min) on the very first call, so we now fetch the shortlisted images ourselves and send bytes. See §2.1.

---

## 1. Why

The ingest LLM currently picks `cover_image_url` / `logo_url` / `gallery_image_urls` from a **text-only** list of `{url, alt, context}` — it never sees the pixels. Consequences we've observed:
- 88aesthetic's "cover" is a wordmark/service image rather than a real hero photo.
- Gallery strips still admit icons / promos / logo-ish images.
- A logo file can look like any content image by filename alone.

Letting Claude see the top candidates fixes the *judgement* calls (which image is the real hero, which is the logo, which are real clinic photos).

---

## 2. How it works (as built)

Reuses the existing single extract call (`extractClinicDetails` → `extractViaTool`), which already returns cover/logo/gallery. The **top ~12 candidate images** are attached to that call as image blocks so the model sees them while choosing. No new call, no new schema, no new validation path.

- **`web/src/lib/ai/anthropic.ts`** — `ToolExtractOptions` gained `images?: Array<{ label; source }>` where `source` is a `{type:"url"}` **or** `{type:"base64", media_type, data}` block. The user message `content` is now a content-block array: the prompt text, then for each image a `{type:"text", text: label}` (URL + context) followed by `{type:"image", source}` — the interleaved labels let the model map each picture to its exact URL and echo it back verbatim. No beta header, no `anthropic-version` bump — `2023-06-01` already supports image blocks + forced `tool_choice`.
- **`web/src/lib/ingest/ai-extract.ts`** — `buildVisionImages()` ranks `imageCandidates` by `context` priority (`og-image → schema-logo → preload → header → hero → background → gallery → footer → body`), http(s) only, caps at **`VISION_IMAGE_CAP = 12`**, then **fetches each and base64-encodes it** (`fetchImageBase64`, 15s timeout, ≤4.5 MB, jpeg/png/gif/webp only — SVG unsupported by vision so those stay text-only candidates). The IMAGES prompt tells the model it is *shown the actual images* and to judge by sight. The verbatim-URL rule is unchanged, so `candUrls` validation ([ingest-clinic.ts:250-258](web/src/lib/ingest/ingest-clinic.ts)) still holds; heuristic `extractImages` stays the fallback.
- **Robustness:** vision runs only on the **primary** Haiku attempt (`useVision` defaults true). Both escalation retries pass `useVision: false` (text-only) so a bad image can't break extraction.
- **No change** to `clinic-save.ts` — validation, fallback, and persistence already work; provider headshots untouched.

### 2.1 Rate limits discovered during implementation (IMPORTANT)

Two org-level limits shaped the build, both on org `7feb091c…`:
1. **URL Content Fetching ≈ 10 requests/min.** Sending 12 image *URLs* in one request = 12 server-side fetches → **429 on the first call**. This is why the transport is base64 (we fetch the bytes ourselves; base64 blocks don't touch this limit).
2. **Haiku input tokens ≈ 10,000/min.** A vision call is ~15K input tokens — over the per-minute budget *by itself*. The first call succeeds (bucket full) but back-to-back calls 429. Handled by **`retry-after`-aware backoff** in `anthropic.ts` (`postWithRetry`, retries 429/529 up to 5×, honours `retry-after`, else exponential to 60s). This makes single ingests reliable but **throttles bulk ingest to well under one clinic/minute**. To ingest the full corpus at speed, **raise this org's Haiku token-per-minute limit** (usage-tier upgrade or an increase request).

---

## 3. Cost

Pricing: **Haiku 4.5 = $1.00 / 1M input, $5.00 / 1M output**. ~1.3–1.6K input tokens per standard-res image.

**Per clinic (one vision-augmented Haiku call):**

| Component | Tokens | Cost |
|---|---:|---:|
| Images (~12 × ~1.5K) | ~18K | $0.018 |
| Existing text (pages + candidate lists + system prompt) | ~18–22K | ~$0.020 |
| Output (~3K of 6,144 max) | ~3K | $0.015 |
| **Per clinic total** | ~40K in / 3K out | **~$0.05** (range $0.04–$0.07) |

**Incremental cost of vision specifically** (the added image tokens only): ~18K × $1/M = **~$0.018/clinic** on top of today's text-only ingest.

**Full-corpus estimates (~900 G99 domains, one pass):**

| | Cost |
|---|---:|
| Vision add-on only (~$0.018 × 900) | **~$16** |
| Full ingest *with* vision (~$0.05 × 900) | **~$45–$65** |
| + occasional Sonnet escalations (~10–20% of clinics, ~$0.10 each) | +~$10–$18 |
| **Full corpus run, all-in** | **~$55–$80** |

**Notes that bound ongoing cost:**
- One-time / on-demand only. The **nightly rescrape cron uses the heuristic scraper, not the AI ingest**, so vision cost is *not* incurred daily — only on initial ingest and manual re-ingests.
- Each full re-ingest of the corpus repeats the ~$55–$80.
- Escalation to Sonnet ($3/$15 per 1M) is text-only (no images) and only fires on failure/zero-locations, so it stays a minor add.
- Bumping the shortlist from 12→20 images raises the per-clinic image cost from ~$0.018 to ~$0.030 (~$27 corpus-wide) — the main cost lever if quality needs more candidates.
- **base64 vs URL transport is cost-neutral** at standard res (~1.3–1.6K tokens/image either way); base64 just moves the fetch to our side. The real bulk bottleneck on this org is the **10K-token/min rate limit (§2.1), not cost** — raise the limit before a full run.

---

## 4. Caveats
- **Rate limits, not hotlinks, are the constraint** (§2.1). base64 sidesteps the URL-fetch limit; `retry-after` backoff handles the token/min limit for single ingests. Bulk throughput needs a higher org limit.
- **SVG logos are invisible to vision** — SVG isn't a supported media type, so an SVG logo is skipped from the shortlist and chosen from its text candidate line (filename/context) instead. (88aesthetic's logo happened to be a `.jpg`, so it was seen.)
- **Provider headshots excluded** — vision can confirm "is a person" but can't name-match a face; they keep the current text/position path.
- **Haiku standard-res vision** is used for cost; `claude-sonnet-5` offers high-res (2576px) if fine detail matters — a per-quality upgrade lever, not the default.
- **Minor residual:** on 88aesthetic a few Instagram 300×300 thumbnails were kept in the gallery — they are genuine clinic photos, just low-res. Tighten the prompt (exclude tiny social crops) if undesired.

---

## 5. Verification (done)
1. `web/scripts/check-vision.ts <domain…>` (no DB) — runs the vision vs text-only extraction and prints cover/logo/gallery + the exact error on failure. This is how the 429 rate-limit findings surfaced.
2. `bun --env-file=.env scripts/ingest-one.ts germaindermatology.com 88aestheticandwellness.com` — both `saved | model=claude-haiku-4-5` (no escalation). germain cover=`homepageslider2.webp`, logo=`Asset-1.png`, gallery=11 real photos. 88aesthetic cover=`Welcome-Section-scaled.webp` (was a wordmark before), logo correct.
3. `curl -s localhost:3000/clinics/germain-dermatology` confirms the cover/logo/gallery render on the clinic page.
4. TODO before a bulk re-run: raise the Haiku token/min limit; optionally re-check the ~18 existing clinics.

## 6. Files changed
- `web/src/lib/ai/anthropic.ts` — `ToolExtractOptions.images?` (url|base64 source) + string→content-block-array message content + `postWithRetry` 429/529 backoff.
- `web/src/lib/ingest/ai-extract.ts` — `buildVisionImages` shortlist + base64 fetch (`fetchImageBase64`), `VISION_IMAGE_CAP=12`, `useVision` flag, IMAGES prompt update.
- `web/src/lib/ingest/ingest-clinic.ts` — both escalation retries pass `useVision: false`.
- `web/scripts/check-vision.ts` — new isolated vision spot-check (verification tool).
- No change: `clinic-save.ts`.
