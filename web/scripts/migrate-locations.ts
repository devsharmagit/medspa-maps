/**
 * migrate-locations.ts — run with: bun scripts/migrate-locations.ts
 *
 * Additive migration: creates the clinic_locations table.
 *
 * clinic_locations stores one row per physical address for a clinic.
 * This replaces the old pattern where multi-location clinics were stored
 * as separate clinic rows named "{bizName} – {city}".
 *
 * NON-DESTRUCTIVE: does not alter or drop any existing tables/columns.
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

    // ── Enable extensions (idempotent) ───────────────────────────────────────
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    let hasPostgis = false;
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS "postgis"`);
      hasPostgis = true;
    } catch {
      console.log("  ⚠ PostGIS not available — geo column will be TEXT");
    }

    const geoType = hasPostgis ? "GEOGRAPHY(POINT, 4326)" : "TEXT";

    // ── clinic_locations table ────────────────────────────────────────────────
    console.log("⏳ Creating clinic_locations table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS clinic_locations (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
        label         TEXT,
        address       TEXT,
        city          TEXT,
        state         TEXT,
        zip           TEXT,
        country       TEXT NOT NULL DEFAULT 'US',
        lat           NUMERIC(10, 7),
        lng           NUMERIC(10, 7),
        geo           ${geoType},
        phone         TEXT,
        email         TEXT,
        booking_url   TEXT,
        google_maps_url TEXT,
        google_place_id TEXT,
        hours         JSONB,
        is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order    INTEGER NOT NULL DEFAULT 0,
        is_active     BOOLEAN NOT NULL DEFAULT TRUE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── Indexes ───────────────────────────────────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_clinic_locations_clinic
        ON clinic_locations (clinic_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_clinic_locations_city
        ON clinic_locations (lower(city))
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_clinic_locations_state
        ON clinic_locations (state)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_clinic_locations_primary
        ON clinic_locations (clinic_id) WHERE is_primary = TRUE
    `);

    if (hasPostgis) {
      try {
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_clinic_locations_geo
            ON clinic_locations USING GIST (geo) WHERE geo IS NOT NULL
        `);
      } catch {
        console.log("  ⚠ Could not create PostGIS index on clinic_locations.geo");
      }
    }

    // ── updated_at trigger (reuse the existing set_updated_at function) ─────
    await client.query(`
      DROP TRIGGER IF EXISTS trg_clinic_locations_updated_at ON clinic_locations
    `);
    await client.query(`
      CREATE TRIGGER trg_clinic_locations_updated_at
        BEFORE UPDATE ON clinic_locations
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);

    await client.query("COMMIT");
    console.log("✅ migrate-locations complete: clinic_locations table created");
    console.log("");
    console.log("Next step: bun scripts/fix-multilocation-clinics.ts --dry-run");
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
