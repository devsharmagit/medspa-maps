# Marketing Team Tasks — Home / Provider / Finder Feedback

**Created:** 2026-07-31 · **Source:** Marketing feedback (home page, provider pages, treatment finder)
**How we'll work:** one at a time, in order — **Sure tasks** get executed directly; **Not-sure
tasks** get a quick answer/decision from the senior first, then executed.

Every task keeps a stable ID (`S#` / `U#`) so we can reference it as we go.

**Legend:** `[ ]` not started · `[~]` in progress · `[x]` done

---

## 1. Sure Tasks — direct orders, ready to execute

These are unambiguous. No senior sign-off needed to *start*; a couple have an asset/verify note.

### General / terminology
- [x] **S3 — "medspa" → "med spa" everywhere, proper capitalization.** ✅ Done (public copy). Replace all `medspa`/`medspas`
  with `med spa`/`med spas`; ensure no mid-sentence capitalization unless it's a proper noun or
  sentence start. *(Covers the "Above the fold: medspas → med spas" note too.)*
- [x] **S4 — "clinics" → "practices" in all user-facing copy.** ✅ Done. Rename the term throughout the UI
  (keep DB table/column names as-is; copy layer only).
- [x] **S2 — Favicon → logomark.** ✅ Already the logomark (`web/src/app/icon.svg` is the brand head-glyph extracted from `logo.svg`; no competing `favicon.ico`). Verified in browser tab. Swap the favicon for the brand logomark. *(Needs the logomark
  asset file — grab from brand kit before starting.)*

### Home — navigation
- [x] **S5 — Remove "List Your Med Spa"** from the nav for now. ✅ Done (desktop + mobile).
- [x] **S6 — Rename nav "Clinics" → "Explore Practices."** ✅ Done.

### Home — above the fold
- [x] **S8 — Replace hero copy** ✅ Done. Now reads exactly:
  > "Explore 600+ vetted med spas, learn about what treatments are right for you, and book with
  > confidence. The industry's leading trusted resource for medical aesthetics patients."
- [x] **S9 — "SEARCH FOR" → "SEARCH BY."** ✅ Done (hero, home search, /search).
- [ ] **S1 — Add a map view for "treatments near me."** ⏸️ **PARKED (2026-07-31) — do NOT build yet.**
  Per Mehul: "don't embed anything, leave it as is for now" — he'll raise the map engine + default-view
  question with his manager. Context for when it's revived: the project has no Google Maps *JavaScript*
  API key (only a server-side embed key), so a multi-pin results map needs either a new Maps JS key
  (billing) or a free tile library (Leaflet + OpenStreetMap). Results already carry `lat`/`lng`.

### Home — below the fold
- [x] **S10 — Remove the "loved everywhere" claim** (too bold/insurmountable). ✅ Done — heading now "Trusted by Thousands."
- [x] **S11 — Make the Featured practice cards draggable** in addition to the existing
  thumb-through/arrow navigation. ✅ Done — cards now follow the cursor (direct-manipulation drag),
  native image-drag blocked, `grab`/`grabbing` cursor. Verified: drag advanced RUMA Medical → GFaceMD.
  **Extended (2026-07-31):** the **Popular treatments** card row is now click-and-hold drag-to-scroll
  on desktop too (mouse/pen), matching the native touch swipe on phones. Dragging suppresses the
  card's link so you don't accidentally open a treatment; a plain click still navigates. Verified.
- [x] **S12 — Add a "More +" button to every treatment** shown on a featured practice card, linking
  through to that practice's profile. ✅ Done — each card now has a "More +" / "+N More" chip →
  `/clinics/<slug>`. Verified href.

### Provider / practice pages
- [x] **S13 — Fix the misleading play button over the photo** ✅ Done — removed the mock play overlay. (it reads as a video). Remove or
  restyle so it doesn't imply video.
- [x] **S14 — Make the above-the-fold treatments & concerns anchor links** ✅ Done — hero counts scroll to `#treatments`/`#concerns` (with header offset). that jump down to their
  specific sections on the page.
- [ ] **S15 — Instagram link → general profile,** not a specific post.
- [x] **S16 — Add UTMs to the "Book appointment" link** ✅ Done — `withBookingUtm()` appends `utm_source=medspamaps&utm_medium=referral&utm_campaign=practice_profile&utm_content=<slug>` to all Book links. so we can attribute results. *(Define a
  standard UTM scheme — e.g. `utm_source=medspamaps&utm_medium=referral&utm_campaign=provider_profile`
  — and apply consistently. Pairs with S20.)*
