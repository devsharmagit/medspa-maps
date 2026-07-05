/**
 * db-seed.ts — seed canonical taxonomy + the admin user.
 *
 *   bun scripts/db-seed.ts             (or: bun run db:seed)
 *
 * Taxonomy (15 services, 10 concerns, 34 concern<->service links):
 *   applies db/seed.sql — idempotent (ON CONFLICT DO NOTHING), safe to re-run,
 *   never creates duplicates.
 *
 * Admin user:
 *   reads SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD, hashes with bcrypt (cost 12),
 *   inserts ON CONFLICT (email) DO NOTHING — will NOT overwrite an existing
 *   (e.g. rotated) password. To reset a password, change it in the app/admin.
 *
 * Requires: DATABASE_URL, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD.
 */
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";

dotenv.config();

const { DATABASE_URL, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } = process.env;

const missing = (
  [
    ["DATABASE_URL", DATABASE_URL],
    ["SEED_ADMIN_EMAIL", SEED_ADMIN_EMAIL],
    ["SEED_ADMIN_PASSWORD", SEED_ADMIN_PASSWORD],
  ] as const
)
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length) {
  console.error(`✗ Missing required env: ${missing.join(", ")}`);
  process.exit(1);
}

const seedSql = readFileSync(new URL("../db/seed.sql", import.meta.url), "utf8");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function seed() {
  const client = await pool.connect();
  try {
    console.log("→ Seeding taxonomy (services, concerns, links) …");
    await client.query(seedSql);

    console.log("→ Seeding admin user …");
    const hash = await bcrypt.hash(SEED_ADMIN_PASSWORD as string, 12);
    await client.query(
      `INSERT INTO admin_users (email, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING`,
      [SEED_ADMIN_EMAIL, hash],
    );

    const { rows } = await client.query(
      `SELECT
         (SELECT count(*) FROM services)         AS services,
         (SELECT count(*) FROM concerns)         AS concerns,
         (SELECT count(*) FROM concern_services) AS links,
         (SELECT count(*) FROM admin_users)      AS admins`,
    );
    const c = rows[0];
    console.log(
      `✓ Seeded. services=${c.services} concerns=${c.concerns} links=${c.links} admins=${c.admins}`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("✗ Seed failed:", err.message);
  process.exit(1);
});
