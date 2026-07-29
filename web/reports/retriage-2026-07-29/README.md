# Re-triage run — 2026-07-29

Audit trail for the re-check of 74 previously-excluded G99 websites under
**broadened criteria**: a site qualifies if it offers **any** aesthetic service —
full medspa, plastic surgery, cosmetic dermatology, or a day spa / nail salon
doing manicure-pedicure. Wellness-only clinics (hormones, weight loss, IV) do not
qualify, and **dentistry is out of scope**.

**Outcome: 21 of the 74 were false positives** under the old narrow rule.
14 are now live clinics, 1 is held back on geography, and 59 remain excluded with
a rewritten reason.

## What is here

| Path | What it is |
|---|---|
| `CLASSIFY-BRIEF.md` | the contract each classification sub-agent worked to |
| `EXTRACT-BRIEF.md` | the payload contract for extraction, incl. the `general_name` allowlist rule |
| `candidates.tsv` | the 74 pinned candidates with their old exclusion reason |
| `preflight/` | redirect probe, host-level and phone-level duplicate gates, sitemap counts |
| `verdicts/*.json` | one machine-checked verdict per domain — verdict, reason code, evidence quotes, rebuttal of the old reason |
| `verdicts/_index.tsv` | flat summary of all 74 verdicts |
| `waves/` | how domains were batched across sub-agents |
| `payloads/wave-*/` | the exact payloads that were saved |
| `payloads/_holdback/` | `niloura.com` — a real medspa in Ontario, complete payload, not saved (US-only directory) |
| `saved/` | `save-clinic-json.ts` output per wave |
| `verify/` | `verify-clinic.ts` output per wave (images re-fetched live, flags) |
| `catalog/` | catalog baselines before/after, and the closed `general_name` allowlists |
| `gate.sh` | the mechanical checks — run it to re-audit the verdicts |

## What is deliberately NOT here

**`digests/`** — the raw scraped page text (~2.7 MB across 74 sites) that the
sub-agents read. Dropped because it is third-party page content and fully
regenerable, and because every quote it justified was copied into the verdict
files. Regenerate for a domain with:

```bash
cd web
bun scripts/scrape-digest.ts https://<domain>/ <up to 9 paths> \
  > reports/retriage-2026-07-29/digests/<domain>/pass1.txt
```

Note `gate.sh`'s quote verification greps those files, so it reports quotes as
unverifiable until the digests are regenerated. That is expected — the quotes were
verified at the time (0 failures across 74 verdicts).

**`backup/`** — two `pg_dump` snapshots taken before the ingest and before the
dentistry purge (13 MB). Kept outside the repo at `~/Developer/medspa-map-backups/`.

## Reproducing

The three scripts this run relies on are committed and reusable:
`scripts/scrape-digest.ts` (fetch, no AI), `scripts/validate-payload.ts` (hard
gates before a payload nears the DB), `scripts/save-clinic-json.ts` (`--dry` shows
EXACT / WOULD-CREATE / NOISE-DROP per treatment), `scripts/verify-clinic.ts`
(read-only audit, re-fetches every image).

Schema/data changes are recorded as dated SQL in `web/scripts/`:
`2026-07-29-add-clinic-type.sql`, `2026-07-29-catalog-prep-surgical-spa.sql`,
`2026-07-29-remove-dentistry.sql`.
