/**
 * scripts/clean-catalog-junk.ts — remove junk from the services/concerns catalogs
 * using the SAME deterministic filters the ingestion now applies
 * (isServiceNoise / isConcernNoise). Only touches origin='ai' rows — the 15/10
 * curated seed rows are never removed.
 *
 *   bun scripts/clean-catalog-junk.ts            # PREVIEW only (no deletes)
 *   bun scripts/clean-catalog-junk.ts --apply    # delete the flagged rows
 *
 * Services: deleting a service also removes its clinic_services rows (so junk
 * disappears from clinic pages). Concerns: deleting cascades to clinic_concerns.
 */
import "dotenv/config";
import pool, { query } from "../src/lib/db";
import { isServiceNoise, isConcernNoise } from "../src/lib/taxonomy/canonical";

const APPLY = process.argv.includes("--apply");

async function main() {
  // ── Services ───────────────────────────────────────────────────────────────
  const services = await query<{ id: string; name: string; clinics: number }>(
    `SELECT s.id, s.name,
            (SELECT count(*) FROM clinic_services cs WHERE cs.service_id = s.id)::int AS clinics
       FROM services s WHERE origin = 'ai' ORDER BY s.name`
  );
  const junkServices = services.filter((s) => isServiceNoise(s.name));

  console.log(`\n=== SERVICES flagged as junk (${junkServices.length} of ${services.length} ai rows) ===`);
  for (const s of junkServices) console.log(`  ✗ ${s.name}  (${s.clinics} clinic_services)`);

  // ── Concerns ─────────────────────────────────────────────────────────────────
  const concerns = await query<{ id: string; name: string; clinics: number }>(
    `SELECT co.id, co.name,
            (SELECT count(*) FROM clinic_concerns cc WHERE cc.concern_id = co.id)::int AS clinics
       FROM concerns co WHERE origin = 'ai' ORDER BY co.name`
  );
  const junkConcerns = concerns.filter((c) => isConcernNoise(c.name));

  console.log(`\n=== CONCERNS flagged as junk (${junkConcerns.length} of ${concerns.length} ai rows) ===`);
  for (const c of junkConcerns) console.log(`  ✗ ${c.name}  (${c.clinics} clinic_concerns)`);

  if (!APPLY) {
    console.log(`\n(PREVIEW only — re-run with --apply to delete the ${junkServices.length} services + ${junkConcerns.length} concerns above.)`);
    await pool.end();
    return;
  }

  const svcIds = junkServices.map((s) => s.id);
  const conIds = junkConcerns.map((c) => c.id);
  if (svcIds.length) {
    await query(`DELETE FROM clinic_services WHERE service_id = ANY($1::uuid[])`, [svcIds]);
    await query(`DELETE FROM services WHERE id = ANY($1::uuid[])`, [svcIds]);
  }
  if (conIds.length) {
    // clinic_concerns rows cascade-delete with the concern.
    await query(`DELETE FROM concerns WHERE id = ANY($1::uuid[])`, [conIds]);
  }
  // Also drop AI catalog rows now attached to no clinic (orphans left behind).
  const orphanSvc = await query<{ n: number }>(
    `WITH d AS (
       DELETE FROM services s WHERE s.origin='ai'
         AND NOT EXISTS (SELECT 1 FROM clinic_services cs WHERE cs.service_id=s.id)
       RETURNING 1) SELECT count(*)::int AS n FROM d`
  );
  const orphanCon = await query<{ n: number }>(
    `WITH d AS (
       DELETE FROM concerns co WHERE co.origin='ai'
         AND NOT EXISTS (SELECT 1 FROM clinic_concerns cc WHERE cc.concern_id=co.id)
       RETURNING 1) SELECT count(*)::int AS n FROM d`
  );

  try {
    await query(`REFRESH MATERIALIZED VIEW CONCURRENTLY clinic_search_view`);
  } catch {
    await query(`REFRESH MATERIALIZED VIEW clinic_search_view`);
  }

  console.log(`\n── Applied ──`);
  console.log(`  Deleted junk services:  ${svcIds.length}`);
  console.log(`  Deleted junk concerns:  ${conIds.length}`);
  console.log(`  Deleted orphan AI services (no clinic): ${orphanSvc[0]?.n ?? 0}`);
  console.log(`  Deleted orphan AI concerns (no clinic): ${orphanCon[0]?.n ?? 0}`);
  console.log(`  Search view refreshed.`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
