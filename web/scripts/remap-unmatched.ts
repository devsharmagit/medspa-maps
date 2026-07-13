/**
 * remap-unmatched.ts — after the catalog cleanup, re-resolve every unmatched
 * clinic_services row against the CLEAN live catalog (curated matchService →
 * DB bestCatalogMatch). Links rows that now have a home (e.g. Daxxify/Tox →
 * Botox whose old AI target was deleted) and normalizes match_status to
 * 'unmatched' for genuine junk. Never creates catalog rows.
 *
 *   bun --env-file=.env scripts/remap-unmatched.ts [--apply]
 */
import pool from "../src/lib/db";
import { matchService, bestCatalogMatch, type CatalogEntry } from "../src/lib/taxonomy/canonical";

const APPLY = process.argv.includes("--apply");

const catalog = (await pool.query<CatalogEntry & { id: string }>(
  `SELECT id, name, slug, COALESCE(aliases,'{}') aliases FROM services WHERE is_active`
)).rows;
const bySlug = new Map(catalog.map((r) => [r.slug, r]));

const rows = (await pool.query<{ id: string; raw_name: string; match_status: string }>(
  `SELECT id, raw_name, match_status FROM clinic_services WHERE is_active AND service_id IS NULL`
)).rows;

let linked = 0, cleared = 0;
const linkedEx: string[] = [];
for (const r of rows) {
  const curated = matchService(r.raw_name);
  let hit = curated.slug ? bySlug.get(curated.slug) : undefined;
  let conf = curated.confidence;
  let status: "matched" | "auto" | "unmatched" = curated.confidence >= 1 ? "matched" : "auto";
  if (!hit) {
    const db = bestCatalogMatch(r.raw_name, catalog, 0.6);
    if (db) { hit = bySlug.get(db.entry.slug); conf = db.confidence; status = db.confidence >= 1 ? "matched" : "auto"; }
  }
  if (hit) {
    linked++;
    if (linkedEx.length < 40) linkedEx.push(`${r.raw_name} → ${hit.name} (${conf.toFixed(2)})`);
    if (APPLY) await pool.query(
      `UPDATE clinic_services SET service_id=$1, match_status=$2, match_confidence=$3, updated_at=NOW() WHERE id=$4`,
      [hit.id, status, conf, r.id]);
  } else if (r.match_status !== "unmatched") {
    cleared++;
    if (APPLY) await pool.query(
      `UPDATE clinic_services SET match_status='unmatched', match_confidence=NULL, updated_at=NOW() WHERE id=$1`, [r.id]);
  }
}
console.log(`${APPLY ? "APPLIED" : "DRY RUN"} — scanned ${rows.length} unmatched rows`);
console.log(`re-linked: ${linked}, status→unmatched: ${cleared}`);
console.log(linkedEx.join("\n"));
if (APPLY) { await pool.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY clinic_search_view`); console.log("matview refreshed"); }
await pool.end();
