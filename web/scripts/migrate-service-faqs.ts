/**
 * migrate-service-faqs.ts
 *
 * Adds a `faqs` JSONB column to the `services` table so that treatments
 * can store FAQ entries identical to the existing `concerns.faqs` column.
 *
 * Usage:  bun scripts/migrate-service-faqs.ts
 */

import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log("Adding faqs column to services table…");

  await pool.query(`
    ALTER TABLE services
    ADD COLUMN IF NOT EXISTS faqs JSONB DEFAULT '[]';
  `);

  console.log("✓ services.faqs column added (or already exists).");

  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
