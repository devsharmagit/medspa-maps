/**
 * migrate-match-queue.ts — run with: bun scripts/migrate-match-queue.ts
 *
 * Additive migration for the service match / review queue feature.
 * Extends: clinic_services, services
 *
 * NON-DESTRUCTIVE: only ADD COLUMN IF NOT EXISTS.
 * Existing data tables and columns are never dropped or altered destructively.
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

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── 1. CLINIC_SERVICES ──────────────────────────────────────────────────
    // match_status: matched | auto | unmatched
    // match_confidence: numeric score from the matcher (nullable)
    console.log("⏳ clinic_services...");
    await client.query(`
      ALTER TABLE clinic_services
        ADD COLUMN IF NOT EXISTS match_status TEXT DEFAULT 'unmatched',
        ADD COLUMN IF NOT EXISTS match_confidence NUMERIC
    `);

    // ── 2. SERVICES ─────────────────────────────────────────────────────────
    // review_status: approved | pending
    console.log("⏳ services...");
    await client.query(`
      ALTER TABLE services
        ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'approved'
    `);

    await client.query("COMMIT");
    console.log("✅ migrate-match-queue complete: clinic_services + services extended");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
