# Ingestion pipeline — known defects to fix

Written **2026-09-06**, during the catalog reduction (1082 services / 210
concerns → 19 core treatments + 14 core concerns).

The reduction was triggered by users getting "0 Practices Found". While mapping
the data I found that the coverage numbers are **artefacts of how the extractor
works, not facts about the market**. That distinction matters: it means the
right fix is in the pipeline, and the current reduction+backfill is treating a
symptom.

Everything below was verified against the live database and the source, not
inferred. Numbers are as of 2026-09-06: 632 active clinics, 966 active services,
191 active concerns, 7,370 active `clinic_services` rows, 13,407
`clinic_concerns` rows.

---

## 1. Neurotoxin concerns get a deterministic path; nothing else does

**This is the biggest defect.** It is why searching *Acne Scarring* near zip
84117 returns nothing while 14 of the 18 clinics in that radius all claim to
treat Bunny Lines.

`src/lib/ingest/ingest-treatments-concerns.ts:457` defines
`NEUROTOXIN_TREATMENT_AREAS` — a hardcoded list of 11 concerns (Forehead Lines,
Frown Lines, Crow's Feet, Bunny Lines, Dimpled Chin, Scowl Lines, Drooping Brows,
Thin Lips, Platysma, Hyperhidrosis, Masseter). `deterministicNeurotoxinConcerns()`
at line 476 scans any page matching `NEUROTOXIN_PAGE_RE` and **emits every regex
hit directly — no AI call, no treatment pairing, no evidence gate.**

Every other concern — Acne, Acne Scars, Melasma, Rosacea, Hair Loss — has no
such path. It exists only if the AI happened to read a dedicated concern page.
And `ingest-treatments-concerns.ts:263` budgets **`concernPages: 8`** against
**`servicePages: 110`**.

The effect, measured:

| group | catalog rows | clinic links | links per row |
|---|---|---|---|
| the 11 deterministic neurotoxin concerns | 11 | 4,470 | **406** |
| every other active concern | 180 | 8,925 | **50** |

Eleven rows — 5.8% of the concern catalog — carry **33% of all concern links**,
at **8× the attachment rate** of everything else. That is not clinical reality.
It is a regex firing on the one page type we always fetch.

**Fix.** Either give the other high-volume concerns the same deterministic
treatment (a concern-keyword table applied to every page, not just neurotoxin
pages), or delete the shortcut so all concerns compete on the same evidence.
Raise `concernPages` well above 8 either way — 110 service pages against 8
concern pages guarantees this skew regardless of which option is chosen.

**Second-order effect:** because these 11 concerns attach to ~530 clinics each,
they dominate every "popular concerns" ranking, the chatbot's context block, and
the skin-navigator's co-occurrence associations in `skin-navigator/associations.ts`.
Fixing the extractor will move all of those.

---

## 2. Sub-treatments inside a parent page are never extracted

**Lip Fillers sits at 41 clinics (6%) while Dermal Fillers sits at 494 (78%).**
Essentially every clinic injecting filler offers lip filler; almost none of them
list it as a top-level menu item. It is a bullet on the Dermal Fillers page, and
the extractor emits **page-level treatment names only**, so it never appears.

The same shape will be hiding Chin Filler, Cheek Filler, Tear Trough, Jawline
Contouring, and Lip Flip.

**Fix.** When a page is confidently about a parent treatment, extract the
sub-treatments named in its body as well, gated on a closed list so this doesn't
become a new fragmentation source (see defect 3).

**Note on a wrong hypothesis, so nobody re-runs it:** the `dermal-fillers` entry
in `src/lib/taxonomy/canonical.ts:100` *does* list `"lip filler"` and
`"lip fillers"` as aliases, which looks like the obvious culprit. It isn't — only
3 rows were actually collapsed that way. `saveClinicServices` resolves the AI's
`general_name` **before** it reaches `matchService()`, so the alias rarely fires.
The alias is still wrong and should be removed (an alias must never be a term
that is itself a catalog entry — worth an assertion in `validate-payload.ts`),
but removing it alone would not have moved the number.

---

## 3. The catalog fragments; dedupe never catches up

**701 of ~1,050 linked service rows are attached to exactly one clinic.**

The lip family alone is 14 separate rows, every one `origin='ai'`:

```
Lip Filler(23)  Lip Flip(6)  Lip Lift(4)  Lip Enhancement(3)  Lip Augmentation(3)
Lip Injections(2)  Lip Flip Filler(1)  Lip Treatment(1)  Lip Blush Tattoo(1)
Laser Lip Rejuvenation(1)  LipLase by Fotona(1)  Men Lip Flip with PLLA or Botox(1) …
```

