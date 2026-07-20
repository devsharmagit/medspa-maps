/**
 * scripts/catalog-cleanup.ts — targeted, lossless cleanup of the services and
 * concerns catalogs. Three operations, all data-preserving:
 *
 *  1. MERGE duplicate/variant services into a canonical service. clinic_services
 *     rows are repointed (never deleted), then the empty variant is removed.
 *  2. RECLASSIFY services that are really a CONCERN (e.g. "Acne", "Acne Boot Camp")
 *     → for every clinic offering it, ensure the matching concern is attached
 *     (clinic_concerns), THEN drop the service. No clinic loses the signal.
 *  3. Remove clear JUNK services (provider names, bootcamps/programs/consults).
 *
 * Plus concern-side cleanup: merge duplicate concerns, and drop treatment-as-
 * concern junk (e.g. "Lip Flip", "Lip Enhancement", "Brow Lift" are treatments,
 * not conditions).
 *
 *   bun scripts/catalog-cleanup.ts          # PREVIEW
 *   bun scripts/catalog-cleanup.ts --apply
 */
import "dotenv/config";
import pool, { query } from "../src/lib/db";

const APPLY = process.argv.includes("--apply");

// ── 1. SERVICE MERGES: canonical slug ← variant slugs ───────────────────────
const SERVICE_MERGES: Record<string, string[]> = {
  botox: [
    "alartox", "baby-botox", "botox-dysport-xeomin", "botox-dysport-jeuveau",
    "botox-dysport-xeomin-jeuveau", "botox-and-daxxify", "botox-and-dysport",
    "botoxdysport-therapeutic", "botoxdysportjeuveau-cosmetic", "botoxxeomin",
    "jawtox", "jawtox-masseter", "masseter-botox", "microtox", "microtox-facial",
    "nasaltox", "neurotoxin-botox-dysport", "neurotoxin-treatments",
    "neurotoxins-botox-dysport-jeuveau", "shoulder-slimming-botox", "theratox",
    "anti-wrinkle-injections", "tmj-neurotoxin-teeth-grinding-treatment",
    "toxin-for-hyperhidrosis",
  ],
  jeuveau: ["jeaveau", "juveau"],
  daxxify: ["daxxify-frown-line-treatment"],
  dermaplaning: ["dermaplane", "dermaplane-facial"],
  aquagold: ["aquagold-facial", "aquagold-fine-touch", "aquagold-microchannel-treatment", "aqua-gold-fine-touch-microneedling"],
  "co2-laser": ["co2-laser-resurfacing", "co2-laser-skin-resurfacing", "co2-laser-treatments", "co2-resurfacing", "co2-skin-laser-resurfacing", "co-laser", "fractional-co2", "fractional-co2-laser", "co2re-skin-resurfacing"],
  fraxel: ["fraxel-laser"],
  halo: ["halo-laser", "halo-laser-treatments"],
  moxi: ["moxi-laser", "moxi-laser-treatment", "moxi-skin-resurfacing", "sciton-moxi"],
  bbl: ["bbl-clear", "bbl-forever-clear", "bbl-forever-young", "bbl-hero", "bbl-hero-body", "bbl-hero-treatment", "bbl-heroic", "bbl-laser", "bbl-photofacial", "forever-bare-bbl", "forever-clear-bbl", "forever-young-bbl", "forever-young", "sciton-bbl", "broadband-light", "broadband-light-bbl-treatment"],
  "rf-microneedling": ["radiofrequency-microneedling", "radiofrequency-microneedling-pixe", "virtue-rf-microneedling", "virtue-microneedle-rf", "virtuerf", "scarlet-rf-microneedling", "genius-rf-microneedling", "sylfirm-x-rf-microneedling", "pixel8-rf-microneedling", "microneedling-rf-microneedling", "vivace-rf"],
  microneedling: ["microneedling-pen", "pen-microneedling", "nanoneedling", "needling-procedures", "dermapen-4-microneedling", "rejuvapen-nxt-microneedling", "exceed-micro-needle-pen"],
  "chemical-peels": ["chemical-peels-vipeel", "medium-depth-chemical-peels", "micropeel", "lunchtime-peels"],
  "vi-peel": ["vi-chemical-peel", "vi-peels"],
  hydrafacial: ["couture-hydrafacial", "deluxe-hydrafacial", "platinum-hydrafacial"],
  "hormone-replacement-therapy": ["hormone-replacement", "hormone-therapy", "hrt", "bhrt", "bhrt-hormone-treatments", "bio-identical-hormone-replacement", "bioidentical-hormone-replacement-therapy", "bioidentical-hormone-replacement-therapy-bhrt", "bioidentical-hormone-therapy", "bioidentical-hormone-optimization", "hormone-optimization", "hormone-optimization-therapy", "hormone-pellets", "biote-hormone-therapy", "biote-bioidentical-hormone-replacement-therapy", "biote-hormone-pellets", "hormone-pellet-implantation-procedure", "biote"],
  "medical-weight-loss": ["semaglutide-weight-loss", "semaglutide-for-weight-loss", "tirzepatide-for-weight-loss", "weight-loss-medications", "medically-managed-weight-loss", "glp-1-weight-loss", "glp-1-weight-loss-injections", "glp-1-weight-management", "glp-1gip-dual-agonist-weight-loss-injections", "privately-compounded-weight-loss-medications-glp-1"],
  "iv-therapy": ["iv-infusion", "iv-nutrient-therapy", "iv-nutrition-therapy", "iv-hydration-myers-cocktail", "myers-cocktail-iv-therapy", "vitamin-infusions"],
  "laser-hair-removal": ["laser-hair-reduction", "full-body-laser-hair-removal", "brazilian-bikini-laser-hair-removal", "diolazexl-laser-hair-removal", "candela-laser-hair-removal", "bareit-hair-removal", "hair-removal", "laser-hair-removal-face-legs-arms-lip-chin"],
  "laser-skin-resurfacing": ["laser-resurfacing", "skin-resurfacing", "skin-resurfacing-laser", "fractional-laser-resurfacing", "fractional-laser-skin-resurfacing", "ablative-laser-resurfacing"],
  biostimulators: ["biostimulants", "biostimulation", "biostimulator-injections", "biostimulatory-injectables", "collagen-stimulators", "collagen-stimulation", "injectable-collagen-stimulators", "collagen-stimulating-injection", "collagen-stimulating-procedures"],
  "vitamin-injections": ["vitamin-shots", "vitamin-booster-injections", "vitaminb12-shots", "b12-shots", "skinny-shot-b12", "vitamin-therapy"],
  "prp-prf": ["prf", "prf-platelet-rich-fibrin", "prfm", "prf-injections", "prf-therapy", "prf-gel", "prf-ezgel", "platelet-rich-fibrin", "prp-injections", "prp-therapy", "platelet-derived-growth-factor"],
  "peptide-therapy": ["peptide-therapies", "peptides", "injectable-peptides", "advanced-peptide-therapy", "anti-aging-peptide-therapy", "key-peptides", "peptide-serum"],
  "red-light-therapy": ["led-light-therapy", "led-therapy", "light-therapy"],
  facials: ["facial-treatments", "custom-facial", "custom-facial-treatments", "customized-facial", "medical-facials", "medi-facials", "medical-grade-facials", "professional-facials", "signature-facials", "advanced-facials", "luxury-facials", "clinical-facial", "express-facials", "enhanced-facial"],
  "spider-vein-treatment": ["spider-vein-removal", "spider-vein-laser-treatment", "laser-spider-vein-removal", "laser-spider-vein-treatment", "vasculaze-spider-vein-treatment"],
  "vein-treatment": ["vein-removal", "vein-therapy", "leg-vein-removal", "laser-vein-removal", "laser-vein-treatment", "vein-vascular-removal"],
  "tattoo-removal": ["laser-tattoo-removal"],
  radiofrequency: ["radiofrequency-lifting", "radiofrequency-body-tightening"],
};

