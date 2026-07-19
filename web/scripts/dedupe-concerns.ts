/**
 * scripts/dedupe-concerns.ts — merge duplicate / near-duplicate concerns WITHOUT
 * losing any clinic→concern coverage.
 *
 * concern_id FK is ON DELETE CASCADE and clinic_concerns has UNIQUE(clinic_id,
 * concern_id), so remapping needs conflict handling: when a clinic already has
 * the canonical concern, we merge is_active (either active => canonical active)
 * and drop the duplicate row. Invariant asserted in-transaction: every
 * (clinic, canonical) pair that SHOULD exist after the merge (derived from the
 * active rows before) DOES exist — else ROLLBACK. No clinic loses a concern.
 *
 *   bun scripts/dedupe-concerns.ts            # PREVIEW
 *   bun scripts/dedupe-concerns.ts --apply
 */
import "dotenv/config";
import pool, { query } from "../src/lib/db";

const APPLY = process.argv.includes("--apply");

// canonical slug -> variant slugs (high-confidence synonyms only). Named lines
// (crow's feet, frown, marionette…) and distinct areas are deliberately kept.
const CURATED: Record<string, string[]> = {
  "fine-lines-wrinkles": [ // seed "Wrinkles & Fine Lines"
    "wrinkles", "fine-lines", "lines-and-wrinkles", "facial-wrinkles",
    "deep-facial-wrinkles", "dynamic-wrinkles", "wrinkle-reduction",
  ],
  "skin-laxity-sagging": [ // seed "Loose & Sagging Skin"
    "skin-laxity", "skin-laxity-collagen-loss", "skin-laxity-aging-skin",
    "loose-skin", "sagging-skin", "reduced-skin-elasticity",
  ],
  "double-chin-submental-fullness": ["submental-fullness", "unwanted-fat-double-chin"], // seed "Double Chin"
  "acne-scars": ["acne-scarring"], // seed
  hyperpigmentation: ["hyperpigmentation-dark-spots", "pigmentation-issues", "skin-discoloration"], // seed
  "stubborn-body-fat": ["excess-body-fat", "unwanted-fat", "fat-loss"], // seed
  acne: [
    "acne-breakouts", "breakouts", "acne-prone-skin", "cystic-acne",
    "clogged-pores", "acne-and-acne-scarring", "acne-and-acne-scars",
  ],
  hyperhidrosis: [
    "hyperhidrosis-excessive-sweating", "excessive-sweating", "excessive-sweat",
    "excessive-underarm-sweating",
  ],
  "volume-loss": ["facial-volume-loss"],
  "dull-skin": ["dullness", "dull-complexion", "dull-skin-tone", "dull-dehydrated-skin"],
  fatigue: ["chronic-fatigue"],
  "hair-loss": ["alopecia", "thinning-hair-and-hair-loss"],
  "under-eye-hollows": ["under-eye-hollows-and-dark-circles", "under-eye-concerns"],
  "masseter-tmj-face-slimming": [
    "tmj", "tmj-jaw-tension", "tmj-teeth-grinding", "teeth-grinding",
    "square-jawline-tmj-tension",
  ],
  "skin-texture": ["uneven-skin-texture", "uneven-texture"],
  scars: ["scarring", "mild-scarring"],
  "thin-lips": ["thin-lips-or-uneven-lips"],
  redness: ["redness-and-flushing"],
  "weight-loss": ["weight-management-support", "obesity-weight-management"],
};

function normKey(name: string): string {
  const base = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\band\b/g, "").replace(/[^a-z0-9]+/g, "");
  return base.endsWith("s") && base.length > 3 ? base.slice(0, -1) : base;
}

interface Con { id: string; name: string; slug: string; origin: string; clinics: number; }

