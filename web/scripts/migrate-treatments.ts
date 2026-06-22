/**
 * migrate-treatments.ts — run with: bun scripts/migrate-treatments.ts
 *
 * Additive migration for the treatment editorial pages feature.
 * Extends: services, clinic_services
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

    // ── 1. SERVICES ─────────────────────────────────────────────────────────
    console.log("⏳ services...");
    await client.query(`
      ALTER TABLE services
        ADD COLUMN IF NOT EXISTS summary TEXT,
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS price_from NUMERIC,
        ADD COLUMN IF NOT EXISTS price_unit TEXT,
        ADD COLUMN IF NOT EXISTS treatment_time TEXT,
        ADD COLUMN IF NOT EXISTS results_timeline TEXT,
        ADD COLUMN IF NOT EXISTS results_duration TEXT,
        ADD COLUMN IF NOT EXISTS recovery_time TEXT,
        ADD COLUMN IF NOT EXISTS aliases TEXT[],
        ADD COLUMN IF NOT EXISTS hero_rating NUMERIC(3,2),
        ADD COLUMN IF NOT EXISTS hero_review_count INTEGER,
        ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true
    `);

    // ── 2. CLINIC_SERVICES ──────────────────────────────────────────────────
    console.log("⏳ clinic_services...");
    await client.query(`
      ALTER TABLE clinic_services
        ADD COLUMN IF NOT EXISTS price_from NUMERIC,
        ADD COLUMN IF NOT EXISTS price_unit TEXT
    `);

    await client.query("COMMIT");
    console.log("✅ migrate-treatments complete: services + clinic_services extended");
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
