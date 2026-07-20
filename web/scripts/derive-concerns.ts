/**
 * scripts/derive-concerns.ts — enrich clinic concerns by DERIVING them from the
 * treatments each clinic actually offers (a Botox clinic treats crow's feet,
 * forehead lines, etc.). UNION with existing concerns — never removes any.
 * No OpenAI: pure treatment→concern knowledge map + catalog resolver.
 *
 *   bun scripts/derive-concerns.ts            # all active clinics
 *   bun scripts/derive-concerns.ts --recent   # only clinics added in last 6h
 *   bun scripts/derive-concerns.ts --dry
 */
import "dotenv/config";
import pool, { query, queryOne } from "../src/lib/db";
import { slugify } from "../src/lib/scraper/utils";
import { normalize, bestCatalogMatch, isConcernNoise } from "../src/lib/taxonomy/canonical";

// Rules matched against a treatment's display name (canonical name or raw_name).
const RULES: Array<{ re: RegExp; concerns: string[] }> = [
  { re: /\b(botox|dysport|jeuveau|daxxify|xeomin|neuromodulator|neurotox|wrinkle relaxer|tox|jawtox|masseter|nuceiva)\b/i,
    concerns: ["Forehead Lines", "Frown Lines", "Crow's Feet", "Bunny Lines", "Gummy Smile", "Masseter (TMJ) / Face Slimming", "Platysma (Vertical Neck Cords)", "Hyperhidrosis"] },
  { re: /\b(lip filler|lip augmentation|lip flip|russian lips?)\b/i,
    concerns: ["Thin Lips"] },
  { re: /\b(dermal filler|fillers?|juvederm|restylane|revanesse|rha|belotero|versa|voluma)\b/i,
    concerns: ["Volume Loss", "Nasolabial Folds", "Marionette Lines", "Under-Eye Hollows", "Thin Lips"] },
  { re: /\b(sculptra|radiesse|biostimulator|bio-?stimulator|collagen stimulator)\b/i,
    concerns: ["Volume Loss", "Skin Laxity", "Cellulite"] },
  { re: /\b(kybella|fat dissolv|deoxycholic|lipolysis)\b/i,
    concerns: ["Double Chin", "Submental Fullness"] },
  { re: /\b(morpheus|microneedl|micro-?needl|rf microneedling|sylfirm|secret rf|vivace|potenza|scarlet)\b/i,
    concerns: ["Acne Scars", "Fine Lines & Wrinkles", "Enlarged Pores", "Skin Texture", "Skin Laxity", "Stretch Marks"] },
  { re: /\b(chemical peel|vi peel|tca|glycolic|salicylic|jessner)\b/i,
    concerns: ["Hyperpigmentation", "Acne", "Melasma", "Dull Skin", "Fine Lines & Wrinkles", "Sun Damage"] },
  { re: /\b(hydrafacial|hydra-?facial|facial|dermaplan|microdermabrasion|diamond glow|glo2|oxygen facial)\b/i,
    concerns: ["Dull Skin", "Skin Texture", "Dehydration", "Enlarged Pores"] },
  { re: /\b(laser hair removal|hair removal|diode laser|electrolysis)\b/i,
    concerns: ["Unwanted Hair"] },
  { re: /\b(ipl|photofacial|photo facial|bbl|broadband light|forever young|lumecca)\b/i,
    concerns: ["Sun Damage", "Dark Spots", "Redness", "Rosacea", "Hyperpigmentation"] },
  { re: /\b(co2|fraxel|erbium|resurfac|halo|moxi|clear ?lift|opus|profractional|laser peel)\b/i,
    concerns: ["Fine Lines & Wrinkles", "Acne Scars", "Sun Damage", "Skin Texture"] },
  { re: /\b(ultherapy|sofwave|thermage|skin tightening|rf skin|renuvion|j-?plasma|evolve|tightening)\b/i,
    concerns: ["Skin Laxity", "Loose & Sagging Skin", "Jawline"] },
  { re: /\b(pdo thread|thread lift|threads?)\b/i,
    concerns: ["Skin Laxity", "Loose & Sagging Skin", "Jawline"] },
  { re: /\b(coolsculpt|body contour|emsculpt|trusculpt|sculpsure|coolt one|cooltone|evolvex|body sculpt)\b/i,
    concerns: ["Stubborn Body Fat", "Cellulite"] },
  { re: /\b(prp|prf|platelet)\b/i, concerns: ["Skin Texture", "Fine Lines & Wrinkles"] },
  { re: /\b(hair restoration|hair loss|minoxidil|nutrafol|exosome|prp for hair|pdgf)\b/i,
    concerns: ["Hair Loss", "Hair Thinning"] },
  { re: /\b(sclerotherapy|spider vein|leg vein|varicose)\b/i,
    concerns: ["Spider Veins", "Varicose Veins"] },
  { re: /\b(acne treatment|acne program|clear ?skin)\b/i, concerns: ["Acne", "Acne Scars"] },
  { re: /\b(weight loss|glp-?1|semaglutide|tirzepatide|medical weight)\b/i,
    concerns: ["Weight Loss", "Stubborn Body Fat"] },
  { re: /\b(iv therapy|iv drip|vitamin injection|nad|hydration therapy)\b/i,
    concerns: ["Fatigue", "Dehydration"] },
  { re: /\b(hormone|testosterone|hrt|peptide|wellness)\b/i,
    concerns: ["Fatigue", "Low Energy"] },
  { re: /\b(vaginal|feminine|o-?shot|labiaplasty|femini)\b/i,
    concerns: ["Vaginal Laxity", "Vaginal Dryness"] },
  { re: /\b(prp joint|regenerative|joint|ozone|eboo)\b/i, concerns: ["Joint Pain"] },
  { re: /\b(miradry)\b/i, concerns: ["Hyperhidrosis", "Underarm Odor"] },
];