async function main() {
  const concerns = await query<Con>(
    `SELECT co.id, co.name, co.slug, co.origin,
            (SELECT count(*) FROM clinic_concerns cc WHERE cc.concern_id=co.id)::int AS clinics
       FROM concerns co`);
  const bySlug = new Map(concerns.map((c) => [c.slug, c]));
  const byId = new Map(concerns.map((c) => [c.id, c]));

  const parent = new Map<string, string>(concerns.map((c) => [c.id, c.id]));
  const find = (x: string): string => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x)!)!); x = parent.get(x)!; } return x; };
  const curatedCanon = new Set<string>();
  const score = (c: Con): number =>
    (curatedCanon.has(c.id) ? 4e9 : 0) + (c.origin !== "ai" ? 2e9 : 0) + c.clinics * 1000 + (1000 - c.name.length);
  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b); if (ra === rb) return;
    const root = score(byId.get(ra)!) >= score(byId.get(rb)!) ? ra : rb;
    parent.set(root === ra ? rb : ra, root);
  };

  const missing: string[] = [];
  for (const [canonSlug, variants] of Object.entries(CURATED)) {
    const canon = bySlug.get(canonSlug);
    if (!canon) { missing.push(canonSlug); continue; }
    curatedCanon.add(canon.id);
    for (const v of variants) { const vs = bySlug.get(v); if (!vs) { missing.push(v); continue; } union(canon.id, vs.id); }
  }
  const byKey = new Map<string, Con[]>();
  for (const c of concerns) { const k = normKey(c.name); (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(c); }
  for (const grp of byKey.values()) if (grp.length > 1) for (let i = 1; i < grp.length; i++) union(grp[0].id, grp[i].id);

  const groups = new Map<string, Con[]>();
  for (const c of concerns) { const r = find(c.id); (groups.get(r) ?? groups.set(r, []).get(r)!).push(c); }
  const merges: Array<{ canon: Con; variants: Con[] }> = [];
  for (const [rootId, members] of groups) {
    if (members.length < 2) continue;
    merges.push({ canon: byId.get(rootId)!, variants: members.filter((m) => m.id !== rootId).sort((a, b) => b.clinics - a.clinics) });
  }
  merges.sort((a, b) => b.variants.length - a.variants.length || a.canon.name.localeCompare(b.canon.name));

  let deleted = 0;
  console.log(`\n=== CONCERN MERGE PLAN (${merges.length} groups, ${concerns.length} concerns) ===\n`);
  for (const { canon, variants } of merges) {
    console.log(`● ${canon.name} [${canon.clinics}]${canon.origin !== "ai" ? " ★seed" : ""}`);
    for (const v of variants) { console.log(`    ← ${v.name} [${v.clinics}]`); deleted++; }
  }
  if (missing.length) console.log(`\n(note: ${missing.length} curated slug(s) not found: ${missing.join(", ")})`);
  console.log(`\nCatalog: ${concerns.length} -> ${concerns.length - deleted} concerns.`);
  if (!APPLY) { console.log(`\n(PREVIEW only — re-run with --apply)`); await pool.end(); return; }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // expected (clinic, canonical) active pairs BEFORE
    const rows = (await client.query<{ clinic_id: string; concern_id: string; is_active: boolean }>(
      `SELECT clinic_id, concern_id, is_active FROM clinic_concerns`)).rows;
    const expected = new Set<string>();
    for (const r of rows) if (r.is_active) expected.add(`${r.clinic_id}|${find(r.concern_id)}`);

    for (const { canon, variants } of merges) {
      for (const v of variants) {
        // if either active, keep canonical active
        await client.query(
          `UPDATE clinic_concerns c SET is_active=true, source='scraped', updated_at=now()
             FROM clinic_concerns d
            WHERE c.clinic_id=d.clinic_id AND c.concern_id=$1 AND d.concern_id=$2 AND d.is_active=true`,
          [canon.id, v.id]);
        // move non-conflicting rows
        await client.query(
          `UPDATE clinic_concerns cc SET concern_id=$1 WHERE concern_id=$2
             AND NOT EXISTS (SELECT 1 FROM clinic_concerns x WHERE x.clinic_id=cc.clinic_id AND x.concern_id=$1)`,
          [canon.id, v.id]);
        await client.query(`DELETE FROM clinic_concerns WHERE concern_id=$1`, [v.id]);
        await client.query(`DELETE FROM concerns WHERE id=$1`, [v.id]);
      }
    }

    const after = new Set((await client.query<{ clinic_id: string; concern_id: string }>(
      `SELECT clinic_id, concern_id FROM clinic_concerns WHERE is_active=true`)).rows.map((r) => `${r.clinic_id}|${r.concern_id}`));
    const lost = [...expected].filter((k) => !after.has(k));
    if (lost.length) throw new Error(`${lost.length} clinic→concern pairs would be LOST — ROLLBACK`);
    await client.query("COMMIT");
    console.log(`\n✓ Applied. All ${expected.size} clinic→concern pairs preserved. Deleted ${deleted} duplicate concerns.`);
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
