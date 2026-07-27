/**
 * db-setup.ts — the ONE way to bring a database up to the app's expected state.
 *
 *   bun scripts/db-setup.ts            (or: bun run db:setup)
 *
 * Invoked automatically at container startup by ../start.sh, so a redeploy
 * leaves a fresh database correct and an existing one untouched.
 *
 * Three steps, in order:
 *   1. SCHEMA — applies db/schema.sql, but ONLY on a database that doesn't have
 *      it yet. schema.sql is a pg_dump baseline (plain `CREATE TABLE`), so
 *      re-running it on a populated database errors; the guard below is what
 *      makes this script safe to run on every boot.
 *   2. TAXONOMY — applies db/seed.sql (the curated 15 services + 10 concerns).
 *      Every row is ON CONFLICT DO NOTHING, so this runs every time.
 *   3. ADMIN — upserts one admin user from env, ON CONFLICT (email) DO NOTHING
 *      so a rotated password is never clobbered.
 *
 * NOT a migration tool: it cannot converge an *existing* database onto a
 * changed schema (new column, changed type). Until a migration ledger lands,
 * schema changes must be applied to production by hand. See TASKS.md.
 *
 * Env:
 *   DATABASE_URL          (required)
 *   SEED_ADMIN_EMAIL      (recommended — defaults to admin@medspa.com)
 *   SEED_ADMIN_PASSWORD   (recommended — defaults to a placeholder; CHANGE IT)
 *
 * Flags:
 *   --force   apply schema.sql even if the guard says it is already present.
 *             Only meaningful against an empty database.
 *
 * The role must be allowed to CREATE EXTENSION (postgis, pg_trgm, unaccent,
 * pgcrypto, uuid-ossp) — Neon and rds_superuser both are.
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

const force = process.argv.includes("--force");

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@medspa.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "ChangeMe!123";
if (!process.env.SEED_ADMIN_EMAIL || !process.env.SEED_ADMIN_PASSWORD) {
  console.warn(
    "⚠ SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — using default admin credentials. " +
      "Set them in the deployment environment for production.",
  );
}

/**
 * pg_dump emits psql meta-commands (`\restrict`, `\unrestrict`, `\connect`)
 * that are NOT SQL — sending them over the wire is a syntax error. They are
 * stripped from the committed schema.sql, and stripped again here so a
 * freshly-regenerated dump can't silently break container boot.
 */
function stripPsqlMeta(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !/^\\[a-z]/i.test(line))
    .join("\n");
}

function readSql(name: string): string {
  return stripPsqlMeta(readFileSync(new URL(`../db/${name}`, import.meta.url), "utf8"));
}

const schemaSql = readSql("schema.sql");
const seedSql = readSql("seed.sql");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("sslmode=disable")
    ? false
    : { rejectUnauthorized: false },
});

async function setup() {
  const client = await pool.connect();
  try {
    const { rows: guard } = await client.query(
      "SELECT to_regclass('public.services') IS NOT NULL AS applied",
    );

    if (guard[0].applied && !force) {
      console.log("• Schema already present — skipping db/schema.sql.");
    } else {
      console.log("→ Applying db/schema.sql (extensions, tables, functions, triggers, matview) …");
      await client.query(schemaSql);
    }

    // schema.sql (a pg_dump) sets search_path to '' for the whole session, so
    // every unqualified statement after it would fail to resolve. Put it back.
    await client.query("SET search_path TO public");

    console.log("→ Seeding canonical taxonomy (15 services, 10 concerns) …");
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
         (SELECT count(*) FROM services)    AS services,
         (SELECT count(*) FROM concerns)    AS concerns,
         (SELECT count(*) FROM admin_users) AS admins`,
    );
    const c = rows[0];
    console.log(
      `✓ Database ready. tables=${c.tables} services=${c.services} concerns=${c.concerns} admins=${c.admins}`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

setup().catch((err) => {
  console.error("✗ db-setup failed:", err.message);
  process.exit(1);
});
