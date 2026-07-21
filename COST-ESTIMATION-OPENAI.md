# medspa-map — OpenAI Cost Estimation

**Updated:** 2026-07-20 · **Scale:** 500 clinics · **Provider:** OpenAI only (chatbot moved off OpenRouter)

---

## What This Document Covers

This file answers the question: **"What will this actually cost to run?"** — broken into four distinct buckets:

1. **One-time cost** to add 500 clinics to the database
2. **Recurring cron job** cost to keep treatments & concerns fresh
3. **AI Chatbot** cost (now running on OpenAI, not OpenRouter)
4. **AI Skin Treatment Navigator** cost (also on OpenAI)

Everything is in plain dollars. No token counts, no per-million math — just what you'd expect to see on an invoice.

---

## How the Pipeline Works (Plain English)

### Adding a New Clinic

When a clinic website is ingested, the following happens automatically:

**Step 1 — Clinic Details (1 AI call with vision)**
The AI reads the clinic's website pages and extracts: business name, address(es), phone, hours, booking link, social media links, and a short about description. At the same time, it looks at up to 12 website images to decide which one is the hero/cover photo, which is the logo, and which are gallery photos (capped at 5).

**Step 2 — Provider Photos (part of the same AI call)**
The AI reads team/about pages and extracts up to 10 providers (names, titles, headshots).

**Step 3 — Before & After Images (1 AI vision call, only ~40% of clinics have these)**
A second vision call classifies up to 10 before-and-after photos found in the gallery.

**Step 4 — Treatments (1 AI text call)**
The AI reads service/treatment pages and extracts every treatment the clinic offers, matching them to the canonical treatment catalog.

**Step 5 — Treatment Refinement (1 AI text call)**
A second pass cleans up and deduplicates the extracted treatments.

**Step 6 — Concerns (1 AI text call)**
The AI extracts every patient concern the clinic addresses (e.g. acne scars, fine lines, hyperpigmentation).

> **Treatments and concerns are extracted separately from clinic details** — this means treatments/concerns can be refreshed independently without re-scraping the whole clinic profile.

### Image Counts Per Clinic

Based on the pipeline code and your specification, OpenAI Vision is used for every image:

| Image Type | Count | Where Used |
|---|---:|---|
| Clinic gallery images | 5 | Gallery section on clinic page |
| Cover image | 1 | Hero/banner photo on clinic card |
| Provider headshots | up to 10 | Team/about section |
| Before & after images | up to 10 | B&A gallery (only clinics that have them) |
| **Total vision images per clinic** | **up to 26** | All processed by OpenAI Vision |

> Vision (looking at images) is the single largest cost driver for initial ingestion.

---

## 1. One-Time Cost: Adding 500 Clinics

This is what you pay **once** to get 500 clinics fully ingested with all details, images, providers, treatments, and concerns.

### What happens per clinic

| Step | What the AI does |
|---|---|
| Clinic details + vision | Reads website pages and views up to 12 images to pick cover, logo, gallery |
| Provider headshots | Matches provider names to their headshot photos (up to 10) |
| Before/after photos | Classifies before-and-after images (only ~40% of clinics have these, capped at 10) |
| Treatments extract | Reads service pages and extracts all treatments offered |
| Treatments refine | Cleans up and deduplicates the treatment list |
| Concerns extract | Extracts patient concerns the clinic treats |
| Escalation fallback | If the main AI call fails, a more capable model retries (affects ~15% of clinics) |

### Cost breakdown

| What | Per clinic | 500 clinics |
|---|---:|---:|
| Clinic details + cover/gallery vision (up to 6 images) | ~$0.025 | ~$12.50 |
| Provider headshots vision (up to 10 images) | ~$0.015 | ~$7.50 |
| Before/after vision (~40% of clinics, up to 10 images) | ~$0.007 avg | ~$3.50 |
| Treatments extract + refine | ~$0.009 | ~$4.50 |
| Concerns extract | ~$0.005 | ~$2.50 |
| Escalation fallback (~15% of clinics) | ~$0.014 avg | ~$7.00 |
| **Total per clinic** | **~$0.075** | |
| **Total for 500 clinics** | | **≈ $38** |

**Realistic range: $28 – $60** depending on how many clinics have before/after photos, provider headshots, and how many trigger the escalation fallback.

> 💡 **Save ~50%:** OpenAI's Batch API processes jobs asynchronously (24hr window) at half price. For a one-time bulk ingest there is no reason not to use it — that brings the total to roughly **$18 – $30**.

---

## 2. Recurring Cron Job — Treatments & Concerns Refresh

The cron job **only** re-scrapes and re-extracts treatments and concerns for each clinic. It does **not** re-fetch clinic details, images, providers, or before/after photos. No vision calls are made — it is pure text extraction.

### What the cron does per clinic

1. Fetches up to ~55 pages from the clinic website (services, conditions, about pages)
2. Runs the AI twice: once to extract treatments, once to refine them
3. Runs the AI once to extract concerns
4. Replaces existing treatment/concern data in the database

### Cost per run

