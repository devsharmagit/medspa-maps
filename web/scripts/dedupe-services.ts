/**
 * scripts/dedupe-services.ts — merge duplicate / near-duplicate services in the
 * catalog WITHOUT losing any clinic data.
 *
 * How "no data loss" is guaranteed:
 *   - clinic_services.service_id FK is ON DELETE SET NULL, and its UNIQUE is on
 *     (clinic_id, raw_name) — NOT service_id. So we can freely UPDATE
 *     clinic_services.service_id from a duplicate row to the canonical row (never
 *     a unique violation), THEN delete the now-orphaned duplicate service.
 *   - Every clinic_services row is preserved (only its service_id is repointed);
 *     the script asserts the clinic_services row-count and null-service_id count
 *     are identical before/after. If not, it rolls back.
 *
 * Grouping = union-find over two signals:
 *   1. AUTO: services whose normalized key collapses (plural / accent /
 *      punctuation / "&" vs "and") — e.g. "Chemical Peel" == "Chemical Peels",
 *      "Juvéderm" == "Juvederm", "HydraFacials" == "HydraFacial".
 *   2. CURATED: explicit synonym clusters into a canonical (usually a seed row) —
 *      e.g. "Botox Injections","Wrinkle Relaxers","Neuromodulators" -> Botox.
 *
 * Canonical (root) selection per group: curated-canonical > seed(origin!='ai')
 *   > most clinic_services > shortest name.
 *
 *   bun scripts/dedupe-services.ts            # PREVIEW (no writes)
 *   bun scripts/dedupe-services.ts --apply    # perform the merges (transaction)
 */
import "dotenv/config";
import pool, { query } from "../src/lib/db";

const APPLY = process.argv.includes("--apply");

// ── CURATED synonym clusters: canonical slug -> variant slugs to fold in ───────
// Only high-confidence synonyms. Brand-specific (Dysport/Jeuveau), anatomic
// (cheek/chin/jawline filler), and named menu items are deliberately LEFT alone.
const CURATED: Record<string, string[]> = {
  botox: [
    "botox-injections", "botox-wrinkle-relaxers", "neurotoxin-botox", "tox",
    "truetox", "specialty-botox", "wrinkle-relaxers", "neuromodulators",
    "neurotoxin", "neurotoxins", "neuromodulators-wrinkle-relaxers",
    "anti-wrinkle-injections-neuromodulators", "wrinkle-relaxers-botoxdysport",
  ],
  "dermal-fillers": [
    "dermal-filler", "dermal-filler-treatment", "dermal-filler-packages",
    "fillers", "filler",
  ],
  "chemical-peels": [
    "chemical-peel", "chemical-peel-treatments", "professional-chemical-peels",
  ],
  hydrafacial: ["hydrafacials"],
  dysport: ["dysport-injections"],
  xeomin: ["xeomin-injections"],
  "vi-peel": ["vi-peels", "vi-peel-treatment"],
  "ipl-photofacial": ["ipl", "ipl-treatment", "ipl-treatments", "intense-pulsed-light-therapy"],
  dermaplaning: ["dermaplane-treatment", "dermaplaning-facial"],
  "prp-prf": [
    "prp", "platelet-rich-plasma", "platelet-rich-plasma-prp", "prp-treatments",
    "prf", "platelet-rich-fibrin-prf", "prf-treatments", "prpprf",
    "prp-prf-treatments", "prp-and-prf-treatments", "prf-prp-treatments",
  ],
  "pdo-threads": [
    "pdo-thread-lift", "pdo-threading", "pdo-threads-lift", "thread-lift", "threads",
  ],
  "medical-weight-loss": [
    "medical-weight-loss-injections", "medical-weight-loss-management",
    "medical-weight-loss-therapy", "medical-weight-loss-treatment",
    "medical-weight-optimization", "weight-loss", "weight-loss-management",
    "weight-loss-management-program", "weight-loss-program",
    "weight-loss-injections", "weight-loss-packages", "weight-loss-consultations",
  ],
  "iv-therapy": [
    "iv-hydration", "iv-hydration-therapy", "iv-infusion-therapy",
    "iv-vitamin-therapy", "iv-vitamin-infusions", "vitamin-iv-therapy",
    "iv-therapy-injections",
  ],
  "vitamin-injections": [
    "vitamin-injection-therapy", "vitamin-b12-injections", "vitamin-b12-shots",
    "vitamin-b-12-injection", "b12-injections", "vitamin-b12-treatments",
    "multivitamin-shots",
  ],
  exosomes: ["exosome-therapy", "exosomes-therapy"],
  morpheus8: ["morpheus8-treatment"],
  "hair-restoration": ["hair-rejuvenation", "hair-regrowth-program"],
};

// normalize: lowercase, strip diacritics, "&"/"and" -> nothing, drop non-alnum,
// strip a single trailing plural 's'. Catches plural/accent/punctuation dups.
function normKey(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\band\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
  return base.endsWith("s") && base.length > 3 ? base.slice(0, -1) : base;
}

interface Svc { id: string; name: string; slug: string; origin: string; clinics: number; }

