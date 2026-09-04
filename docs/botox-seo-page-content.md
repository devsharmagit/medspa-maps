# Botox — Standalone SEO Page (Content & Rationale)

> **Copy note:** the live page uses professional punctuation (no em dashes) per client
> preference; the live page at `/treatments/botox` is the source of truth for exact wording.
>
> **Status:** Proof-of-concept for approval. This is the proposed content for **one**
> standalone treatment page (Botox), built to rank for informational "botox" queries and
> funnel visitors into our clinic search. Static/hardcoded for now — no DB, no dynamic
> routing. Once the *content model* here is approved, we template it and drive it from the
> catalog for every treatment/condition.
>
> **Live page:** `/treatments/botox` — `web/src/app/treatments/botox/page.tsx`
> **Reference competitor:** https://ruma.com/services/botox-in-lehi-ut/ (Ruma Medical — also
> our pinned #1 featured client, so we feature + credit them on the page).

---

## 1. Why this page, this way (SEO strategy)

- **Search intent:** "botox" and its long-tail ("how long does botox last", "botox cost",
  "botox areas", "is botox safe", "botox vs fillers", "preventative botox") are overwhelmingly
  **informational**. We win the click by answering the question fully, then convert with a
  "find a provider near you" search — we're a directory, not a clinic, so education → search is
  our natural funnel.
- **We out-rank single clinics on E-E-A-T.** The Ruma page (a strong local page) has almost no
  medical disclaimer, no cited sources, and no reviewer. On a health (YMYL) topic Google
  rewards trust signals. Our page adds a disclaimer, cited authoritative sources, clear
  contraindications, and honest "results vary" language — a directory can out-trust a clinic on
  the *informational* query while sending the *transactional* click to real providers.
- **One repeated primary action:** every CTA says the same thing — **"Find Botox providers near
  you"** → `/search?q=Botox` (the site's established treatment deep-link). No competing asks.
- **Internal linking:** out to `/treatments`, the Botox-vs-fillers section links to dermal
  fillers, and the featured block links to a real practice profile — spreading crawl equity and
  giving users the next step.

### Meta
| Field | Value |
|---|---|
| **URL** | `/treatments/botox` |
| **H1** | Botox: What It Is, How It Works, Cost & How to Find a Provider Near You |
| **Title tag** (~58) | `Botox Guide: Cost, Areas, Safety & Providers Near You` |
| **Meta description** (~150) | `What Botox is, how it works, what it costs, areas treated, safety and side effects — plus find licensed Botox providers near you on Medspa Maps.` |
| **Canonical** | `https://<domain>/treatments/botox` (set manually — no `metadataBase` in the app yet) |
| **OG** | title/description as above + a share image |

### Primary & secondary keywords
`botox` · `what is botox` · `how does botox work` · `botox cost` / `how much is botox` ·
`botox units` · `how long does botox last` · `botox areas` · `botox side effects` ·
`is botox safe` · `botox vs fillers` · `preventative botox` · `botox near me`.

---

## 2. Page structure (sections in order)

Each `H2` maps to a real query cluster / "People Also Ask" question.