| What | Per clinic | 500 clinics |
|---|---:|---:|
| Treatments extract + refine + concerns (3 text-only AI calls) | ~$0.014 | ~$7.00 |
| **Cost per full run** | | **≈ $7** |

### By schedule

| How often | Monthly cost |
|---|---:|
| **Monthly** (recommended) | **~$7 / month** |
| Weekly | **~$30 / month** |
| Daily | **~$210 / month** |

> **Recommendation: Monthly.** Treatment menus at medspas don't change week-to-week. A monthly refresh is more than sufficient and keeps costs minimal. Weekly is a reasonable middle ground if you want slightly fresher data. Daily is almost certainly overkill and is roughly 30× more expensive than monthly for negligible benefit.

---

## 3. AI Chatbot

The chatbot is now on OpenAI (`gpt-4o-mini`). The OpenRouter key is removed.

### How the chatbot works

Each time a user sends a message, the system makes **one single AI call**:
- Detects what the user is asking (intent routing — no AI cost)
- Fetches relevant clinic or treatment data from the database (no AI cost)
- Sends: system prompt + fetched data + user's message → gets one response back

No vision, no tool calls, no loops. One plain text completion per user message.

### Cost

| Usage | Monthly cost |
|---|---:|
| Light — 2,000 messages/month | ~$2.60 |
| Moderate — 10,000 messages/month | **~$13** |
| Heavy — 50,000 messages/month | ~$65 |

> The chatbot is very affordable. Even at 50,000 messages/month (roughly 1,600 per day), it costs less than $70/month on `gpt-4o-mini`.

---

## 4. AI Skin Treatment Navigator

The navigator makes **one OpenAI vision call per user session**. The user fills out a questionnaire (skin goals, concerns, previous treatments) and optionally uploads a skin photo. The AI recommends treatments and explains why.

### How it works

- One `gpt-4o-mini` call with the treatment/concern catalog + the user's answers + optionally 1–2 skin photos
- Outputs: up to 5 treatment recommendations with rationale, expected downtime, and comfort notes
- No ongoing session state — each submission is a fresh, independent call

### Cost

| Usage | Monthly cost |
|---|---:|
| Light — 500 sessions/month | ~$2 |
| Moderate — 2,000 sessions/month | **~$7** |
| Heavy — 10,000 sessions/month | ~$35 |

> Very cheap. Even at high volumes, the navigator costs single-digit to low-tens of dollars per month.

---

## 5. Grand Total — Putting It All Together

### First Month (one-time ingest + recurring costs)

| Item | Cost |
|---|---:|
| One-time ingest of 500 clinics | ~$38 |
| Cron (monthly refresh, first run) | ~$7 |
| Chatbot — 10,000 messages | ~$13 |
| Skin Navigator — 2,000 sessions | ~$7 |
| **First month total** | **≈ $65** |

> With Batch API on the ingest: **≈ $46 first month**

### Every Month After (no ingest)

| Item | Cost |
|---|---:|
| Cron — monthly treatments & concerns refresh | ~$7 |
| Chatbot — 10,000 messages | ~$13 |
| Skin Navigator — 2,000 sessions | ~$7 |
| **Recurring monthly total** | **≈ $27 / month** |

---

## 6. Key Decisions & Notes

### OpenRouter → OpenAI (Chatbot)
The chatbot previously used free OpenRouter models (cost: $0). Moving to OpenAI `gpt-4o-mini` introduces roughly **$13/month at 10,000 messages/month**. This is the tradeoff for reliability, no rate-limiting surprises from free-tier throttling, and a single API key to manage across all AI features.

### Cron Job Scope
The cron job **only refreshes treatments and concerns** — nothing else. Clinic details, provider profiles, images, and before/after photos are not re-processed. This keeps the recurring cost low and avoids overwriting manually curated data.

### Vision for Every Image
Per your specification, OpenAI Vision processes all images at ingest time:
- 5 gallery images + 1 cover = 6 clinic images
- Up to 10 provider headshots
- Up to 10 before-and-after images

Vision is the largest cost component of the initial ingest. The recurring cron makes zero vision calls.

### Cost Levers (How to Reduce Costs)
- **Batch API on ingest** — cuts the one-time cost in half
- **Monthly cron instead of weekly** — 4× cheaper; treatments rarely change week-to-week
- **Fewer vision images at ingest** — reducing from 12 to 6 images per clinic cuts vision cost roughly in half

---

## 7. What This Does NOT Include

- **Server/hosting costs** — ECS, RDS, load balancer, etc.
- **Geocoding** — uses free Nominatim/OpenStreetMap, no cost
- **Google Places ratings** — optional enrichment, separate from this estimate
- **Web scraping** — HTTP fetches have no API cost, only server/bandwidth
- **Database writes** — no per-write cost beyond hosting

---

*Estimates based on the actual AI call structure in the codebase (`ingest-clinic.ts`, `ingest-treatments-concerns.ts`, `before-after.ts`, `skin-navigator/ai.ts`, `chat/route.ts`). Real costs may vary ±30% depending on clinic website complexity, image sizes, and actual usage patterns. OpenAI `gpt-4o-mini` pricing: $0.15/1M input tokens, $0.60/1M output tokens (July 2026).*
