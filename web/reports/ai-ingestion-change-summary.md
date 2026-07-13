# AI Ingestion Change Summary

Generated: 2026-07-13

This is the compact handoff report for the treatment + concern ingestion work. It covers what changed, what was inserted into the database, how the verification was done, and how to reuse the workflow for other clinics.

## Goal

Make clinic data accurate enough for public search:

- Store real clinic treatments/services from the website.
- Avoid public labels that are clinic-only branding or junk navigation.
- Store raw, specific concern names when the website explicitly says the clinic treats them.
- Keep concern evidence per clinic and per treatment page.
- Make broad concern searches, such as `Wrinkles & Fine Lines`, also return clinics that treat specific child concerns like `Forehead Lines`, `Bunny Lines`, `Crow's Feet`, and `Frown Lines`.
- Fully ingest the six requested Growth99 clinics and mark them featured.

## Policy Decisions Implemented

- Brand/device names can be searchable services when they are real market-recognized offerings.
- Clinic-owned names should not become public treatment labels unless they are also real public offerings.
- Raw concern names should be stored as concerns instead of collapsing everything into broad buckets.
- A concern must be supported by a live page quote.
- Side effects, warnings, complications, generic symptoms, and unrelated medical noise are rejected.
- Dentistry/dental services are excluded from public medspa treatment search.

## AI Provider Changes

Files:

- `web/src/lib/ai/openai.ts`
- `web/src/lib/ai/anthropic.ts`

Changes:

- Added OpenAI backend to the existing `extractViaTool` abstraction.
- Route with `INGEST_PROVIDER=openai`.
- Uses `OPENAI_API_KEY`.
- Uses `OPENAI_MODEL`, defaulting to `gpt-4o-mini`.
- Kept the same forced-tool/structured contract used by the Anthropic/Gemini path.
- Optimized token use by sending stripped page text, discovered service pages, and known catalog entries instead of screenshots/images for treatment and concern extraction.

## Treatment Ingestion Changes

Relevant files:

- `web/src/lib/ingest/ai-extract.ts`
- `web/src/lib/ingest/discover.ts`
- `web/src/lib/ingest/ingest-clinic.ts`
- `web/src/lib/scraper/services.ts`
- `web/src/lib/taxonomy/canonical.ts`
- `web/src/app/api/services/route.ts`
- `web/src/app/api/search/route.ts`

Implemented behavior:

- Extract service links from navigation and service pages.
- Preserve:
  - `raw_name`
  - `source_url`
  - site category
  - public decision: `public`, `alias_only`, or `ignored`
  - canonical/public service name
- Add missing public service catalog rows when a clinic has real searchable offerings.
- Keep raw names searchable through aliases where appropriate.
- Hide ignored/junk/dental services from public service surfaces.
- Clinic treatment chips show approved public service names.

RUMA example behavior:

- `RUMA Gold Microchannel Treatment` is not exposed as the public treatment label.
- It maps to a generic/public treatment such as `Microneedling`.
- Public offerings like `Botox`, `Dysport`, `Morpheus8`, `MiraDry`, `Hormone Therapy`, `IV Therapy`, and similar services remain searchable.
- `Cosmetic Dentistry` is ignored.

## Concern Ingestion Changes

Relevant files:

- `web/scripts/add-concern-evidence.sql`
- `web/src/lib/ingest/ai-extract-concerns.ts`
- `web/src/lib/ingest/concern-validate.ts`
- `web/src/lib/ingest/ingest-concerns.ts`
- `web/src/lib/concerns/clinic-concerns.ts`
- `web/src/lib/concerns/queries.ts`
- `web/src/app/api/concerns/route.ts`

Implemented behavior:

- AI extracts concerns only from public treatment/service pages.
- Concern rows can grow from raw site language.
- Raw specific concerns are stored instead of being merged into broad categories.
- Evidence is stored per clinic and per treatment:
  - concern name
  - raw phrase
  - source page
  - exact evidence quote
  - paired treatment names
  - paired service IDs
- The validator rejects:
  - quote not present on live page
  - side effect language
  - warning/complication language
  - definition-only text
  - broad generic symptoms not tied to a public service
  - unrelated medical noise

RUMA concern behavior:

- Specific concerns like `Forehead Lines`, `Frown Lines`, `Scowl Lines (11s)`, `Bunny Lines`, `Crow's Feet`, `Brow Lift`, and similar terms can be stored and searched directly.
- They are not force-merged into only `Wrinkles & Fine Lines`.
- Broad search still works through child concern expansion.

## Broad Concern Search Fix

File:

- `web/src/app/api/search/route.ts`

Implemented:

- Added `BROAD_CONCERN_CHILDREN`.
- `condition=fine-lines-wrinkles` expands to:
  - `forehead-lines`
  - `frown-lines`
  - `scowl-lines`
  - `scowl-lines-11s`
  - `crows-feet`
  - `bunny-lines`
  - `brow-lift`
  - `lip-flip`
  - `dimpled-chin`
  - `platysma-vertical-neck-cords`
- Condition search is now evidence-backed:
  - clinic must have an active scraped/manual concern row
  - scraped concern must have evidence
  - removed concerns are excluded

Verified:

```text
/api/search?condition=fine-lines-wrinkles
```

Result included:

```text
ruma-medical
```

## Audit And Repair Tooling

Relevant files:

- `web/scripts/audit-ingest.ts`
- `web/scripts/ingest-concerns.ts`
- `web/scripts/ingest-before-after.ts`
- `web/scripts/add-concern-evidence.sql`

Implemented/used:

