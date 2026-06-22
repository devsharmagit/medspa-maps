/**
 * migrate-concerns.ts — run with: bun scripts/migrate-concerns.ts
 *
 * Additive migration for the concern/service editorial pages feature.
 * Creates: concerns, concern_services, reviews
 * Plus a trigger that keeps clinics.avg_rating / review_count in sync.
 *
 * NON-DESTRUCTIVE: only CREATE ... IF NOT EXISTS + ADD COLUMN IF NOT EXISTS.
 * Existing data tables (businesses, clinics, services, clinic_services,
 * images) are never dropped.
 *
 * images already has flexible TEXT entity_type/role columns, so before/after
 * images are stored as entity_type='concern'|'service', role='before_after'
 * with no schema change required.
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

    // ── helper functions are assumed to exist (slugify, set_updated_at) ──────
    // Recreate defensively in case this runs on a fresh DB.
    await client.query(`
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
      $$ LANGUAGE plpgsql
    `);

    // ── 1. CONCERNS ─────────────────────────────────────────────────────────
    console.log("⏳ concerns...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS concerns (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        overview TEXT,
        details JSONB,              -- { signs, causes, candidate, results, treatment_areas, benefits, ... }
        faqs JSONB,                 -- [{ q, a }]
        meta_title TEXT,
        meta_description TEXT,
        schema_markup JSONB,
        data_source TEXT NOT NULL DEFAULT 'scraped',
        source_url TEXT,
        is_published BOOLEAN NOT NULL DEFAULT true,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_concerns_slug ON concerns (slug)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_concerns_published ON concerns (is_published, is_active)`);
    await client.query(`DROP TRIGGER IF EXISTS trg_concerns_updated_at ON concerns`);
    await client.query(`
      CREATE TRIGGER trg_concerns_updated_at BEFORE UPDATE ON concerns
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);

    // ── 2. CONCERN_SERVICES (junction) ──────────────────────────────────────
    console.log("⏳ concern_services...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS concern_services (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        concern_id UUID NOT NULL REFERENCES concerns (id) ON DELETE CASCADE,
        service_id UUID NOT NULL REFERENCES services (id) ON DELETE CASCADE,
        display_order SMALLINT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (concern_id, service_id)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_concern_services_concern ON concern_services (concern_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_concern_services_service ON concern_services (service_id)`);

    // ── 3. REVIEWS ──────────────────────────────────────────────────────────
    console.log("⏳ reviews...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        clinic_id UUID REFERENCES clinics (id) ON DELETE CASCADE,
        provider_id UUID,                              -- no providers table yet; nullable
        service_id UUID REFERENCES services (id) ON DELETE SET NULL,
        concern_id UUID REFERENCES concerns (id) ON DELETE SET NULL,
        rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
        body TEXT,
        reviewer_name TEXT,
        source TEXT NOT NULL DEFAULT 'scraped',         -- 'scraped' | 'google' | 'internal'
        source_url TEXT,
        content_hash TEXT UNIQUE,                        -- dedup key
        is_approved BOOLEAN NOT NULL DEFAULT true,
        is_active BOOLEAN NOT NULL DEFAULT true,
        g99_review_id BIGINT UNIQUE,
        data_source TEXT NOT NULL DEFAULT 'scraped',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reviews_clinic ON reviews (clinic_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reviews_service ON reviews (service_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reviews_concern ON reviews (concern_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reviews_approved ON reviews (is_approved, is_active)`);
    await client.query(`DROP TRIGGER IF EXISTS trg_reviews_updated_at ON reviews`);
    await client.query(`
      CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON reviews
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);

    // ── 4. clinic rating roll-up trigger ────────────────────────────────────
    console.log("⏳ rating trigger...");
    await client.query(`
      CREATE OR REPLACE FUNCTION refresh_clinic_rating()
      RETURNS TRIGGER AS $$
      DECLARE target UUID;
      BEGIN
        target := COALESCE(NEW.clinic_id, OLD.clinic_id);
        IF target IS NULL THEN RETURN NULL; END IF;
        UPDATE clinics c SET
          avg_rating = sub.avg_rating,
          review_count = sub.cnt
        FROM (
          SELECT
            ROUND(AVG(rating)::numeric, 2) AS avg_rating,
            COUNT(*) AS cnt
          FROM reviews
          WHERE clinic_id = target AND is_approved = true AND is_active = true
            AND rating IS NOT NULL
        ) sub
        WHERE c.id = target;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql
    `);
    await client.query(`DROP TRIGGER IF EXISTS trg_reviews_rating ON reviews`);
    await client.query(`
      CREATE TRIGGER trg_reviews_rating
      AFTER INSERT OR UPDATE OR DELETE ON reviews
      FOR EACH ROW EXECUTE FUNCTION refresh_clinic_rating()
    `);

    await client.query("COMMIT");
    console.log("✅ migrate-concerns complete: concerns, concern_services, reviews + rating trigger");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
