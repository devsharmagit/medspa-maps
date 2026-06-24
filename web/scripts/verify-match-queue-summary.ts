/**
 * verify-match-queue-summary.ts — run with: bun scripts/verify-match-queue-summary.ts
 *
 * READ-ONLY. Aggregate breakdown of clinic_services by match_status and
 * service_id presence. No writes. Mirrors migrate-* pool setup.
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

async function run() {
  const client = await pool.connect();
  try {
    const byStatus = await client.query<{
      match_status: string | null;
      has_service: boolean;
      rows: string;
    }>(`
      SELECT match_status, (service_id IS NOT NULL) AS has_service, COUNT(*) AS rows
      FROM clinic_services
      GROUP BY match_status, (service_id IS NOT NULL)
      ORDER BY match_status NULLS FIRST, has_service
    `);
    console.log("── clinic_services breakdown (match_status × has service_id) ──");
    for (const r of byStatus.rows) {
      console.log(
        `   status=${String(r.match_status).padEnd(10)} has_service_id=${String(r.has_service).padEnd(5)} → ${r.rows} rows`
      );
    }

    const totals = await client.query<{
      total: string;
      queue_rows: string;
      queue_distinct: string;
    }>(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE match_status = 'unmatched' OR service_id IS NULL) AS queue_rows,
        COUNT(DISTINCT raw_name) FILTER (WHERE match_status = 'unmatched' OR service_id IS NULL) AS queue_distinct
      FROM clinic_services
    `);
    const t = totals.rows[0];
    console.log("\n── totals ──");
    console.log(`   total clinic_services rows : ${t.total}`);
    console.log(`   unmatched-queue rows       : ${t.queue_rows}`);
    console.log(`   unmatched-queue DISTINCT   : ${t.queue_distinct} raw_names`);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
