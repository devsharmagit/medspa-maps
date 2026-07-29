# Extraction brief — build a save-ready payload per clinic

You are extracting structured data for clinics that have already been verified as
belonging in the directory. Work from `/Users/devsharma/Developer/medspa-map/web`.

For each assigned domain you produce ONE JSON file at
`reports/retriage-2026-07-29/payloads/_staging/<domain>.json`.

## Step 1 — read what already exists

```bash
R=reports/retriage-2026-07-29
cat $R/verdicts/<domain>.json          # the classification: clinic_type + extract_hints
cat $R/digests/<domain>/paths.txt      # sitemap paths (may be absent)
ls  $R/digests/<domain>/               # digests already fetched during classification
```

`verdicts/<domain>.json` gives you `clinic_type` (copy it verbatim into the
payload) and `extract_hints` (service/team/locations/gallery pages worth reading).

## Step 2 — fetch more pages

`scrape-digest.ts` accepts at most **9 extra paths per invocation** (a hard cap —
extras beyond 9 are silently dropped), so use several invocations:

```bash
bun scripts/scrape-digest.ts https://<domain>/ /p1 ... /p9 > $R/digests/<domain>/pass2.txt 2>&1
bun scripts/scrape-digest.ts https://<domain>/ /p10 ... /p18 > $R/digests/<domain>/pass3.txt 2>&1
```

Priority order: services/procedures index → each service or procedure page →
about → team/providers → contact/locations → before-after or gallery → pricing.
Budget by `est_extract_effort`: small ≈ 20 pages, medium ≈ 30, large ≈ 50. Stop at
50; further pages add gallery noise, not treatments.

## Step 3 — the payload

```json
{
  "website": "https://<THE CANDIDATE DOMAIN>/",
  "name": "Clinic Name",
  "clinic_type": "<copy from the verdict>",
  "tagline": "one-line positioning from the site, or null",
  "about": "2-4 sentences in the site's own words, or null",
  "phone": "(555) 123-4567",
  "email": "info@example.com",
  "booking_url": "https://...",
  "socials": {"instagram":null,"facebook":null,"tiktok":null,"youtube":null,"x":null,"linkedin":null,"yelp":null},
  "hours": "verbatim opening-hours text if stated, else null",
  "locations": [{"address":"street incl suite","city":"...","state":"TX","zip":"...","phone":"..."}],
  "providers": [{"name":"...","title":"credentials/role","image_url":null,"is_owner":false}],
  "treatments": [{"raw_name":"Face Lift","general_name":"Facelift"}],
  "concerns": ["Fine Lines","Acne"],
  "images": {"logo":null,"cover":null,"gallery":[],"before_after":[]}
}
```

### `website` — use the CANDIDATE domain, not the final redirect target

Two things break otherwise: the report only clears a row when `clinics.website`
host equals the harvested G99 domain exactly, and the G99 clinic/business/tenant
ids are attached by looking that domain up. `www.` is fine (it gets stripped);
a different TLD or subdomain is not.

**Exception:** if the candidate 301s to a *different domain of the same business*
(your verdict will say so), still use the candidate domain here.

### `treatments` — THE MOST IMPORTANT RULE

Every entry must be an **object** `{"raw_name": ..., "general_name": ...}`.
**Plain strings are forbidden.** They are syntactically accepted and then silently
mint a new catalog row per variant.

- `raw_name` — what the site calls it, cleaned up (keep brands and ®).
- `general_name` — **copied byte-for-byte from
  `reports/retriage-2026-07-29/catalog/allowlist-services.txt`** (352 names).

Matching is by normalized name (lowercase, punctuation → space), so casing and
punctuation are forgiving but **wording is not**. Worked examples:

| raw_name on the site | correct general_name | why |
|---|---|---|
| `Face Lift` | `Facelift` | "face lift" ≠ "facelift" — would create a new row |
| `Cheek Lift` | `Midface/Cheek Lift` | the existing row's exact name |
| `Tummy Tuck` | `Abdominoplasty` | the catalog's name for it |
| `Signature Facial` | `Facials` | note the plural — "Facial" ≠ "Facials" |
| `Gel Mani` | `Gel Manicure` | |
| `Semaglutide Program` | `Medical Weight Loss` | |

**`BBL` is a trap.** In this catalog `BBL` means Sciton BroadBand Light (a laser).
On a plastic-surgery site BBL means Brazilian Butt Lift — use
`Brazilian Butt Lift (BBL)` for the surgery, never bare `BBL`.

If nothing in the allowlist fits, put the site's wording in `raw_name`, your best
generic phrasing in `general_name`, and **also** list that pair in a top-level
`"new_general_names": [{"general_name":"...","why":"..."}]` array.
**Budget: at most 3 new names per clinic.** More than 5 and the payload is
rejected.

Do NOT include: nav/CTA chrome ("Book Now", "Learn More"), anything with a colon,
memberships/financing/gift cards, blog titles, staff names, lab tests or body
scans, or names under 3 / over 60 characters. These are dropped anyway.

### `concerns` — plain strings

Prefer exact names from `catalog/allowlist-concerns.txt` (210 names). A concern is
the **patient's problem**, never the procedure or the goal: ≤4 words, Title Case,
one per entry. `Brow Lift` → `Drooping Brows`; `Breast Augmentation` →
`Small Breasts`; `Tummy Tuck` → `Excess Abdominal Skin`; `Skin Brightening` →
`Hyperpigmentation`. Never end one in augmentation/enhancement/contouring/
tightening/therapy/relief — those are auto-rejected.

**Nail salons and pure day spas: leave `concerns` as `[]`.** The concern taxonomy
drives medical condition search; nail/spa concerns do not belong in it.

### Images — every URL must be real

Every image URL must appear **verbatim** in one of your digest files (an `IMAGES:`,
`OG_IMAGE:` or `TEXT:` line). Never construct or guess one. They are all probed
for reachability at save time and dead ones are dropped.

- `cover` — a real WIDE photograph (clinic, treatment, team). **Never** the logo, a
  wordmark, a social-share card, a badge, or a financing graphic. If no genuine
  wide photo exists, use `null`; a clean placeholder beats a logo in the hero.
- `gallery` — up to 5 real photos, no logos/icons/duplicates of the cover.
- `before_after` — only genuine before-and-after composites, and never a URL also
  used in cover or gallery. If unsure, use `[]`.
- provider `image_url` — that person's headshot, matched by name; `null` if unsure.

### Other fields

- `email`: never `seo.loginuser@growth99.com` or `onboarding.india@growth99.com`
  (G99 platform placeholders). Prefer a general inbox over a named staff member.
- `locations`: real street address, city, 2-letter `state`, zip, per-location phone.
  Multiple locations → one entry each, never the same address twice.
- `providers`: real staff only. `title` prefers the clinical designation
  ("MD, FACS", "PA-C", "APRN", "Licensed Esthetician"). `is_owner: true` only for a
  clear owner/founder the site actually names as such. Max 10 are saved.
- `hours`: verbatim text is fine — day ranges are parsed and expanded downstream.

## Step 4 — self-check before you finish

1. `treatments` — every entry an object with a `general_name`?
2. Every `general_name` present in `allowlist-services.txt` (grep it), or declared
   in `new_general_names` (≤3)?
3. Every image/headshot URL greppable in a digest file?
4. `website` host == the candidate domain?
5. `clinic_type` copied from the verdict?
6. Valid JSON, written to `payloads/_staging/<domain>.json`?

## Report back

Per domain: counts (treatments / concerns / locations / providers / images), any
`new_general_names` you declared and why, anything you deliberately left out, and
anything ambiguous. Under 120 words per domain.
