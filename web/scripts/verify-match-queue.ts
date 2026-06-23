/**
 * verify-match-queue.ts — run with: bun scripts/verify-match-queue.ts
 *
 * READ-ONLY verification of the unmatched / review queue.
 * Performs NO writes. Mirrors the pool setup used by the migrate-* scripts.
 *
 *   1. DISTINCT unmatched raw_names (match_status='unmatched' OR service_id IS NULL)
 *      with the clinic count per name — the admin "Unmatched" queue.
 *   2. Confirm every clinic_services row still has its raw_name preserved.
 *   3. Sanity: one matched raw_name resolves to its canonical service.
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

async function verify() {
  const client = await pool.connect();
  try {
    // ── 1. UNMATCHED QUEUE ──────────────────────────────────────────────────
    console.log("── 1. Unmatched queue (DISTINCT raw_name → clinic count) ──");
    const unmatched = await client.query<{
      raw_name: string;
      clinic_count: string;
      total_rows: string;
    }>(`
      SELECT
        raw_name,
        COUNT(DISTINCT clinic_id) AS clinic_count,
        COUNT(*)                  AS total_rows
      FROM clinic_services
      WHERE match_status = 'unmatched' OR service_id IS NULL
      GROUP BY raw_name
      ORDER BY clinic_count DESC, raw_name ASC
    `);
    if (unmatched.rowCount === 0) {
      console.log("   none");
    } else {
      for (const r of unmatched.rows) {
        console.log(
          `   ${r.clinic_count.padStart(4)} clinics | ${r.total_rows.padStart(4)} rows | ${r.raw_name}`
        );
      }
      console.log(`   (${unmatched.rowCount} distinct unmatched raw_names)`);
    }

    // ── 2. NO DROPPED raw_name ──────────────────────────────────────────────
    console.log("\n── 2. raw_name preservation ──");
    const counts = await client.query<{
      total: string;
      null_raw: string;
      empty_raw: string;
    }>(`
      SELECT
        COUNT(*)                                              AS total,
        COUNT(*) FILTER (WHERE raw_name IS NULL)              AS null_raw,
        COUNT(*) FILTER (WHERE btrim(raw_name) = '')         AS empty_raw
      FROM clinic_services
    `);
    const c = counts.rows[0];
    console.log(`   total clinic_services rows : ${c.total}`);
    console.log(`   rows with NULL raw_name    : ${c.null_raw}`);
    console.log(`   rows with empty raw_name   : ${c.empty_raw}`);
    console.log(
      c.null_raw === "0" && c.empty_raw === "0"
        ? "   ✅ every row preserves a raw_name"
        : "   ❌ some rows are missing raw_name"
    );

    // ── 3. SANITY: one matched row resolves to a canonical service ──────────
    console.log("\n── 3. Sanity: a matched raw_name → canonical service ──");
    const matched = await client.query<{
      raw_name: string;
      service_id: string;
      canonical_name: string;
      canonical_slug: string;
      match_status: string | null;
      match_confidence: string | null;
    }>(`
      SELECT
        cs.raw_name,
        cs.service_id,
        sv.name AS canonical_name,
        sv.slug AS canonical_slug,
        cs.match_status,
        cs.match_confidence
      FROM clinic_services cs
      JOIN services sv ON sv.id = cs.service_id
      WHERE cs.service_id IS NOT NULL
        AND cs.match_status <> 'unmatched'
      ORDER BY cs.match_confidence DESC NULLS LAST, cs.raw_name ASC
      LIMIT 1
    `);
    if (matched.rowCount === 0) {
      console.log("   none (no matched rows found)");
    } else {
      const m = matched.rows[0];
      console.log(`   raw_name        : ${m.raw_name}`);
      console.log(`   → canonical     : ${m.canonical_name} (slug: ${m.canonical_slug})`);
      console.log(`   service_id      : ${m.service_id}`);
      console.log(`   match_status    : ${m.match_status}`);
      console.log(`   match_confidence: ${m.match_confidence}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

verify();
