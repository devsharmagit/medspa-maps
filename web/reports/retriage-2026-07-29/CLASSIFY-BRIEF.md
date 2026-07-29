# Classification brief — re-triage of previously-excluded clinic websites

You are re-checking websites that were **previously excluded** from a medical-spa
directory under criteria that were **too narrow**. Your job is to decide, per
domain, whether it should now be INCLUDED.

## The new inclusion rule

**INCLUDE** if the site offers **any aesthetic service to the public**:

- full medical spa (injectables, lasers, skin treatments, body contouring)
- **plastic surgery / cosmetic surgery practice** (facelift, rhinoplasty,
  liposuction, breast surgery, eyelid surgery…)
- cosmetic dermatology
- **day spa, nail salon, or lash/brow studio** — manicure, pedicure, facials,
  waxing, lashes, massage all COUNT
- any other business (chiropractic, ENT, OB/GYN, orthopedics, primary care…)
  that has an **aesthetics arm** — even a small one. This is the single most
  common false positive: a non-aesthetic practice with a Botox/filler/laser page.

**EXCLUDE** only for:

- `TRAINING_ONLY` — training academy / school teaching providers, no patient clinic
- `ASSOCIATION` — professional association or member body
- `CONFERENCE` — event / conference
- `NON_CLINIC_BUSINESS` — law firm, trucking, title/escrow, pharmacy, freight,
  fitness-only studio, K-12 school, software/marketing platform
- `NO_AESTHETIC_SERVICES` — a real clinic, but nothing aesthetic at all
- `OUT_OF_SCOPE_DENTISTRY` — dentistry, incl. cosmetic dentistry. **This directory
  carries no dentistry at all** (decided 2026-07-29): no dental treatment, no dental
  concern, no dentistry-first clinic. Veneers/whitening/smile makeovers do NOT qualify
- `PLACEHOLDER_COMING_SOON` — live but "coming soon" / no services or contact
- `PARKED_DOMAIN` — domain-for-sale / registrar parking page
- `DEAD_SITE` — unreachable

