/**
 * reset-clinics.ts — run with: bun scripts/reset-clinics.ts
 *
 * Deletes ONLY clinic/business content for a clean re-ingest:
 *   - images for entity_type in ('clinic','business')   (polymorphic, no FK)
 *   - clinics    → cascades clinic_locations, clinic_services, clinic_concerns,
 *                  reviews, providers, scrape_jobs, clinic_service_changes
 *   - businesses → cascades listing_claims
 *
 * PRESERVES (unlike reset-db.ts, which truncates them):
 *   - services / concerns / concern_services   (the Phase-0 taxonomy)
 *   - g99_clinic_websites                       (the harvested source list)
 *   - admin_users, medspa_leads
 *
 * Transactional (BEGIN/COMMIT, ROLLBACK on error). Does NOT drop tables/schema.
 */

import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("sslmode=disable")
    ? false
    : { rejectUnauthorized: false },
});

// Rows cleared (directly or via cascade) — shown before/after to confirm the wipe.
const CLEARED_TABLES = [
  "clinics",
  "businesses",
  "clinic_locations",
  "clinic_services",
  "clinic_concerns",
  "reviews",
  "providers",
];
// Preserved — shown before/after to prove they are untouched.
const PRESERVED_TABLES = [
  "services",
  "concerns",
  "concern_services",
  "g99_clinic_websites",
  "admin_users",
  "medspa_leads",
];

async function counts(client: any, tables: string[]) {
  const result: Record<string, number> = {};
  for (const t of tables) {
    const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
    result[t] = rows[0].n;
  }
  return result;
}

async function imageCounts(client: any) {
  const { rows } = await client.query(
    `SELECT
        COUNT(*) FILTER (WHERE entity_type IN ('clinic','business'))::int AS clinic_business,
        COUNT(*)::int AS total
      FROM images`
  );
  return rows[0] as { clinic_business: number; total: number };
}

async function reset() {
  const client = await pool.connect();
  try {
    console.log("📊 BEFORE reset:");
    const beforeCleared = await counts(client, CLEARED_TABLES);
    const beforeImages = await imageCounts(client);
    const beforePreserved = await counts(client, PRESERVED_TABLES);
    console.log("  cleared targets:");
    for (const [t, n] of Object.entries(beforeCleared)) console.log(`    ${t}: ${n}`);
    console.log(`    images(clinic+business): ${beforeImages.clinic_business} / ${beforeImages.total} total`);
    console.log("  preserved:");
    for (const [t, n] of Object.entries(beforePreserved)) console.log(`    ${t}: ${n}`);

    await client.query("BEGIN");
    console.log("⏳ Deleting clinic/business content…");
    const delImgs = await client.query(
      `DELETE FROM images WHERE entity_type IN ('clinic','business')`
    );
    const delClinics = await client.query(`DELETE FROM clinics`);
    const delBiz = await client.query(`DELETE FROM businesses`);
    await client.query("COMMIT");
    console.log(
      `✓ Committed. images=${delImgs.rowCount}, clinics=${delClinics.rowCount}, businesses=${delBiz.rowCount} deleted (dependents cascaded).`
    );

    console.log("📊 AFTER reset:");
    const afterCleared = await counts(client, CLEARED_TABLES);
    const afterImages = await imageCounts(client);
    const afterPreserved = await counts(client, PRESERVED_TABLES);
    console.log("  cleared targets:");
    for (const [t, n] of Object.entries(afterCleared)) console.log(`    ${t}: ${n}`);
    console.log(`    images(clinic+business): ${afterImages.clinic_business} / ${afterImages.total} total`);
    console.log("  preserved:");
    for (const [t, n] of Object.entries(afterPreserved)) console.log(`    ${t}: ${n}`);

    console.log("✅ reset-clinics complete. Taxonomy + g99_clinic_websites + admin_users preserved.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ reset failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

reset();
