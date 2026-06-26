/**
 * migrate-providers.ts — run with: bun scripts/migrate-providers.ts
 *
 * Adds the `providers` and `provider_services` tables.
 * Safe to run on an existing production database — uses CREATE TABLE IF NOT EXISTS.
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

    // ── PROVIDERS ──────────────────────────────────────────────────────────────
    console.log("⏳ Creating providers table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS providers (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        clinic_id       UUID NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
        name            TEXT NOT NULL,
        title           TEXT,
        bio             TEXT,
        image_url       TEXT,
        years_experience INTEGER,
        is_verified     BOOLEAN NOT NULL DEFAULT false,
        highlights      JSONB NOT NULL DEFAULT '[]',
        credentials     JSONB NOT NULL DEFAULT '[]',
        specialties     JSONB NOT NULL DEFAULT '[]',
        is_active       BOOLEAN NOT NULL DEFAULT true,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_providers_clinic_id ON providers (clinic_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_providers_is_active ON providers (is_active)`
    );

    await client.query(
      `DROP TRIGGER IF EXISTS trg_providers_updated_at ON providers`
    );
    await client.query(`
      CREATE TRIGGER trg_providers_updated_at
      BEFORE UPDATE ON providers
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);
    console.log("✓ providers table ready");

    // ── PROVIDER_SERVICES ─────────────────────────────────────────────────────
    console.log("⏳ Creating provider_services table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS provider_services (
        provider_id UUID NOT NULL REFERENCES providers (id) ON DELETE CASCADE,
        service_id  UUID NOT NULL REFERENCES clinic_services (id) ON DELETE CASCADE,
        PRIMARY KEY (provider_id, service_id)
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_provider_services_provider ON provider_services (provider_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_provider_services_service ON provider_services (service_id)`
    );
    console.log("✓ provider_services table ready");

    await client.query("COMMIT");
    console.log(`
✅ Providers migration complete!

Tables created/ensured:
  • providers          — provider profiles linked to a clinic
  • provider_services  — many-to-many: provider ↔ clinic_service

Next steps:
  1. Use the Admin UI to add providers via /admin/clinics/<id>/providers/new
  2. Verify records in the database with: SELECT * FROM providers LIMIT 10;
    `);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
