/**
 * migrate-provider-concerns.ts — run with: bun scripts/migrate-provider-concerns.ts
 *
 * Adds the `provider_concerns` table: a many-to-many link between a provider and
 * the priority concerns they treat. Combined with the existing `provider_services`
 * (provider ↔ canonical treatment) link, this lets an admin define exactly which
 * concerns and treatments a provider covers, which in turn drives the public
 * concern page's "Doctors & Providers" list.
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

    console.log("⏳ Creating provider_concerns table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS provider_concerns (
        provider_id UUID NOT NULL REFERENCES providers (id) ON DELETE CASCADE,
        concern_id  UUID NOT NULL REFERENCES concerns (id) ON DELETE CASCADE,
        PRIMARY KEY (provider_id, concern_id)
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_provider_concerns_provider ON provider_concerns (provider_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_provider_concerns_concern ON provider_concerns (concern_id)`
    );
    console.log("✓ provider_concerns table ready");

    await client.query("COMMIT");
    console.log(`
✅ provider_concerns migration complete!

  • provider_concerns — many-to-many: provider ↔ concern
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