- [x] **S20 — "Book your appointment" must go to the practice's real booking link of record** ✅ Done — booking_url→website of record; fixed the dead `#` fallback in the providers carousel.
  (direct booking URL), not a dead/relative link. *(Same link that carries the S16 UTMs.)*
- [ ] **S17 — Show a "last updated" date** on each listing.
- [x] **S18 — Format phone numbers with dashes** (e.g. `555-123-4567`). ✅ Done — `formatPhoneUs()` on the contact card. *(The call-vs-text capability piece is U8 — still blocked, no data field.)*
- [x] **S19 — Reduce what's nested under "show more"** ✅ Done — treatments & concerns now show in full (removed the 10-item cap + toggle). so treatments are visible by default rather
  than hidden.
- [ ] **S21 — Remove the "get your med spa listed" banner above the footer** on provider pages.
  *(The replacement "practices, request a correction" CTA is U9 — needs a destination decision.)*

### Find My Treatment (finder)
- [ ] **S22 — Rename the finder slug** from `skin-navigator` to something descriptive like
  `ai-aesthetic-treatment-finder`. *(Add a redirect from the old slug to preserve any existing links/SEO.)*
- [ ] **S23 — Add an AI disclaimer** over the finder input, using this copy:
  > "The information you provide will be leveraged by AI to create a conceptual treatment plan.
  > Responses provided do not constitute medical advice, and have not been reviewed by a medical
  > professional. The information you share will not be sold to a third-party."
  *(Verify the "not sold to a third-party" line matches our actual data policy before shipping.)*

---

## 2. Not-Sure Tasks — need a senior answer / decision first

Each lists the **specific question** to resolve before we build. I can investigate the code to
surface facts, but the call is the senior's.