async function main() {
  const services = await query<Svc>(
    `SELECT s.id, s.name, s.slug, s.origin,
            (SELECT count(*) FROM clinic_services cs WHERE cs.service_id = s.id)::int AS clinics
       FROM services s`);
  const bySlug = new Map(services.map((s) => [s.slug, s]));
  const byId = new Map(services.map((s) => [s.id, s]));

  // union-find
  const parent = new Map<string, string>(services.map((s) => [s.id, s.id]));
  const find = (x: string): string => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x)!)!); x = parent.get(x)!; } return x; };
  const curatedCanon = new Set<string>(); // service ids that are curated canonicals

  // score for root election (higher wins)
  const score = (s: Svc): number =>
    (curatedCanon.has(s.id) ? 4e9 : 0) + (s.origin !== "ai" ? 2e9 : 0) + s.clinics * 1000 + (1000 - s.name.length);

  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b); if (ra === rb) return;
    const root = score(byId.get(ra)!) >= score(byId.get(rb)!) ? ra : rb;
    const other = root === ra ? rb : ra;
    parent.set(other, root);
  };

  // 1) curated
  const missing: string[] = [];
  for (const [canonSlug, variants] of Object.entries(CURATED)) {
    const canon = bySlug.get(canonSlug);
    if (!canon) { missing.push(canonSlug); continue; }
    curatedCanon.add(canon.id);
    for (const v of variants) {
      const vs = bySlug.get(v);
      if (!vs) { missing.push(v); continue; }
      union(canon.id, vs.id);
    }
  }
  // 2) auto normalized-key groups
  const byKey = new Map<string, Svc[]>();
  for (const s of services) { const k = normKey(s.name); (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(s); }
  for (const grp of byKey.values()) if (grp.length > 1) for (let i = 1; i < grp.length; i++) union(grp[0].id, grp[i].id);

  // collect groups by root
  const groups = new Map<string, Svc[]>();
  for (const s of services) { const r = find(s.id); (groups.get(r) ?? groups.set(r, []).get(r)!).push(s); }

  const merges: Array<{ canon: Svc; variants: Svc[] }> = [];
  for (const [rootId, members] of groups) {
    if (members.length < 2) continue;
    const canon = byId.get(rootId)!;
    merges.push({ canon, variants: members.filter((m) => m.id !== rootId).sort((a, b) => b.clinics - a.clinics) });
  }
  merges.sort((a, b) => b.variants.length - a.variants.length || a.canon.name.localeCompare(b.canon.name));

  let mergedRows = 0, deletedSvc = 0;
  console.log(`\n=== MERGE PLAN (${merges.length} groups, ${services.length} services total) ===\n`);
  for (const { canon, variants } of merges) {
    console.log(`● ${canon.name} [${canon.clinics}]${canon.origin !== "ai" ? " ★seed" : ""}`);
    for (const v of variants) { console.log(`    ← ${v.name} [${v.clinics}]`); mergedRows += v.clinics; deletedSvc++; }
  }
  if (missing.length) console.log(`\n(note: ${missing.length} curated slug(s) not in catalog, skipped: ${missing.slice(0, 20).join(", ")}${missing.length > 20 ? "…" : ""})`);
  console.log(`\nWould repoint ~${mergedRows} clinic_services rows and delete ${deletedSvc} duplicate service rows.`);
  console.log(`Catalog: ${services.length} -> ${services.length - deletedSvc} services.`);

  if (!APPLY) { console.log(`\n(PREVIEW only — re-run with --apply)`); await pool.end(); return; }

  // ── APPLY (transaction with invariant assertions) ───────────────────────────
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const before = await client.query<{ n: string }>(`SELECT count(*) n FROM clinic_services`);
    const beforeNull = await client.query<{ n: string }>(`SELECT count(*) n FROM clinic_services WHERE service_id IS NULL`);

    for (const { canon, variants } of merges) {
      for (const v of variants) {
        await client.query(`UPDATE clinic_services SET service_id = $1 WHERE service_id = $2`, [canon.id, v.id]);
        await client.query(`DELETE FROM services WHERE id = $1`, [v.id]);
      }
    }

    const after = await client.query<{ n: string }>(`SELECT count(*) n FROM clinic_services`);
    const afterNull = await client.query<{ n: string }>(`SELECT count(*) n FROM clinic_services WHERE service_id IS NULL`);
    if (before.rows[0].n !== after.rows[0].n) throw new Error(`clinic_services row count changed ${before.rows[0].n} -> ${after.rows[0].n} — ROLLBACK`);
    if (beforeNull.rows[0].n !== afterNull.rows[0].n) throw new Error(`null service_id count changed ${beforeNull.rows[0].n} -> ${afterNull.rows[0].n} — ROLLBACK`);
    await client.query("COMMIT");
    console.log(`\n✓ Applied. clinic_services rows preserved: ${after.rows[0].n} (null=${afterNull.rows[0].n}). Deleted ${deletedSvc} duplicate services.`);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(`\n✗ ROLLED BACK:`, e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally { client.release(); }

  try { await query(`REFRESH MATERIALIZED VIEW CONCURRENTLY clinic_search_view`); }
  catch { await query(`REFRESH MATERIALIZED VIEW clinic_search_view`); }
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
