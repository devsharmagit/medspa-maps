/**
 * db-migrate.ts — create the full schema on a fresh (empty) database.
 *
 *   bun scripts/db-migrate.ts          (or: bun run db:migrate)
 *
 * Applies db/schema.sql exactly as exported from the canonical database:
 * all 6 extensions, every table, the 3 functions + 14 triggers, all indexes,
 * and the clinic_search_view materialized view (created + refreshed).
 *
 * Guard: if the schema is already present it skips (idempotent, no error).
 * Pass --force to run schema.sql anyway (only meaningful on an empty DB).
 *
 * Requires: DATABASE_URL. The target Postgres must allow CREATE EXTENSION for
 * postgis, pg_trgm, unaccent, pgcrypto, uuid-ossp (Neon does by default).
 */
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error("✗ DATABASE_URL is not set");
  process.exit(1);
}

const force = process.argv.includes("--force");
const schemaSql = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT to_regclass('public.services') IS NOT NULL AS applied",
    );
    if (rows[0].applied && !force) {
      console.log("• Schema already present — skipping. Use --force to re-apply on an empty DB.");
      return;
    }
    console.log("→ Applying db/schema.sql …");
    await client.query(schemaSql);
    console.log("✓ Schema applied: extensions, tables, functions, triggers, indexes, matview.");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("✗ Migration failed:", err.message);
  process.exit(1);
});
