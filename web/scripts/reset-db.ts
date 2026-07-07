/**
 * reset-db.ts — run with: bun scripts/reset-db.ts
 *
 * Truncates ONLY the content/data tables for a clean re-ingest.
 * Uses TRUNCATE ... RESTART IDENTITY CASCADE inside a transaction.
 *
 * PRESERVES admin_users (admin login) — it is NEVER touched.
 * Does NOT drop any table, the schema, or migration state.
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

// Content data tables to wipe. admin_users is intentionally excluded.
// listing_claims cascades from businesses, but is listed explicitly for clarity;
// medspa_leads has no FK so it MUST be listed to be cleared.
const DATA_TABLES = [
  "concern_services",
  "concerns",
  "reviews",
  "clinic_services",
  "images",
  "clinics",
  "businesses",
  "services",
  "listing_claims",
  "medspa_leads",
];

async function counts(client: any, tables: string[]) {
  const result: Record<string, number> = {};
  for (const t of tables) {
    const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
    result[t] = rows[0].n;
  }
  return result;
}

async function reset() {
  const client = await pool.connect();
  try {
    console.log("📊 Row counts BEFORE reset:");
    const before = await counts(client, [...DATA_TABLES, "admin_users"]);
    for (const [t, n] of Object.entries(before)) {
      console.log(`  ${t}: ${n}`);
    }

    await client.query("BEGIN");

    console.log(`⏳ Truncating ${DATA_TABLES.length} data tables (RESTART IDENTITY CASCADE)...`);
    await client.query(
      `TRUNCATE TABLE ${DATA_TABLES.join(", ")} RESTART IDENTITY CASCADE`
    );

    await client.query("COMMIT");
    console.log("✓ Truncate committed");

    console.log("📊 Row counts AFTER reset:");
    const after = await counts(client, [...DATA_TABLES, "admin_users"]);
    for (const [t, n] of Object.entries(after)) {
      console.log(`  ${t}: ${n}`);
    }

    console.log(`✅ reset-db complete. admin_users preserved (${after.admin_users} rows).`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ reset failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

reset();
