/**
 * migrate-clinic-concerns.ts — run with: bun scripts/migrate-clinic-concerns.ts
 *
 * Adds the `clinic_concerns` table: a per-clinic override of which priority
 * concerns a clinic treats. This lets an admin add/remove concerns for a clinic
 * INDEPENDENTLY of the taxonomy-derived (treatment → concern) mapping.
 *
 *   source = 'manual'  → admin explicitly added this concern
 *   source = 'removed' → admin explicitly removed an otherwise-derived concern
 *
 * Public concern/clinic listings read: (derived concerns ∪ manual) minus removed.
 *
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

    console.log("⏳ Creating clinic_concerns table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS clinic_concerns (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        clinic_id   UUID NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
        concern_id  UUID NOT NULL REFERENCES concerns (id) ON DELETE CASCADE,
        source      TEXT NOT NULL DEFAULT 'manual',
        is_active   BOOLEAN NOT NULL DEFAULT true,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (clinic_id, concern_id)
      )
    `);

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_clinic_concerns_clinic ON clinic_concerns (clinic_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_clinic_concerns_concern ON clinic_concerns (concern_id)`
    );

    await client.query(
      `DROP TRIGGER IF EXISTS trg_clinic_concerns_updated_at ON clinic_concerns`
    );
    await client.query(`
      CREATE TRIGGER trg_clinic_concerns_updated_at
      BEFORE UPDATE ON clinic_concerns
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);
    console.log("✓ clinic_concerns table ready");

    await client.query("COMMIT");
    console.log(`
✅ clinic_concerns migration complete!

  • clinic_concerns — per-clinic manual concern overrides
      source='manual'  adds a concern
      source='removed' suppresses a derived concern
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