Cause is documented in the repo already, in the header of
`scripts/2026-07-29-catalog-prep-surgical-spa.sql`: `saveClinicServices` resolves
a public treatment by **normalized exact name** on `general_name`, else it
**creates a row**. There is no fuzzy step on that path. So every spelling variant
mints a new catalog entry, and searches split across them.

`scripts/dedupe-services.ts` fixes this after the fact, but its curated synonym
clusters are hand-maintained and clearly don't cover lips — which is exactly the
problem with an after-the-fact fix.

**Fix.** Put a fuzzy step on the `general_name` path (the machinery already
exists — `bestCatalogMatch` at `canonical.ts:1013`), and require an explicit
declaration before minting a new catalog row. `validate-payload.ts` gate H3
already caps `new_general_names` at 5 for the payload path; the AI path has no
equivalent ceiling.

---

## 4. `clinic_concerns` throws away the scraped string

`clinic_services` keeps `raw_name` — the verbatim text from the clinic's site.
`clinic_concerns` has no such column: the scraped string is discarded at ingest
and only the resolved catalog id survives.

That is why the 2026-09-06 reduction could re-point every treatment link
reversibly but had to merge concern links destructively, and why there is no way
to audit *why* a clinic was tagged with a concern after the fact.

**Fix.** Add `clinic_concerns.raw_name` and `source_url`, mirroring
`clinic_services`. Cheap, additive, and it makes concern data auditable.

---

## 5. Run-to-run extraction variance

Already recorded elsewhere but repeated here because it interacts with all of the
above: `cienegaspa.com` produced 86 services on one run and 62 on the next with
an unchanged site. `temperature: 0` plus the per-domain `domainSeed()` in
`src/lib/ai/anthropic.ts` reduces this but does not remove it. The real fix is a
confirm-across-two-runs rule before a removal is written to
`clinic_catalog_changes`.

---

## 6. The rescrape cron will erode the reduced catalog

Not a pre-existing bug, but a direct consequence of the 2026-09-06 reduction.

`ingestTreatmentsAndConcernsForClinic` mints new `services` / `concerns` rows
with `origin='ai'` and `is_active=true`. The reduction expresses "not part of the
public taxonomy" as `is_active=false`. So every cron pass re-introduces non-core
rows into search, and re-points clinic links away from the core terms.

**Before the cron next runs it needs a closed-catalog mode**: resolve to an
existing core row or drop, never create. `CRON_SCHEDULE` defaults to monthly
(`0 3 1 * *`) — that is the deadline.

---

### FIXED 2026-09-06 — `src/lib/taxonomy/catalog-policy.ts`

The ingest path now runs CLOSED by default: a scraped name resolves onto a row
that is already active, or it is dropped. The three creation sites are gated —
`saveClinicServices` (clinic-save.ts), `resolveConcernRow`
(ingest-treatments-concerns.ts) and the CLI bulk-add (scripts/save-clinic-json.ts).

Dropping is the last resort, not the first. Before giving up on a name the
resolvers consult `LEGACY_TREATMENT_REDIRECT` / `LEGACY_CONCERN_REDIRECT`, so
"Morpheus8" still lands on RF Microneedling and "Hyperpigmentation" on
Pigmentation. Every matcher that was already in the chain — curated aliases,
exact name, fuzzy — was left alone: each one loads its catalog `WHERE is_active`
and so can only ever return a core row.

Two related erosions were fixed at the same time:

- `saveClinicServices(overwrite)` hard-deleted every `clinic_services` row for
  the clinic, including the website-verified backfill's `"<Core Name> (verified)"`
  rows. The DELETE now excludes them.
- The `clinic_concerns` upsert converted a surviving `source='manual'` row to
  `'scraped'` whenever the crawl re-detected that concern, and the NEXT refresh's
  DELETE then took it. That two-pass erosion defeated the whole reason
  apply-verdicts.ts writes `'manual'`; the ON CONFLICT guard now excludes it.

`CATALOG_POLICY=open` restores the old grow-on-demand behaviour for a deliberate,
reviewed catalog expansion. It is per-process and off by default.

Guarded by `scripts/test-refresh-e2e.ts` (checks 4-6, no network and no AI).
Run under `CATALOG_POLICY=open` to watch it fail: the catalog drifts 19 -> 21
services and 14 -> 15 concerns in a single pass.

---

## Suggested order

1. ~~**Defect 6** — closed-catalog gate on the cron.~~ **DONE 2026-09-06.**
2. **Defect 1** — concern extraction fairness. Largest data-quality win.
3. **Defect 3** — fuzzy `general_name` matching + a mint ceiling. Stops the bleed.
4. **Defect 2** — sub-treatment extraction. Needs 3 in place first.
5. **Defects 4 and 5** — auditability and stability.

## Related

- `web/reports/catalog-reduction-2026-09-06/` — the reduction run, its archive,
  and the website-verified backfill that works around defects 1 and 2.