1. **What is Botox?** — definition + first CTA above the fold
2. **How Botox works** — dynamic vs. static wrinkles
3. **What Botox treats — areas & uses** — units/time table
4. **Botox cost, what to expect** — per-unit + by-area, "varies" disclaimer
5. **How long does Botox last?** — results timeline
6. **What to expect: treatment day, downtime & aftercare**
7. **Botox safety, side effects & who should avoid it** — YMYL trust block + contraindications
8. **Botox vs. dermal fillers** — internal link to fillers
9. **Preventative Botox — when to start**
10. **How to choose a qualified Botox provider** — E-E-A-T checklist + **featured provider (Ruma)**
11. **Frequently asked questions** — FAQPage schema
12. **Find Botox providers near you** — final location-search box (ZIP/city input + "use my
    location") over a faint decorative map; routes to `/search?q=Botox&location=…`

---

## 3. Full copy

> All facts below are sourced from the references in §6 and the in-repo Botox catalog entry
> (`web/src/lib/treatments/catalog.ts`). Numbers are national ranges, not quotes — the page
> always says pricing/results *vary by provider and region*.

### Hero
**Botox: what it is, how it works, cost & how to find a provider near you**
Botox is the most-requested aesthetic treatment in the country — and one of the most
misunderstood. This guide covers what Botox actually does, the areas it treats, what it costs,
how long it lasts, and how to choose a qualified injector. When you're ready, find and compare
licensed Botox providers near you.
→ **[Find Botox providers near you]** (`/search?q=Botox`)

*Educational information only — not medical advice. Botox is a prescription treatment that must
be administered by a licensed medical provider.*

### 1. What is Botox?
Botox® is the brand name for a purified form of botulinum toxin type A, a prescription
injectable used to temporarily relax specific muscles. In aesthetics, it's used to soften the
fine lines and wrinkles caused by repeated facial expressions — frowning, squinting, raising
your brows. It's been FDA-approved for cosmetic use since 2002 and is one of the most-studied
aesthetic treatments in the world. "Botox" is often used as a catch-all, but it's one of
several neuromodulator brands — Dysport, Xeomin, Jeuveau and Daxxify work the same way.

### 2. How Botox works
Facial wrinkles come in two types. **Dynamic wrinkles** appear when you make expressions — the
"11s" between your brows, forehead lines, crow's feet. **Static wrinkles** are visible at rest.
Botox works on dynamic wrinkles: it temporarily blocks the nerve signals that tell the treated
muscle to contract, so the muscle relaxes and the overlying skin smooths out. Because the
muscle simply rests, results look natural — you keep normal expression when it's dosed and
placed well. It does little for static wrinkles or lost volume; those are better addressed with
resurfacing or dermal fillers.

### 3. What Botox treats — areas & uses
Botox is used across the upper face and, increasingly, for jaw slimming, a lip flip, neck
bands, and excessive sweating. Typical dosing varies by person, anatomy, and goal — your
injector determines the right amount.

| Area | What it addresses | Typical units* |
|---|---|---|
| Forehead lines | Horizontal lines when you raise your brows | 10–30 |
| Frown lines ("11s") | Vertical lines between the brows (glabella) | ~20 |
| Crow's feet | Lines fanning from the outer eyes | ~20 (per side ~12) |
| Bunny lines | Wrinkles on the sides of the nose | ~5–10 |
| Brow lift | Subtle lift to open the eyes | ~5–10 |
| Lip flip / lip lines | Softens vertical lip lines; gentle outward roll | ~4–8 |
| Chin (dimpling) | Smooths a "pebbled" or dimpled chin | ~5–10 |
| Masseter / jaw slimming | Relaxes the jaw muscle; slims the lower face; helps clenching | ~20–30 per side |
| Neck bands (platysma) | Softens vertical neck cords | 25–50 |
| Hyperhidrosis (underarms) | Reduces excessive sweating (a medical use) | ~50 per area |

*\*National ranges for orientation only — not a quote. Actual dosing is set by your provider.*

Botox also has established **medical** uses (chronic migraine, hyperhidrosis, TMJ/jaw
clenching, an overactive bladder) that a medical provider administers.

### 4. Botox cost — what to expect
Botox is usually priced **per unit** (most common) or, at some practices, per treatment area.
Nationally, per-unit pricing runs roughly **$10–$20**, and a typical single session averages
around **$400–$600**, depending on how many units you need. As a rough guide, treating the
frown lines might take ~20 units, the forehead ~10–30, and crow's feet ~20 — so a full upper
face is often **50–85 units**. Cost depends on your area, the injector's experience, the number
of units, and the brand used. Be cautious of prices that seem far below local norms — deep
discounts can signal over-dilution or inexperience. **Prices vary widely by provider and
region** — compare local practices to see real options near you.
→ **[Compare Botox providers near you]** (`/search?q=Botox`)

### 5. How long does Botox last?
Botox isn't instant and it isn't permanent. You'll typically start to see results in **3–5
days**, with the full effect at about **10–14 days**. Results generally last **3–4 months**,
then gradually fade as muscle movement returns. With consistent treatment, some people find
results last a little longer over time as the treated muscles weaken with regular use. When
results fade, the wrinkles return to their prior state — Botox doesn't make lines worse.

### 6. What to expect: treatment day, downtime & aftercare
A Botox appointment is quick — usually **20–30 minutes** with little to no downtime. After a
brief consultation, your provider cleanses the area and makes a series of tiny injections with
a very fine needle; most people describe it as a quick pinch. You can generally return to your
day right away.

**Common aftercare guidance** (always follow your provider's specific instructions):
- Stay upright for about 4 hours; avoid lying down or napping.
- Don't rub, massage, or apply pressure to the treated areas for ~24 hours.
- Skip strenuous exercise, saunas, and alcohol for the rest of the day.
- Mild redness, swelling, or small bumps at injection sites usually settle within hours;
  minor bruising is possible.

### 7. Botox safety, side effects & who should avoid it
Botox has a long, well-documented safety record when administered by a trained, licensed
medical provider, and cosmetic doses are very small and localized. Still, it's a prescription
medication with real considerations.

**Common, temporary side effects:** redness, swelling, or bruising at the injection site;
headache; and — uncommonly, if the product spreads or placement is off — a temporary drooping
of an eyelid or brow that resolves as the effect wears off.

**Who should generally avoid Botox / talk to a provider first:** people who are pregnant or
breastfeeding; anyone with a neuromuscular disorder (e.g. myasthenia gravis, ALS); those with a
known allergy to any ingredient; and anyone with an active skin infection at the injection
site. This is not a complete list — a licensed provider will review your history and determine
whether Botox is appropriate for you.

### 8. Botox vs. dermal fillers
People often use "Botox" and "fillers" interchangeably, but they do different jobs. **Botox
relaxes muscles** to soften wrinkles caused by movement (dynamic lines). **Dermal fillers add
volume** — they plump lips, restore cheek volume, and fill static folds and lines that are
present at rest. Many people combine both. If your concern is volume loss or deep folds rather
than expression lines, start with fillers.
→ **[Explore dermal fillers providers](/search?q=dermal-fillers)**

### 9. Preventative Botox — when to start
"Preventative" (or "baby") Botox uses smaller doses earlier — often in the mid-to-late 20s or
early 30s — to relax the muscles before repeated expressions etch permanent static lines. The
idea is to slow the formation of set-in wrinkles rather than treat them after the fact. There's
no universal "right age"; it depends on your skin, genetics, and goals. A provider can tell you
whether it makes sense for you.

### 10. How to choose a qualified Botox provider
Botox is a medical procedure — who injects you matters as much as the product. Look for:
- A **licensed medical provider** (physician, PA, NP, or RN) working under proper medical
  supervision.
- **Experience specifically with injectables** and the areas you care about.
- A real **consultation** that reviews your health history and sets natural goals.
- **Genuine before/afters and reviews** from actual patients.
- **Transparent pricing** (per unit or per area) with no pressure.
- **A clean, licensed medical facility** — not a pop-up or a house party.
**Red flags:** prices far below local norms, no medical intake, no licensed provider on site,
or reluctance to answer questions.

*(Featured provider block — Ruma Medical — appears here; see §5 of this doc.)*

### 11. Frequently asked questions
Mirrors the on-page `FAQPage` schema (§4).

1. **Does Botox hurt?** Most people feel only a quick pinch. The needle is very fine and
   appointments are brief; some providers use a topical numbing cream or ice for comfort.
2. **How long does Botox last?** Typically 3–4 months. Results begin in 3–5 days and peak
   around two weeks, then gradually fade.
3. **When will I see results?** Usually within 3–5 days, with the full effect at about 10–14
   days.
4. **Is there any downtime?** Little to none — most people return to normal activities right
   away, avoiding exercise, lying down, and rubbing the area for the rest of the day.
5. **How much does Botox cost?** It's usually priced per unit (roughly $10–$20 nationally),
   so the total depends on how many units you need. Prices vary by provider and region.
6. **Is Botox safe?** Botox has a long safety record when administered by a licensed medical
   provider. Side effects are usually mild and temporary. It's still a prescription treatment —
   discuss your history with a provider.
7. **Will Botox make me look frozen?** Not when it's dosed and placed well. The goal of a
   skilled injector is natural, softened movement — not a frozen look.
8. **Botox vs. Dysport / Xeomin — what's the difference?** They're all botulinum toxin type A
   neuromodulators that work the same way; they differ slightly in formulation, spread, and
   onset. A provider can recommend the best fit.
9. **Can I combine Botox with other treatments?** Yes — Botox is commonly combined with dermal
   fillers, and with treatments like microneedling or facials, as part of a plan.
10. **Who should not get Botox?** People who are pregnant or breastfeeding, have certain
    neuromuscular disorders, have a relevant allergy, or have an active infection at the site.
    Always consult a licensed provider.

### 12. Find Botox providers near you
Ready to take the next step? Search Medspa Maps to find and compare licensed med spas offering
Botox near you — see the treatments they offer, read real patient reviews, and book directly
with the practice.
→ **[Find Botox providers near you]** (`/search?q=Botox`) — optional location field / "use my
location".

### Persistent disclaimer (footer of content)
*Medspa Maps is a directory that helps you find and compare med spas — we are not a medical
provider and do not provide medical advice. This page is for general education only. Botox is a
prescription treatment that must be administered by a licensed medical professional. Individual
results, pricing, and suitability vary; consult a qualified provider to determine what's right
for you.*

---

## 4. Structured data (JSON-LD `@graph`)

Injected via inline `<script type="application/ld+json">` (same pattern as
`components/hero/faq-section.tsx`). One `@graph` with:

- **`MedicalWebPage`** (primary): `name`, `description`, `medicalAudience: Patient`,
  `about` → the Botox `Drug`/`MedicalEntity`, `lastReviewed` (today), `specialty: Dermatology`.
  **No `reviewedBy`** yet — reviewer intentionally omitted until a real clinician is attached.
- **`FAQPage`**: mirrors the 10 FAQs above exactly.
- **`BreadcrumbList`**: Home → Treatments → Botox.
- **`MedicalProcedure`** (optional node): `name: Botox`, `howPerformed`, `bodyLocation: Face`,
  built from the catalog fields.
- **Deliberately NOT** included: `AggregateRating` / `Review` on this informational page
  (structured-data spam risk — reviews belong on practice profiles).

---

## 5. Images & credits

All imagery is either licensed stock (Unsplash, allow-listed in `next.config.ts`) or Ruma's own
**non-patient** marketing assets, downloaded to `web/public/images/botox/` and shown with a
visible credit + link. **No patient / before-after photos are used anywhere** (per direction).

| File | What it is | Where used | Credit shown |
|---|---|---|---|
| `ruma-botox-service.webp` | Ruma provider administering Botox (staged brand photo) | §1 "What is Botox" visual | "Photo: Ruma Medical" → link to ruma.com |
| `ruma-clinic.webp` | Ruma clinic interior | Featured-provider block (§10) | "Photo: Ruma Medical" → link |
| `ruma-logo.png` | RUMA Medical logo | Featured-provider block | Links to their Botox page |
| Unsplash (via `treatmentImage("botox")`) | On-theme stock | Any secondary/decorative slot | n/a (licensed) |

**Featured-provider block (Ruma):** rendered as a **replica of the site's home-page ClinicCard**
(`components/hero/find-clinic-section.tsx`) so the design stays consistent — FEATURED badge,
clinic cover photo, logo + verified name + "Lehi, UT", 5.0 ★ (400+), treatment tags + "+ More",
and "View profile" (`/practices/ruma-medical`) / "Book now" (ruma.com) buttons, with an "Images
courtesy of Ruma Medical" credit below. Positioned as an example of a highly-rated provider you
can find through the directory. *Courtesy note: confirm reuse permission with Ruma before production launch — they're
a featured partner, so this is a formality, not a blocker.*

---

## 6. Sources (cited on-page, outbound)

- FDA — Botulinum toxin information
- Botox Cosmetic (AbbVie) — official product FAQ: https://www.botoxcosmetic.com
- Cleveland Clinic — Botulinum toxin injections:
  https://my.clevelandclinic.org/health/treatments/8312-botulinum-toxin-injections
- American Society of Plastic Surgeons (ASPS) — Botox cost & statistics
- Medical News Today — Botox vs. fillers: https://www.medicalnewstoday.com/articles/320510

---

## 7. Compliance / YMYL checklist (what makes this trustworthy)

- [x] Persistent "educational only, not medical advice" disclaimer.
- [x] Clear directory positioning ("we are not a provider").
- [x] Contraindications section framed as "talk to a provider."
- [x] "Results/pricing vary" language — no guarantees, no fixed prices presented as quotes.
- [x] Cited authoritative outbound sources.
- [x] `lastReviewed` date in schema + a visible "Last updated" line.
- [ ] Named medical reviewer byline — **deferred** (add a real clinician later; no fabricated
      credentials).