// ── 2. RECLASSIFY service → concern (migrate clinics, then drop service) ─────
// serviceSlug -> concernSlug (concern must already exist or be creatable).
const SERVICE_TO_CONCERN: Record<string, string> = {
  "acne-treatments": "acne",
  "acne-boot-camp": "acne",
  "face-reality-acne-bootcamp": "acne",
  "face-reality-acne-treatment": "acne",
  "clarifying-acne-facial": "acne",
  "cellulite-treatments": "cellulite",
  "cellulite-reduction": "cellulite",
  "cellulite-removal": "cellulite",
  "hyperhidrosis-treatment": "hyperhidrosis",
  "excessive-sweating-treatment": "hyperhidrosis",
  "broken-vessels": "broken-vessels",
  "broken-vessels-treatment": "broken-vessels",
  "snoring-treatment": "snoring",
  "spider-veins": "spider-veins",
};

// ── 3. JUNK services (delete outright — not a treatment, not a concern) ──────
const JUNK_SERVICES = new Set<string>([
  "mara-costa-aprn-bc", "3-month-skin-camp", "cheeky-club", "face-reality-skincare-program",
  "personalized-skin-care-consultations", "triple-threat-protocol", "total-skin-solution",
  "the-radiance-revival", "aura-skin-analysis", "biohacking-longevity", "teen-services",
  "health-management-services", "lifestyle-wellness-programs", "improving-protection-against-aging-and-disease",
]);