### Home
- [ ] **U1 — Assistant name / brand neutrality.** *Is the med spa map assistant named "Gia"?* We
  want zero trace of the Growth99 name (incl. "Gia" if that's ours) to keep the site neutral.
  → **Need:** confirm the current assistant name and decide the neutral name; then strip any brand
  references. *(I can audit the code for the current name.)*
- [ ] **U2 — Canadian practices/customers.** *Are we intentionally excluding Canada?* Site is
  currently US-only by design. → **Need:** senior decision on whether to include Canadian
  practices, or keep US-only.

### Home — above the fold
- [x] **U3 — Priming text over the scroller.** ✅ **Moot — the scroller was removed** (2026-07-31,
  per Mehul: "remove this part… the strip where botox derma fillers and others are"). The
  `TreatmentCarousel` strip below the hero search bar is gone in all views (`<TreatmentCarousel />`
  + import removed from `hero-section.tsx`; the component file is kept, just unused). No more scroller
  to prime.
- [x] **U4 — Unique icon per scroller item.** ✅ **Moot — scroller removed** (see U3).

### Home — below the fold
- [ ] **U5 — Replace "100% personalized care" with a standards/trust statement.** The current line
  feels single-provider and consumer-fluffy. Proposed direction: something like *"100% of practices
  listed meet Medspa Maps standards."* → **Need:** *Do we have real listing standards/metrics? Is
  this a pure maps listing or is there a vetting bar?* Answer "why should a consumer trust this
  site?" so we can write an honest, defensible claim.
- [ ] **U6 — Popular-treatments redundancy + missing terms.** ✏️ *Partly addressed:* the above-fold
  treatment **strip was removed** (U3), so treatments now appear only once (the "Popular treatments"
  card grid). Still open: whether to add missing terms like peptides (catalog-expansion decision).
  Original note: Popular treatments appeared twice (above and below the fold). Also, big terms like
  **peptides** are missing, which may read as gaps / cost search traffic. → **Need:** decision to
  restructure/deduplicate + decision on expanding the treatment catalog (catalog is currently
  locked to a fixed taxonomy).

### Provider / practice pages
- [x] **U7 — Reviews source attribution.** ✅ Done & answered. The visible rating/review-count is the
  **external** rating (the `reviews` table is empty site-wide). Source is now labeled per practice from
  `clinics.ext_rating_source`: **"via Google"** (google_places, e.g. GloDerma) or **"from their website"**
  (e.g. RUMA); unlabeled when unknown. Note: only 28 of 669 rated practices have a recorded source.
- [ ] **U8 — Call vs. text on the phone number.** *Can patients both call and text the listed
  number?* If texting is supported, say so. → **Need:** confirm whether we know/track a number's
  textability. *(Dash formatting itself is S18.)*
- [ ] **U9 — "Request a correction" contact flow for practices.** Add (a) a contact button on the
  listing for providers to request revisions, and (b) a footer CTA (replacing the removed
  "get listed" banner, S21) telling practices to reach out to correct their listing. → **Need:**
  decide the destination/mechanism (reuse the existing clinic-leads inbox? dedicated email? new
  form?). *(The "last updated" display is already S17.)*
- [ ] **U10 — "Meet the providers" completeness + provider detail.** *Are we only showing the
  founder?* Providers should be clickable (or at least show a last name) so patients can learn
  about their expertise. → **Need:** confirm current provider data coverage + decide scope of
  provider detail (clickable cards vs. full provider pages).

---

## Summary
| Bucket | Count | IDs |
|---|---|---|
| Sure — done ✅ | 10 | S2, S3, S4, S5, S6, S8, S9, S10, S11, S12 |
| Sure — parked ⏸️ | 1 | S1 (map — awaiting manager decision) |
| Sure — not started | 11 | S13–S23 (Provider pages + Finder) |
| Not sure (needs decision) | 10 | U1–U10 |

**Next:** Global + Home batch is done except the parked S1. When ready, move to the Provider-page
batch (S13–S23).

---

## Session 1 log — Global + Home (2026-07-31)

**Shipped & verified in the local dev preview** (home page compiles clean, no console errors):
S2, S3, S4, S5, S6, S8, S9, S10, S11, S12.

**Decisions made (flag if you disagree):**
1. **Brand vs. generic term.** The generic word is **"med spa"** (lowercase in prose). The
   **product name** is now **"Medspa Maps"** (per your follow-up) — unified to the plural form
   everywhere in text, which also fixed the old "Map" vs "Maps" inconsistency. ⚠️ **The logo graphic
   still renders "MEDSPA MAPS"** as vector artwork (no editable text in the SVG) — updating the logo
   image to "Medspa Maps" is a design task, not a text edit. Same for the favicon mark.
2. **SEO description number.** The site `<meta>` description said *"10,000+ vetted medspas"* while the
   hero says *600+*. Aligned it to **600+** to avoid an inflated/contradictory claim.
3. **Scope of the term sweeps.** Applied to **patient-facing copy only**. Left untouched: `/admin`
   internal tooling, code identifiers, storage keys, analytics event names, and keyword-matching
   regex (users still *type* "medspa"/"clinic", so search matching must keep both).
4. **Drag (S11).** Root cause of "I can't drag" was the card photos triggering the browser's native
   image-drag. Fixed by blocking image drag + pointer-capture, and made the cards follow the cursor
   (not just snap past a threshold). Arrows/keyboard still work too.
5. **Capitalization = sentence case (follow-up pass).** Per your note ("no capitalization unless the
   start of a sentence"), all home-page headings/buttons/labels were converted from Title Case to
   sentence case (e.g. "Popular Treatments" → "Popular treatments", "View Profile" → "View profile",
   "How It Works?" → "How it works?"). **Kept capitalized:** the brand (Medspa Maps), treatment/
   procedure names (Botox, Dermal Fillers, HydraFacial…), acronyms/credentials (MD, RN, CEO…), place
   & people names, and legal/article-title text. **Left as-is:** intentional ALL-CAPS styling
   (eyebrows like "TRUSTED MED SPA DIRECTORY", "SEARCH BY", the stat labels — these are CSS-uppercased
   by design, not Title Case). Provider job titles come from the DB (dynamic data), so they weren't
   touched. Edits were run on a smaller model (Sonnet) to save cost, then verified in the browser.

**Also noticed (not acted on — your call):**
- The **home page still has its own "Get your med spa listed" section + lead form** (separate from the
  nav CTA you removed in S5 and the provider banner in S21). Left in place. Want it removed too?
- `web/src/lib/scroll-to-list-your-medspa.ts` and the resources lead form are now unreferenced by the
  nav but still render on the home page.
