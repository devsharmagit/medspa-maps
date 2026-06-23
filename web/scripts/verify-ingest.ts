/**
 * verify-ingest.ts — run with: bun scripts/verify-ingest.ts
 *
 * Read-only verification of the re-ingest. Reports:
 *   1. businesses / clinics counts; one row per clinic (name/city/state) and
 *      which businesses produced multiple clinics (multi-address sites).
 *   2. clinic_services total + breakdown by match_status, plus a service_id
 *      null-consistency check (matched/auto → non-null, unmatched → NULL).
 *   3. reviews count, before_after image count, concern_services link count.
 */

import pool from "../src/lib/db";

async function main() {
  const client = await pool.connect();
  try {
    // ── 1. businesses / clinics ───────────────────────────────────────────────
    const { rows: bizCount } = await client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM businesses`
    );
    const { rows: clinicCount } = await client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM clinics`
    );

    console.log("── 1. businesses & clinics ──────────────────────────────");
    console.log(`businesses: ${bizCount[0].n}`);
    console.log(`clinics:    ${clinicCount[0].n}`);
    console.log("");

    const { rows: clinicList } = await client.query<{
      name: string;
      city: string | null;
      state: string | null;
      business_id: string;
      business_name: string;
    }>(
      `SELECT c.name, c.city, c.state, c.business_id, b.name AS business_name
       FROM clinics c
       JOIN businesses b ON b.id = c.business_id
       ORDER BY b.name, c.name`
    );
    console.log("clinic | city | state | business");
    for (const r of clinicList) {
      console.log(
        `  ${r.name} | ${r.city ?? "—"} | ${r.state ?? "—"} | ${r.business_name}`
      );
    }
    console.log("");

    // Multi-address: businesses with >1 clinic.
    const { rows: multi } = await client.query<{
      business_id: string;
      business_name: string;
      clinic_count: number;
    }>(
      `SELECT b.id AS business_id, b.name AS business_name,
              COUNT(c.id)::int AS clinic_count
       FROM businesses b
       JOIN clinics c ON c.business_id = b.id
       GROUP BY b.id, b.name
       HAVING COUNT(c.id) > 1
       ORDER BY clinic_count DESC, b.name`
    );
    if (multi.length === 0) {
      console.log("multi-clinic businesses: NONE (every business has exactly 1 clinic)");
    } else {
      console.log(`multi-clinic businesses: ${multi.length}`);
      for (const m of multi) {
        console.log(`  ${m.business_name} → ${m.clinic_count} clinics`);
      }
    }
    console.log("");

    // ── 2. clinic_services ────────────────────────────────────────────────────
    const { rows: csTotal } = await client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM clinic_services`
    );
    const { rows: csByStatus } = await client.query<{
      match_status: string | null;
      n: number;
    }>(
      `SELECT match_status, COUNT(*)::int AS n
       FROM clinic_services
       GROUP BY match_status
       ORDER BY match_status`
    );

    console.log("── 2. clinic_services ───────────────────────────────────");
    console.log(`total: ${csTotal[0].n}`);
    for (const r of csByStatus) {
      console.log(`  ${r.match_status ?? "(null)"}: ${r.n}`);
    }
    console.log("");

    // Consistency: matched/auto must have non-null service_id; unmatched NULL.
    const { rows: badMatched } = await client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM clinic_services
       WHERE match_status IN ('matched','auto') AND service_id IS NULL`
    );
    const { rows: badUnmatched } = await client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM clinic_services
       WHERE match_status = 'unmatched' AND service_id IS NOT NULL`
    );
    console.log(
      `matched/auto rows with NULL service_id (should be 0): ${badMatched[0].n}`
    );
    console.log(
      `unmatched rows with non-null service_id (should be 0): ${badUnmatched[0].n}`
    );
    console.log("");

    // ── 3. reviews / before_after / concern_services ──────────────────────────
    const { rows: reviewCount } = await client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM reviews`
    );
    const { rows: baCount } = await client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM images WHERE role = 'before_after'`
    );
    const { rows: csLinkCount } = await client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM concern_services`
    );

    console.log("── 3. reviews / before_after / concern_services ─────────");
    console.log(`reviews:              ${reviewCount[0].n}`);
    console.log(`before_after images:  ${baCount[0].n}`);
    console.log(`concern_services:     ${csLinkCount[0].n}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("verify-ingest failed:", err);
  process.exit(1);
});
