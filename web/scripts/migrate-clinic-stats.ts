/**
 * migrate-clinic-stats.ts — run with: bun scripts/migrate-clinic-stats.ts
 *
 * Additive migration for admin-editable hero stats on the clinic page.
 * Extends: clinics
 *
 * Adds five nullable display-override columns. Each stores the exact string
 * shown in the "About + Stats" row (e.g. "20+", "10k+", "5.0"). When NULL, the
 * clinic page falls back to its existing computed/hardcoded value, so existing
 * clinics are unaffected.
 *
 * NON-DESTRUCTIVE: only ADD COLUMN IF NOT EXISTS.
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

    // ── CLINICS ───────────────────────────────────────────────────────────────
    console.log("⏳ clinics (hero stats)...");
    await client.query(`
      ALTER TABLE clinics
        ADD COLUMN IF NOT EXISTS stat_experts TEXT,
        ADD COLUMN IF NOT EXISTS stat_cities TEXT,
        ADD COLUMN IF NOT EXISTS stat_treatments TEXT,
        ADD COLUMN IF NOT EXISTS stat_rating TEXT,
        ADD COLUMN IF NOT EXISTS stat_patients TEXT
    `);

    await client.query("COMMIT");
    console.log("✅ migrate-clinic-stats complete: clinics extended with stat_* columns");
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