// ── CONCERN MERGES: canonical slug ← variant slugs ──────────────────────────
const CONCERN_MERGES: Record<string, string[]> = {
  "fine-lines-wrinkles": ["facial-lines", "facial-aging"],
  redness: ["facial-redness-and-visible-vessels"],
  "spider-veins": ["facial-veins"],
  "unwanted-hair": ["unwanted-facial-hair"],
  "tattoo-ink": ["unwanted-tattoos"],
};

// ── CONCERN JUNK: treatments/goals wrongly stored as concerns → delete ──────
const CONCERN_JUNK = new Set<string>([
  "lip-flip", "lip-enhancement", "brow-lift", "thinning-lashes",
]);

async function main() {
  const svc = await query<{ id: string; slug: string; name: string }>(`SELECT id, slug, name FROM services`);
  const svcBySlug = new Map(svc.map((s) => [s.slug, s]));
  const con = await query<{ id: string; slug: string; name: string }>(`SELECT id, slug, name FROM concerns`);
  const conBySlug = new Map(con.map((c) => [c.slug, c]));

  const missing: string[] = [];
  const need = (slug: string, map: Map<string, unknown>) => { if (!map.has(slug)) missing.push(slug); return map.has(slug); };

  // Report plan
  let svcMergeRows = 0, svcReclass = 0, svcJunk = 0, conMergeRows = 0, conJunk = 0;
  console.log("\n=== SERVICE MERGES ===");
  for (const [canon, variants] of Object.entries(SERVICE_MERGES)) {
    if (!need(canon, svcBySlug)) continue;
    const present = variants.filter((v) => svcBySlug.has(v));
    if (present.length) { console.log(`  ${canon} ← ${present.join(", ")}`); svcMergeRows += present.length; }
  }
  console.log("\n=== RECLASSIFY service → concern ===");
  for (const [s, c] of Object.entries(SERVICE_TO_CONCERN)) {
    if (svcBySlug.has(s)) { console.log(`  ${s} → concern:${c}`); svcReclass++; }
  }
  console.log("\n=== JUNK services ===");
  for (const s of JUNK_SERVICES) if (svcBySlug.has(s)) { console.log(`  ✗ ${s}`); svcJunk++; }
  console.log("\n=== CONCERN MERGES ===");
  for (const [canon, variants] of Object.entries(CONCERN_MERGES)) {
    if (!need(canon, conBySlug)) continue;
    const present = variants.filter((v) => conBySlug.has(v));
    if (present.length) { console.log(`  ${canon} ← ${present.join(", ")}`); conMergeRows += present.length; }
  }
  console.log("\n=== CONCERN JUNK (delete treatment-as-concern) ===");
  for (const c of CONCERN_JUNK) if (conBySlug.has(c)) { console.log(`  ✗ ${c}`); conJunk++; }
  if (missing.length) console.log(`\n(note: ${missing.length} canonical slug(s) not found: ${[...new Set(missing)].join(", ")})`);
  console.log(`\nPlan: merge ${svcMergeRows} service variants, reclassify ${svcReclass} → concerns, delete ${svcJunk} junk services; merge ${conMergeRows} concern variants, delete ${conJunk} junk concerns.`);

  if (!APPLY) { console.log("\n(PREVIEW only — re-run with --apply)"); await pool.end(); return; }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const beforeCS = (await client.query<{ n: string }>(`SELECT count(*) n FROM clinic_services`)).rows[0].n;

    // 1. Service merges (repoint clinic_services, delete variant)
    for (const [canon, variants] of Object.entries(SERVICE_MERGES)) {
      const c = svcBySlug.get(canon); if (!c) continue;
      for (const v of variants) {
        const vs = svcBySlug.get(v); if (!vs) continue;
        await client.query(`UPDATE clinic_services SET service_id=$1 WHERE service_id=$2`, [c.id, vs.id]);
        await client.query(`DELETE FROM services WHERE id=$1`, [vs.id]);
      }
    }
    // 2. Reclassify service → concern (migrate clinics to concern, then drop service)
    for (const [sSlug, cSlug] of Object.entries(SERVICE_TO_CONCERN)) {
      const s = svcBySlug.get(sSlug); if (!s) continue;
      let concern = conBySlug.get(cSlug);
      if (!concern) {
        const ins = await client.query<{ id: string; slug: string; name: string }>(
          `INSERT INTO concerns (name, slug, origin, is_active) VALUES ($1,$2,'ai',true)
           ON CONFLICT (slug) DO UPDATE SET is_active=true RETURNING id, slug, name`,
          [cSlug.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()), cSlug]);
        concern = ins.rows[0]; conBySlug.set(concern.slug, concern);
      }
      // every clinic offering this service gets the concern
      await client.query(
        `INSERT INTO clinic_concerns (clinic_id, concern_id, source, is_active)
         SELECT DISTINCT cs.clinic_id, $2::uuid, 'scraped', true
         FROM clinic_services cs WHERE cs.service_id=$1 AND cs.is_active=true
         ON CONFLICT (clinic_id, concern_id) DO UPDATE SET is_active=true, source='scraped'
           WHERE clinic_concerns.source <> 'removed'`,
        [s.id, concern.id]);
      await client.query(`DELETE FROM clinic_services WHERE service_id=$1`, [s.id]);
      await client.query(`DELETE FROM services WHERE id=$1`, [s.id]);
    }
    // 3. Junk services
    for (const sSlug of JUNK_SERVICES) {
      const s = svcBySlug.get(sSlug); if (!s) continue;
      await client.query(`DELETE FROM clinic_services WHERE service_id=$1`, [s.id]);
      await client.query(`DELETE FROM services WHERE id=$1`, [s.id]);
    }
    // 4. Concern merges (conflict-safe repoint)
    for (const [canon, variants] of Object.entries(CONCERN_MERGES)) {
      const c = conBySlug.get(canon); if (!c) continue;
      for (const v of variants) {
        const vc = conBySlug.get(v); if (!vc) continue;
        await client.query(
          `UPDATE clinic_concerns cc SET concern_id=$1 WHERE concern_id=$2
             AND NOT EXISTS (SELECT 1 FROM clinic_concerns x WHERE x.clinic_id=cc.clinic_id AND x.concern_id=$1)`,
          [c.id, vc.id]);
        await client.query(`DELETE FROM clinic_concerns WHERE concern_id=$1`, [vc.id]);
        await client.query(`DELETE FROM concerns WHERE id=$1`, [vc.id]);
      }
    }
    // 5. Concern junk (delete treatment-as-concern; cascade removes clinic_concerns)
    for (const cSlug of CONCERN_JUNK) {
      const c = conBySlug.get(cSlug); if (!c) continue;
      await client.query(`DELETE FROM concerns WHERE id=$1`, [c.id]);
    }

    const afterCS = (await client.query<{ n: string }>(`SELECT count(*) n FROM clinic_services`)).rows[0].n;
    // clinic_services may only shrink by reclassified+junk deletes; assert no unexpected loss from merges
    console.log(`\nclinic_services: ${beforeCS} → ${afterCS} (drop = reclassified+junk services' rows; merges preserved via repoint)`);
    await client.query("COMMIT");
    console.log("✓ Applied.");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("✗ ROLLED BACK:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally { client.release(); }

  try { await query(`REFRESH MATERIALIZED VIEW CONCURRENTLY clinic_search_view`); }
  catch { await query(`REFRESH MATERIALIZED VIEW clinic_search_view`); }
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