async function main() {
  const recent = process.argv.includes("--recent");
  const dry = process.argv.includes("--dry");
  const clinics = await query<{ id: string; name: string }>(
    `SELECT id, name FROM clinics WHERE is_active = true ${recent ? "AND created_at > now() - interval '6 hours'" : ""} ORDER BY name`
  );
  console.log(`${clinics.length} clinic(s)${dry ? " (DRY)" : ""}\n`);

  // concern catalog (mutable — we may create new rows)
  const cat = (await query<{ id: string; name: string; slug: string }>(`SELECT id, name, slug FROM concerns WHERE is_active = true`))
    .map((c) => ({ id: c.id, name: c.name, slug: c.slug, aliases: [] as string[] }));

  async function resolveConcern(name: string) {
    const n = normalize(name);
    let row = cat.find((c) => normalize(c.name) === n || normalize(c.slug) === n);
    if (!row) { const fz = bestCatalogMatch(name, cat, 0.84); if (fz) row = cat.find((c) => c.slug === fz.entry.slug); }
    if (!row) {
      const base = slugify(name) || "concern"; let sl = base, i = 2;
      while (await queryOne(`SELECT 1 FROM concerns WHERE slug = $1`, [sl])) sl = `${base}-${i++}`;
      const ins = await queryOne<{ id: string; name: string; slug: string }>(
        `INSERT INTO concerns (name, slug, origin, is_active) VALUES ($1,$2,'ai',true)
         ON CONFLICT (slug) DO UPDATE SET updated_at = now() RETURNING id, name, slug`, [name, sl]);
      row = { ...ins!, aliases: [] }; cat.push(row);
    }
    return row;
  }

  let totalAdded = 0;
  for (const c of clinics) {
    const tx = await query<{ nm: string }>(
      `SELECT DISTINCT COALESCE(s.name, cs.raw_name) AS nm
         FROM clinic_services cs LEFT JOIN services s ON s.id = cs.service_id
        WHERE cs.clinic_id = $1 AND cs.is_active = true`, [c.id]);
    const names = new Set<string>();
    for (const t of tx) for (const rule of RULES) if (rule.re.test(t.nm)) rule.concerns.forEach((x) => names.add(x));
    // existing concerns for this clinic (to compute how many are NEW)
    const existing = new Set(
      (await query<{ id: string }>(`SELECT concern_id AS id FROM clinic_concerns WHERE clinic_id=$1 AND is_active=true`, [c.id])).map((r) => r.id));
    let added = 0;
    for (const name of names) {
      if (isConcernNoise(name)) continue;
      const row = await resolveConcern(name);
      if (existing.has(row.id)) continue;
      if (!dry) {
        await query(
          `INSERT INTO clinic_concerns (clinic_id, concern_id, source, is_active) VALUES ($1,$2,'scraped',true)
           ON CONFLICT (clinic_id, concern_id) DO UPDATE SET source='scraped', is_active=true, updated_at=now()
           WHERE clinic_concerns.source <> 'removed'`, [c.id, row.id]);
      }
      existing.add(row.id); added++;
    }
    totalAdded += added;
    console.log(`${c.name} — +${added} concerns (from ${tx.length} treatments)`);
  }
  console.log(`\nTotal concerns added: ${totalAdded}`);
  if (!dry) { try { await query(`REFRESH MATERIALIZED VIEW CONCURRENTLY clinic_search_view`); } catch { await query(`REFRESH MATERIALIZED VIEW clinic_search_view`); } }
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
