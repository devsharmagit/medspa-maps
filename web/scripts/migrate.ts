/**
 * migrate.ts — bring the database to the correct, fully-seeded state.
 *
 *   bun scripts/migrate.ts
 *
 * This is invoked automatically at container startup by ../start.sh, so a push
 * to main (which rebuilds + redeploys the image) leaves the database correct.
 *
 * It is IDEMPOTENT and NON-DESTRUCTIVE — safe to run on every start:
 *   • schema.sql converges the schema:
 *       CREATE EXTENSION/TABLE/INDEX IF NOT EXISTS, ALTER TABLE ADD COLUMN
 *       IF NOT EXISTS (this backfills columns like services.summary that an
 *       older/partial database is missing), CREATE OR REPLACE FUNCTION,
 *       DROP+CREATE TRIGGER, and a rebuilt clinic_search_view.
 *       It never drops a data table, so existing rows are preserved.
 *   • seed.sql inserts the 15 services / 10 concerns / 34 links with
 *       ON CONFLICT DO NOTHING — re-runs never duplicate.
 *   • the admin user is upserted from env (ON CONFLICT (email) DO NOTHING),
 *       so a rotated password is never overwritten.
 *
 * Env:
 *   DATABASE_URL          (required)
 *   SEED_ADMIN_EMAIL      (recommended — defaults to admin@medspa.com)
 *   SEED_ADMIN_PASSWORD   (recommended — defaults to a placeholder; CHANGE IT)
 *
 * Extensions (postgis, uuid-ossp, pg_trgm, unaccent, pgcrypto) are created via
 * CREATE EXTENSION IF NOT EXISTS; the DB role must be allowed to create them
 * (on RDS: rds_superuser, or have them pre-created by the DBA).
 */
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error("✗ DATABASE_URL is not set");
  process.exit(1);
}

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@medspa.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "ChangeMe!123";
if (!process.env.SEED_ADMIN_EMAIL || !process.env.SEED_ADMIN_PASSWORD) {
  console.warn(
    "⚠ SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — using default admin credentials. " +
      "Set them in the deployment environment (ECS task definition) for production.",
  );
}

const schemaSql = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const seedSql = readFileSync(new URL("./seed.sql", import.meta.url), "utf8");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("→ Applying schema (idempotent converge) …");
    await client.query(schemaSql);

    console.log("→ Seeding taxonomy (15 services, 10 concerns, 34 links) …");
    await client.query(seedSql);

    console.log("→ Seeding admin user …");
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await client.query(
      `INSERT INTO admin_users (email, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING`,
      [ADMIN_EMAIL, hash],
    );

    const { rows } = await client.query(
      `SELECT
         (SELECT count(*) FROM information_schema.tables
            WHERE table_schema='public' AND table_type='BASE TABLE') AS tables,
         (SELECT count(*) FROM services)         AS services,
         (SELECT count(*) FROM concerns)         AS concerns,
         (SELECT count(*) FROM concern_services) AS links,
         (SELECT count(*) FROM admin_users)      AS admins`,
    );
    const c = rows[0];
    console.log(
      `✓ Database ready. tables=${c.tables} services=${c.services} concerns=${c.concerns} links=${c.links} admins=${c.admins}`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("✗ Migration failed:", err.message);
  process.exit(1);
});
