/**
 * migrate-clinic-page.ts — run with: bun scripts/migrate-clinic-page.ts
 *
 * Additive migration for the clinic page feature.
 * Extends: clinics
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

    // ── CLINICS ───────────────────────────────────────────────────────────────
    console.log("⏳ clinics...");
    await client.query(`
      ALTER TABLE clinics
        ADD COLUMN IF NOT EXISTS ext_rating NUMERIC(3,2),
        ADD COLUMN IF NOT EXISTS ext_review_count INTEGER,
        ADD COLUMN IF NOT EXISTS tagline TEXT,
        ADD COLUMN IF NOT EXISTS founded_year INTEGER
    `);

    await client.query("COMMIT");
    console.log("✅ migrate-clinic-page complete: clinics extended");
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
