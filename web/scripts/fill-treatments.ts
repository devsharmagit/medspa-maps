/**
 * scripts/fill-treatments.ts — add treatments to EXISTING clinics (which
 * save-clinic-json skips as duplicates). Same canonical resolution as
 * saveClinicServices: isServiceNoise filter → bestCatalogMatch → find-or-create
 * origin='ai' service → insert clinic_services (ON CONFLICT (clinic_id,raw_name)).
 * No OpenAI. Run derive-concerns afterwards to fill concerns.
 *
 *   bun scripts/fill-treatments.ts [--dry]
 */
import "dotenv/config";
import pool, { query, queryOne } from "../src/lib/db";
import { slugify } from "../src/lib/scraper/utils";
import { bestCatalogMatch, isServiceNoise } from "../src/lib/taxonomy/canonical";

const DRY = process.argv.includes("--dry");

// slug -> treatments
const DATA: Record<string, string[]> = {
  "pure-youth-wellness-aesthetics": [
    "Kybella", "Dermal Fillers", "Microneedling", "Dermaplaning", "Hair Restoration",
    "Hair Rejuvenation", "Hormone Replacement Therapy", "IV Therapy", "Medical Weight Loss",
  ],
  "youthful-medicine": [
    "Medical Weight Loss", "Semaglutide", "Hormone Replacement Therapy", "Peptide Therapy",
    "IV Therapy", "Dermal Fillers", "Xeomin", "Laser Treatments",
    "Autoimmune & Inflammation Treatment", "Joint and Muscle Repair", "Longevity & Diagnostics",
  ],
  youthology: [
    "Facial Contouring", "Dysport", "Lip Enhancement", "Sylfirm X Microneedling",
    "Liquid Rhinoplasty", "Restylane", "PRP", "Plasma IQ", "PRF/EZ Gel", "Body Contouring",
    "Butt Enhancement", "Sculptra", "Bellafill", "Sclerotherapy", "Vaginal Rejuvenation",
    "Hair Restoration", "Laser Hair Removal", "Customized Facial", "Chemical Peels",
    "Microdermabrasion", "DiamondGlow", "Dermaplaning", "Medical Weight Loss",
    "Hormone Optimization", "Liposuction with Renuvion",
  ],
  "yuma-wellness-and-aesthetics": [
    "Bioidentical Hormone Replacement Therapy", "Medical Weight Loss", "Semaglutide",
    "Tirzepatide", "IV Therapy", "Dermal Fillers", "Neuromodulators", "Chemical Peels", "Sculptra",
  ],
};

async function main() {
  const catalog = (await query<{ id: string; name: string; slug: string; origin: string }>(
    `SELECT id, name, slug, origin FROM services WHERE is_active = true`))
    .map((s) => ({ id: s.id, name: s.name, slug: s.slug, aliases: [] as string[], origin: s.origin }));
  const bySlug = new Map(catalog.map((c) => [c.slug, c]));

  async function resolve(raw: string): Promise<{ id: string; status: string }> {
    const hit = bestCatalogMatch(raw, catalog);
    if (hit) { const r = bySlug.get(hit.entry.slug)!; return { id: r.id, status: hit.confidence >= 1 ? "matched" : "auto" }; }
    // create new origin='ai' service
    const base = slugify(raw) || "service"; let sl = base, i = 2;
    while (await queryOne(`SELECT 1 FROM services WHERE slug=$1`, [sl])) sl = `${base}-${i++}`;
    const ins = await queryOne<{ id: string; name: string; slug: string }>(
      `INSERT INTO services (name, slug, origin, is_active) VALUES ($1,$2,'ai',true)
       ON CONFLICT (slug) DO UPDATE SET updated_at=now() RETURNING id, name, slug`, [raw, sl]);
    const row = { id: ins!.id, name: ins!.name, slug: ins!.slug, aliases: [], origin: "ai" };
    catalog.push(row); bySlug.set(row.slug, row);
    return { id: row.id, status: "auto" };
  }

  for (const [slug, treatments] of Object.entries(DATA)) {
    const clinic = await queryOne<{ id: string; name: string }>(`SELECT id, name FROM clinics WHERE slug=$1`, [slug]);
    if (!clinic) { console.log(`✗ ${slug} — clinic not found`); continue; }
    let added = 0;
    for (const raw of treatments) {
      const name = raw.trim();
      if (!name || isServiceNoise(name)) continue;
      const { id: serviceId, status } = await resolve(name);
      if (!DRY) {
        await query(
          `INSERT INTO clinic_services (clinic_id, service_id, raw_name, match_status, is_active)
           VALUES ($1,$2,$3,$4,true)
           ON CONFLICT (clinic_id, raw_name) DO UPDATE SET service_id=EXCLUDED.service_id, match_status=EXCLUDED.match_status, is_active=true, updated_at=now()`,
          [clinic.id, serviceId, name, status]);
      }
      added++;
    }
    console.log(`${DRY ? "· " : "✓ "}${clinic.name} — +${added} treatments`);
  }

  if (!DRY) { try { await query(`REFRESH MATERIALIZED VIEW CONCURRENTLY clinic_search_view`); } catch { await query(`REFRESH MATERIALIZED VIEW clinic_search_view`); } }
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
