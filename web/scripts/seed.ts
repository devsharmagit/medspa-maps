/**
 * Seed script — run with: bun scripts/seed.ts
 *
 * Creates:
 *   - admin_users table
 *   - businesses table
 *   - One seed admin user: admin@medspa.com / Admin1234!
 */

import { Pool } from "pg";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function seed() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── admin_users ──────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email         TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    console.log("✓ admin_users table ready");

    // ── businesses ───────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS businesses (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        TEXT NOT NULL,
        website_url TEXT NOT NULL UNIQUE,
        is_active   BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    console.log("✓ businesses table ready");

    // ── Seed admin user ───────────────────────────────────────────────────────
    const SEED_EMAIL = "admin@medspa.com";
    const SEED_PASSWORD = "Admin1234!";

    const existing = await client.query(
      "SELECT id FROM admin_users WHERE email = $1",
      [SEED_EMAIL]
    );

    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash(SEED_PASSWORD, 12);
      await client.query(
        "INSERT INTO admin_users (email, password_hash) VALUES ($1, $2)",
        [SEED_EMAIL, hash]
      );
      console.log(`✓ Seed admin created — email: ${SEED_EMAIL}  password: ${SEED_PASSWORD}`);
    } else {
      console.log("ℹ  Seed admin already exists — skipping insert");
    }

    await client.query("COMMIT");
    console.log("\n✅ Seed complete!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Seed failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