- `ai-extraction-treatments-concerns.md` — accurate description of the current
  pipeline. Note `ARCHITECTURE.md` is **stale**: it describes an Anthropic +
  OpenRouter setup with `claude-haiku-4-5` that no longer exists. The ingest path
  is OpenAI-only, and `src/lib/ai/anthropic.ts` is a misleadingly-named OpenAI
  dispatcher.

---

## Appendix — what the 2026-09-06 website re-read actually found

The catalog reduction included re-reading all 632 clinic websites from scratch
(`web/scripts/fetch-clinic-pages.ts`, no AI, no ingest-pipeline code). Comparing
that read against what the pipeline had stored is the clearest available measure
of the defects above.

Coverage, as a share of the 632 active clinics — pipeline data on the left, what
the clinics' own sites say on the right:

| target | in the DB | site says | |
|---|---|---|---|
| Acne | 16% | **72%** | defect 1 |
| IPL / Photofacial | 14% | **53%** | defect 3 |
| Dysport | 30% | **51%** | defect 3 |
| Acne Scars | 26% | **45%** | defect 1 |
| Hair Restoration | 20% | **45%** | defect 3 |
| RF Microneedling | 22% | **45%** | defect 3 |
| Lip Fillers | 5% | **32%** | defect 2 |
| Melasma | 10% | 11% | genuinely uncommon |

Melasma is the control: it barely moves, which is what a real signal looks like.
Everything else moving by 2-4x is the pipeline, not the market.

**The single highest-value change to make** is not in the extractor at all — it
is capturing the site's own **navigation menu** as a distinct field. The re-read
stores it as a `SITE MENU:` line, and it alone decides most targets: a clinic
that lists something in its nav is asserting it offers it, which is stronger
evidence than any amount of body prose. `htmlToText` currently strips `<nav>`
before the AI ever sees it.

Also worth taking from that run:
- Device and brand names are how sites actually name services — Morpheus8,
  CoolSculpting, Fotona, Procell, Alma, Sciton, "1540 resurfacing laser". Bare
  brand names are unambiguous in a menu and meaningless in prose; treat the two
  positions differently.
- Spelling variants defeat exact matching: "Hydrofacial", "Weight Loss
  Management" vs "Medical Weight Loss", "Procell Microchanneling" for
  microneedling.
- Some sites are training academies. Their "Botox" is a course name, not a
  patient service. The classifier needs to notice a curriculum.

---

## Appendix 2 — three matching bugs the agent pass exposed

The 2026-09-06 run used a cheap deterministic sweep first and sent only the
undecided cells to an agent. The agents kept overturning the sweep's
"no mention found" verdicts, and the reasons generalise to any keyword matcher
run over scraped page text — including the ingest pipeline's own.

**1. Stripped markup concatenates words, defeating `\b` anchors.** A chemical
peels page rendered as `For Skin Concerns:Sun DamageMelasmaPost-Inflammatory
Hyperpigmentation (PIH)`. `\bmelasma\b` does not match `DamageMelasma`, so the
concern was reported absent on a page that lists it explicitly. Any list, table
or badge row collapses this way once tags are removed. **Fix:** insert a
separator when stripping block-level and list elements, or match without word
boundaries on a separately-normalised copy.

**2. Sites use the short name; catalogs use the long one.** `Weight Loss` in a
nav menu never matches `medical weight loss`. Same for `Leg Vein Removal` vs
`veins`, `Hair Reduction` vs `laser hair removal`, `Weight Loss Management`,
`Hydrofacial`, `Procell Microchanneling`. **Fix:** match the head noun, and
treat a nav position as strong enough to accept a shorter phrase.

**3. Generic drug names are invisible.** One site's whole neurotoxin offer was
`Neurotoxins (OnabotulinumtoxinA, AbobotulinumtoxinA, IncobotulinumtoxinA)` —
that is Botox, Dysport and Xeomin, and a brand-name matcher sees none of them.
Likewise `Poly-L-Lactic Acid (Biostimulatory Filler)` is Sculptra. **Fix:** add
INN/generic names alongside brands in every alias list.

The inverse error is rarer but real: a phantom hit where the matched word
belongs to something else entirely. `laser skin resurfacing` matched a page
whose only "resurfac" was CO2RE Intima (a vaginal laser); `skin laxity` matched
`vaginal laxity`; `hydrafacial` matched AI-written boilerplate on a location
page that also advertised CoolSculpting, which appears nowhere in that clinic's
~80-item menu.

**The takeaway for the pipeline**: a deterministic matcher is the right first
pass — it settled roughly two-thirds of the 20,856 cells for free — but its
negatives are much weaker than its positives, and only a reader that can weigh
context should be allowed to turn "no keyword found" into "does not offer".
