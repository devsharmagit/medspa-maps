/**
 * migrate-treatment-changes.ts — run with: bun scripts/migrate-treatment-changes.ts
 *
 * Additive migration for the daily re-scrape / treatment-change-tracking feature.
 * Creates the clinic_service_changes audit table: one row per canonical
 * treatment that a clinic STARTED ('added') or STOPPED ('removed') offering,
 * as detected by the daily re-scrape cron.
 *
 * A "change" is tracked at the CANONICAL treatment level (the 15 Phase-0
 * treatments): a treatment enters/leaves a clinic's effective offered set.
 * The row snapshots the service slug + name at detection time so the history
 * stays readable even if the taxonomy later changes.
 *
 * NON-DESTRUCTIVE: only CREATE TABLE / INDEX IF NOT EXISTS.
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

    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    console.log("⏳ Creating clinic_service_changes table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS clinic_service_changes (
        id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        clinic_id      UUID NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
        -- Canonical service. Nullable so history survives a service row deletion
        -- (ON DELETE SET NULL); the snapshot columns keep it human-readable.
        service_id     UUID REFERENCES services (id) ON DELETE SET NULL,
        service_slug   TEXT NOT NULL,
        service_name   TEXT NOT NULL,
        -- 'added'  → clinic started offering this treatment
        -- 'removed'→ clinic stopped offering this treatment
        change_type    TEXT NOT NULL CHECK (change_type IN ('added', 'removed')),
        -- provenance / debugging aids
        raw_name       TEXT,
        match_confidence NUMERIC,
        scrape_job_id  UUID REFERENCES scrape_jobs (id) ON DELETE SET NULL,
        detected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_clinic_service_changes_clinic
        ON clinic_service_changes (clinic_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_clinic_service_changes_detected
        ON clinic_service_changes (detected_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_clinic_service_changes_type
        ON clinic_service_changes (change_type)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_clinic_service_changes_service
        ON clinic_service_changes (service_id)
    `);

    await client.query("COMMIT");
    console.log("✅ migrate-treatment-changes complete: clinic_service_changes table created");
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
