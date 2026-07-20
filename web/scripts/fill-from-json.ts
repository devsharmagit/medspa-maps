/**
 * scripts/fill-from-json.ts — add treatments + concerns to EXISTING clinics from
 * {slug, treatments[], concerns[], note} JSON files (used to backfill clinics that
 * saved with 0 treatments). Canonical-matched, no OpenAI. A clinic whose file has
 * an empty treatments list is DEACTIVATED (is_active=false) — a 0-treatment clinic
 * shouldn't show in the demo.
 *
 *   bun scripts/fill-from-json.ts <dir> [--dry]
 */
import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pool, { query, queryOne } from "../src/lib/db";
import { slugify } from "../src/lib/scraper/utils";
import { normalize, bestCatalogMatch, isServiceNoise, isConcernNoise } from "../src/lib/taxonomy/canonical";

const DRY = process.argv.includes("--dry");

async function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error("usage: bun scripts/fill-from-json.ts <dir>");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

  const svcCat = (await query<any>(`SELECT id,name,slug FROM services WHERE is_active=true`))
    .map((s) => ({ id: s.id, name: s.name, slug: s.slug, aliases: [] as string[] }));
  const svcBySlug = new Map(svcCat.map((c) => [c.slug, c]));
  const conCat = (await query<any>(`SELECT id,name,slug FROM concerns WHERE is_active=true`))
    .map((c) => ({ id: c.id, name: c.name, slug: c.slug, aliases: [] as string[] }));
  const conBySlug = new Map(conCat.map((c) => [c.slug, c]));

  async function resolveSvc(raw: string) {
    const hit = bestCatalogMatch(raw, svcCat);
    if (hit) return { id: svcBySlug.get(hit.entry.slug)!.id, status: hit.confidence >= 1 ? "matched" : "auto" };
    const base = slugify(raw) || "service"; let sl = base, i = 2;
    while (await queryOne(`SELECT 1 FROM services WHERE slug=$1`, [sl])) sl = `${base}-${i++}`;
    const ins = await queryOne<any>(`INSERT INTO services (name,slug,origin,is_active) VALUES ($1,$2,'ai',true) ON CONFLICT (slug) DO UPDATE SET updated_at=now() RETURNING id,name,slug`, [raw, sl]);
    const row = { id: ins!.id, name: ins!.name, slug: ins!.slug, aliases: [] }; svcCat.push(row); svcBySlug.set(row.slug, row);
    return { id: row.id, status: "auto" };
  }
  async function resolveCon(name: string) {
    const n = normalize(name);
    let row = conCat.find((c) => normalize(c.name) === n || normalize(c.slug) === n);
    if (!row) { const fz = bestCatalogMatch(name, conCat, 0.84); if (fz) row = conBySlug.get(fz.entry.slug); }
    if (!row) {
      const base = slugify(name) || "concern"; let sl = base, i = 2;
      while (await queryOne(`SELECT 1 FROM concerns WHERE slug=$1`, [sl])) sl = `${base}-${i++}`;
      const ins = await queryOne<any>(`INSERT INTO concerns (name,slug,origin,is_active) VALUES ($1,$2,'ai',true) ON CONFLICT (slug) DO UPDATE SET updated_at=now() RETURNING id,name,slug`, [name, sl]);
      row = { id: ins!.id, name: ins!.name, slug: ins!.slug, aliases: [] }; conCat.push(row); conBySlug.set(row.slug, row);
    }
    return row;
  }

  for (const f of files) {
    let p: any; try { p = JSON.parse(readFileSync(join(dir, f), "utf8")); } catch { console.log(`✗ ${f} bad JSON`); continue; }
    const slug = p.slug || f.replace(/\.json$/, "");
    const clinic = await queryOne<any>(`SELECT id, name FROM clinics WHERE slug=$1`, [slug]);
    if (!clinic) { console.log(`✗ ${slug} not found`); continue; }
    const treatments: string[] = (p.treatments || []).map((t: string) => (t || "").trim()).filter((t: string) => t && !isServiceNoise(t));
    if (treatments.length === 0) {
      console.log(`⊘ ${clinic.name} — 0 treatments (${p.note || "no data"}) → ${DRY ? "would deactivate" : "DEACTIVATED"}`);
      if (!DRY) await query(`UPDATE clinics SET is_active=false, updated_at=now() WHERE id=$1`, [clinic.id]);
      continue;
    }
    let tx = 0, co = 0;
    for (const raw of treatments) {
      const { id, status } = await resolveSvc(raw);
      if (!DRY) await query(
        `INSERT INTO clinic_services (clinic_id,service_id,raw_name,match_status,is_active) VALUES ($1,$2,$3,$4,true)
         ON CONFLICT (clinic_id,raw_name) DO UPDATE SET service_id=EXCLUDED.service_id, match_status=EXCLUDED.match_status, is_active=true, updated_at=now()`,
        [clinic.id, id, raw, status]);
      tx++;
    }
    for (const raw of (p.concerns || [])) {
      const name = (raw || "").trim(); if (!name || isConcernNoise(name)) continue;
      const row = await resolveCon(name);
      if (!DRY) await query(
        `INSERT INTO clinic_concerns (clinic_id,concern_id,source,is_active) VALUES ($1,$2,'scraped',true)
         ON CONFLICT (clinic_id,concern_id) DO UPDATE SET source='scraped', is_active=true, updated_at=now() WHERE clinic_concerns.source <> 'removed'`,
        [clinic.id, row.id]);
      co++;
    }
    console.log(`✓ ${clinic.name} — +${tx} treatments, +${co} concerns`);
  }
  if (!DRY) { try { await query(`REFRESH MATERIALIZED VIEW CONCURRENTLY clinic_search_view`); } catch { await query(`REFRESH MATERIALIZED VIEW clinic_search_view`); } }
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