- Read-only audit command compares stored services and evidence to live pages.
- Audit verifies that every stored concern evidence quote is present on the live source page.
- Repair workflow:
  - rerun concern extraction for selected domains only
  - remove unverifiable evidence rows
  - remove orphaned scraped concern links
  - refresh `clinic_search_view`

## Database Repairs Performed

Actions:

- Ingested RUMA treatment/concern data.
- Ingested six requested Growth99 clinics.
- Marked all six requested clinics as:
  - `featured = true`
  - `tier = 'featured'`
- Removed 7 unverifiable concern evidence rows after audit.
- Removed 3 orphaned clinic concern links.
- Refreshed `clinic_search_view`.

Important cleanup:

- False Beauty Lab `Lip Flip` evidence rows from unrelated pages were removed.
- GloDerma evidence rows for `Fine Lines` and `Sun Damage` on one Morpheus8 page were removed because exact live quote verification failed.
- DNJ `Skin Elasticity` evidence on IV Therapy was removed because exact live quote verification failed.

## RUMA Result

Report files:

- `web/reports/ruma-treatment-concern-db-report.md`
- `web/reports/ruma-treatment-concern-db-report.json`

Verified behavior:

- RUMA no longer relies only on broad merged concerns.
- Specific raw concerns are available for direct search.
- Broad `Wrinkles & Fine Lines` search includes RUMA through child concern expansion.
- Cosmetic dentistry is excluded.
- Clinic-owned treatment branding is not exposed as the public treatment label.

## Six Growth99 Clinics Ingested

Requested domains:

- `https://gloderma.com/`
- `https://gfacemd.com/`
- `https://drippynursejess.com/`
- `https://www.beautylablaser.com/`
- `https://www.conqraesthetics.com/`
- `https://trubeautybytrevor.com/`

Final database report:

- `web/reports/featured-six-ingest-report.md`
- `web/reports/featured-six-ingest-report.json`

Final counts:

| Clinic | Slug | G99 Clinic | G99 Business | Locations | Providers | Images | Services | Concerns | Evidence Verified |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Beauty Lab + Laser | `beauty-lab-laser` | 597 | 550 | 2 | 0 | 7 | 46 | 24 | 47/47 |
| Conqr Aesthetics & Wellness | `conqr-aesthetics-wellness` | 6017 | 5806 | 1 | 1 | 8 | 16 | 6 | 6/6 |
| DNJ Med Boutique | `dnj-med-boutique` | 4769 | 4535 | 1 | 7 | 9 | 19 | 18 | 27/27 |
| GFaceMD | `gfacemd` | 222 | 210 | 4 | 15 | 10 | 26 | 17 | 20/20 |
| Glo Derma | `glo-derma` | 550 | 503 | 1 | 1 | 20 | 18 | 6 | 6/6 |
| Tru Beauty By Trevor | `tru-beauty-by-trevor` | 2654 | 2542 | 1 | 14 | 7 | 60 | 28 | 49/49 |

Note:

- Beauty Lab + Laser returned 0 provider rows from the available static/AI scrape. Clinic record, locations, images, services, and verified concern evidence were still ingested.

## Final Audit Files

- `web/reports/ingest-audit-gloderma-com-1783936200272.json`
- `web/reports/ingest-audit-gfacemd-com-1783936208364.json`
- `web/reports/ingest-audit-drippynursejess-com-1783936218232.json`
- `web/reports/ingest-audit-beautylablaser-com-1783936233645.json`
- `web/reports/ingest-audit-conqraesthetics-com-1783936241905.json`
- `web/reports/ingest-audit-trubeautybytrevor-com-1783936256157.json`

Each final audit has exact live evidence verification:

- Glo Derma: 6/6
- GFaceMD: 20/20
- DNJ Med Boutique: 27/27
- Beauty Lab + Laser: 47/47
- Conqr Aesthetics & Wellness: 6/6
- Tru Beauty By Trevor: 49/49

## Commands Used

Run concern-only ingest for selected clinics:

```bash
INGEST_PROVIDER=openai bun --env-file=.env scripts/ingest-concerns.ts \
  gloderma.com \
  gfacemd.com \
  drippynursejess.com \
  beautylablaser.com \
  conqraesthetics.com \
  trubeautybytrevor.com
```

Run audit for one clinic:

```bash
bun --env-file=.env scripts/audit-ingest.ts ruma.com
```

Run audits for six clinics:

```bash
for d in gloderma.com gfacemd.com drippynursejess.com beautylablaser.com conqraesthetics.com trubeautybytrevor.com; do
  bun --env-file=.env scripts/audit-ingest.ts "$d"
done
```

Verify TypeScript:

```bash
bunx tsc --noEmit --pretty false
```

## Verification

Compiler:

```text
bunx tsc --noEmit --pretty false
PASS
```

Public search:

```text
/api/search?condition=fine-lines-wrinkles
includes ruma-medical
```

Featured clinic flags:

```text
beauty-lab-laser              featured=true tier=featured
conqr-aesthetics-wellness     featured=true tier=featured
dnj-med-boutique              featured=true tier=featured
gfacemd                       featured=true tier=featured
glo-derma                     featured=true tier=featured
tru-beauty-by-trevor          featured=true tier=featured
```

## Known Follow-Up

- Beauty Lab provider extraction should be revisited if provider/team content is required for that clinic.
- Broad concern parent-child mappings are currently explicit in `web/src/app/api/search/route.ts`; as the concern catalog grows, this should move into a DB-backed synonym/parent-child table.
- Continue using audit before repair for future clinics so unverifiable evidence does not enter the public search surface.

