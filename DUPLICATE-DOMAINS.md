# Alternate-domain duplicates — not added (already in our DB under another domain)

G99 lists the same medical-spa business under multiple website domains. When a
candidate domain's real business already exists in our DB under a different domain, we
skip it to avoid duplicate clinics. Kept as a record.

**Re-triaged 2026-07-29.** 37 domains previously listed here were re-checked under the
broadened criteria (any aesthetic service qualifies — including plastic surgery and
day spa / nail salon). They were never really alternate domains: this file's second
table had been used as a catch-all, so the export script stamped every row in it
"Duplicate of: <business name>". Of those 37, **6 are now live clinics** and 31 are
genuine exclusions that now carry an accurate reason in `SKIPPED-CLINICS.md`. Evidence
per domain: `web/reports/retriage-2026-07-29/`.

Only put a row here if the business really is already in the DB under another domain.
Anything else belongs in `SKIPPED-CLINICS.md` — the export script reads this file's
second column as the thing the candidate "is a duplicate of", so a non-duplicate here
produces a nonsense reason.

| Candidate domain (G99) | Resolves to (already in DB) |
|---|---|
| essenceskinclinic.com | essenceskinclinic.com — Essence Skin Clinic |
| vibe-aesthetics.com | vibe-aesthetics.com — VIBE Aesthetics and Wellness |
| aereaesthetics.com | aereaesthetics.com — Aère Aesthetics |
| beautyrefined.com | beautyrefined.com — Beauty Refined |
| skinhavenclinic.com | skinhavenclinic.com — Skin Haven Clinic |
| ravamedical.com | ravamedical.com — Rava Medical |
| coastalglo.com | coastalglo.com — Coastal Glo Med Spa |
| thedistrictclinics.com | thedistrictclinics.com — The District |
| reclaimmedspastl.com | reclaimmedspastl.com — Reclaim Med Spa |
| lushwellnessco.com | lushwellnessco.com — Lush Lifestyle Medicine |
| balancedmedicalspa.com | balancedmedicalspa.com — Balanced Wellness Medical Spa |
| emmeskinstudio.com | emmeskinstudio.com — EMME Skin Studio |
| dermcollectivenorthshore.com | dermcollectivenorthshore.com — The Derm Collective North Shore |
| occosmeticandvein.com | occosmeticandvein.com — OC Cosmetic and Vein Center |
| cachevalleyent.com | cvfacialplastics.com — Cache Valley Facial Plastics. The ENT site's aesthetic offering IS that practice: both share phone 435-753-7880, and Cache Valley Facial Plastics is already in the directory with its Logan and Providence, UT locations. Adding this domain would duplicate the same business. |

## Residual G99 entries not added (final reconciliation)

Older catch-all list, kept for provenance. Do NOT add to it — anything not a true
alternate domain goes in `SKIPPED-CLINICS.md`.

| G99 domain | Business name |
|---|---|
| ravaaesthetics.com | RAVA Medical |
| reclaimmensclinic.com | Reclaim Med Spa and Wellness |
| beautyrefined.co | Beauty Refined |
| thebeautypa.com | Aere Aesthetics |
| lushaestheticswellness.com | Lush Aesthetics & Wellness |
| essencemedspa.com | Essence Med Spa |
| coastalglo.net | Coastal Glo |
| aesthetic-district.com | The District |
| skinhavenclinic.co | Skin Haven Cosmetic Clinic |
| self-aesthetics.com | Self Aesthetics, PLLC |
| ocveins.com | OC Cosmetic and Vein Center |
| suite101medicalspa.com | Suite 101 Medical Spa |
| emmeskinclinic.com | EMME SKIN STUDIO |
| thedermcollectivenorthshore.com | Derm Collective North Shore |
| dpmedspa.com | deltaphoenix.org — Delta Phoenix Medical Aesthetics (G99 row said Memphis, TN; that location is present) |
| thespa.aestique.com | aestiquemedispa.com — Aestique Medispa (G99 row said Wexford; the site lists that branch at 101 Fowler Road, Warrendale, PA 15086, which is the location we hold) |
| timelessmedspa.com | timelessut.com — Timeless Skin and Wellness (G99 row said North Logan; that location is present) |
| yourrenaissancemedspa.com | penplasticsurgery.com — Peninsula Plastic Surgery (redirects to the /renaissance-medical-spa/ page on the parent site; G99 row said Renaissance Med Spa Salisbury, and the Salisbury, MD location is present) |