**Wellness-only is an EXCLUDE.** A clinic offering only hormones / weight loss /
IV therapy / peptides, with no skin, face, body-contouring, nail or lash service,
is `NO_AESTHETIC_SERVICES`. (Medical weight loss alongside real aesthetics is fine
— it's "only wellness, nothing aesthetic" that excludes.)

## Critical: the old reason is a hypothesis to FALSIFY

Each domain comes with the reason it was excluded last time. **Do not defer to
it.** It was written under the narrow criteria and is often wrong. Two known
examples: `calhounhealthandspine.com` was called "not a medspa" but lists
aesthetic services at `/our-services/`; `drgrossman.com` was called "surgical
plastic-surgery practice only" — which is now an INCLUDE, and it also has
`/facial-procedures/`.

## How to gather evidence

Work from `/Users/devsharma/Developer/medspa-map/web`. For each domain:

```bash
cd /Users/devsharma/Developer/medspa-map/web
R=reports/retriage-2026-07-29
# Page list already harvested (may be absent):
cat $R/digests/<domain>/paths.txt      # sitemap paths, one per line
# Fetch a digest — pass up to 9 paths; more than 9 are IGNORED (hard cap):
bun scripts/scrape-digest.ts https://<domain>/ <p1> ... <p9> \
  > $R/digests/<domain>/pass1.txt 2>&1
```

Choose paths from `paths.txt` matching:
`service|treatment|procedure|menu|price|about|team|staff|provider|contact|
aesthetic|injectable|botox|filler|laser|skin|facial|nail|spa|course|training|enroll`

**Include the training/course paths when they exist** — "this is only a school" is
only credible if you actually looked at the course pages. If `paths.txt` is missing
or empty, run `scrape-digest.ts` with **no extra paths** and let its own nav
auto-discovery pick pages.

If a page you need isn't in the digest, run a second `scrape-digest` invocation
with different paths, appending to `pass2.txt`. Read the digest files you produce.

## Verdict file

Write exactly one JSON object per domain to
`reports/retriage-2026-07-29/verdicts/<domain>.json`:

```json
{
  "schema_version": 1,
  "domain": "calhounhealthandspine.com",
  "classified_by": "classify-agent",
  "probe": {
    "pages_read": ["/", "/our-services/"],
    "sitemap_source": "paths.txt",
    "total_text_chars": 11840,
    "digest_files": ["digests/calhounhealthandspine.com/pass1.txt"]
  },
  "verdict": "INCLUDE",
  "confidence": "high",
  "business_kind": "other_medical_plus_aesthetics",
  "clinic_type": "wellness_plus_aesthetics",
  "exclusion_reason_code": null,
  "aesthetic_evidence": [
    { "service_name_on_page": "Botox", "kind": "injectable",
      "page_path": "/our-services/",
      "quote": "Botox and dermal filler treatments are offered in our aesthetics suite" }
  ],
  "patient_facing": {
    "sells_to": "patients", "has_public_booking": true,
    "phone": "706-555-0142", "address_seen": "123 Main St, Calhoun, GA 30701"
  },
  "counter_evidence": [],
  "prior_reason_rebuttal": "Prior verdict said 'not a medspa'; /our-services/ lists Botox and fillers.",
  "proposed_markdown_reason": null,
  "extract_hints": {
    "service_pages": ["/our-services/"], "team_page": "/about/",
    "locations_page": "/contact/", "gallery_page": null,
    "est_extract_effort": "small"
  }
}
```

Enums:
- `verdict`: `INCLUDE` | `EXCLUDE` | `UNRESOLVED`
- `confidence`: `high` | `medium` | `low`
- `business_kind`: `full_medspa` | `plastic_surgery` | `cosmetic_derm` |
  `dental_aesthetics` | `day_spa_or_salon` | `wellness_plus_aesthetics` |
  `other_medical_plus_aesthetics` | `training_academy` |
  `training_academy_with_clinic` | `association_or_conference` |
  `non_clinic_business` | `dead_or_placeholder`
- `clinic_type` (only when INCLUDE): `medspa` | `plastic_surgery` |
  `cosmetic_derm` | `dental_aesthetics` | `day_spa_salon` |
  `wellness_plus_aesthetics` | `other_medical_plus_aesthetics`
- `exclusion_reason_code` (required iff EXCLUDE): one of the EXCLUDE codes above
- `unresolved_code` (required iff UNRESOLVED): `FETCH_BLOCKED` |
  `JS_ONLY_NO_CONTENT` | `AMBIGUOUS_ACADEMY` | `POSSIBLE_DUPLICATE`
- `proposed_markdown_reason`: one clear sentence, required iff EXCLUDE; written
  against the NEW criteria. Never write "not a medspa" for something you couldn't
  fetch.

## Hard rules — these are checked mechanically afterwards

1. **Every `quote` must be a verbatim contiguous substring of one of your digest
   files.** They are grep-verified with `grep -F`. Do not paraphrase, do not fix
   typos, do not join text across a gap. A quote that fails this check invalidates
   the whole verdict.
2. **INCLUDE requires ≥1 `aesthetic_evidence` entry** with a named service, a
   `page_path`, and a quote. If you cannot produce one, the verdict is
   `UNRESOLVED` — never INCLUDE.
3. **`NO_AESTHETIC_SERVICES` may never rest on the homepage alone.** `pages_read`
   must include at least one services/procedures/menu page, or you must state in
   `prior_reason_rebuttal` that the sitemap contained none.
4. **Never EXCLUDE with `confidence: "low"`** — that is `UNRESOLVED`.
5. **Training academy vs academy-with-clinic.** INCLUDE only if ≥1 page's primary
   audience is **patients** and lists a service the general public can book. If
   the only patient treatments are "model calls" / "student clinic" / discounted
   training days, use `business_kind: training_academy_with_clinic`,
   `verdict: UNRESOLVED`, `unresolved_code: AMBIGUOUS_ACADEMY`. Do not decide that
   case yourself — it is a policy call.
6. **If the candidate is a subdomain** (e.g. `courses.example.com`), also probe the
   apex (`example.com`) — the apex is often the patient clinic while the subdomain
   is the course platform.
7. **Site blocked or JS-only?** If every fetch fails or all pages together yield
   <200 chars of text, use `UNRESOLVED` with `FETCH_BLOCKED` or
   `JS_ONLY_NO_CONTENT`. **Do not** call it "not a medspa" — you did not see it.
8. Write the verdict file even when the answer is EXCLUDE. One file per domain.

## Report back

Return a compact table: domain → verdict → business_kind → one-line reason, then
note any domain you found genuinely ambiguous and why. Keep it under 250 words.
