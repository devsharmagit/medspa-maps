/**
 * migrate.ts — run with: bun scripts/migrate.ts
 *
 * Applies the full MedSpa Maps production schema.
 * - Drops the old simple `businesses` table (and all data)
 * - Creates all new tables, triggers, views
 * - Leaves `admin_users` untouched
 */

import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Extensions ──────────────────────────────────────────────────────────
    console.log("⏳ Enabling extensions...");
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS "unaccent"`);
    // PostGIS is often pre-installed on Neon but may not be available on all plans
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS "postgis"`);
      console.log("✓ PostGIS enabled");
    } catch {
      console.log("⚠ PostGIS not available — geo column will be skipped");
    }
    console.log("✓ Extensions ready");

    // ── Drop old tables in dependency order ────────────────────────────────
    console.log("⏳ Dropping old tables...");
    // Drop materialized view first if exists
    await client.query(`DROP MATERIALIZED VIEW IF EXISTS clinic_search_view CASCADE`);
    // Drop tables in reverse dependency order
    const tablesToDrop = [
      "listing_claims",
      "concern_services",
      "concerns",
      "reviews",
      "images",
      "clinic_services",
      "service_categories",
      "services",
      "categories",
      "clinic_providers",
      "providers",
      "clinics",
      "businesses", // old table — will be recreated with new schema
    ];
    for (const table of tablesToDrop) {
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }
    // Drop old functions
    await client.query(`DROP FUNCTION IF EXISTS slugify(TEXT) CASCADE`);
    await client.query(`DROP FUNCTION IF EXISTS set_updated_at() CASCADE`);
    await client.query(`DROP FUNCTION IF EXISTS refresh_clinic_rating() CASCADE`);
    console.log("✓ Old tables dropped");

    // ── Utility functions ──────────────────────────────────────────────────
    console.log("⏳ Creating utility functions...");
    await client.query(`
      CREATE OR REPLACE FUNCTION slugify(val TEXT)
      RETURNS TEXT AS $$
        SELECT lower(
          trim(both '-' FROM
            regexp_replace(
              regexp_replace(
                regexp_replace(unaccent(val), '[®™©°]', '', 'g'),
                '[^a-zA-Z0-9\\s\\-]', '', 'g'),
              '\\s+', '-', 'g')
          )
        )
      $$ LANGUAGE SQL IMMUTABLE STRICT
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    console.log("✓ Utility functions created");

    // ── 1. BUSINESSES ──────────────────────────────────────────────────────
    console.log("⏳ Creating businesses table...");
    await client.query(`
      CREATE TABLE businesses (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name                TEXT        NOT NULL,
        slug                TEXT        NOT NULL UNIQUE,
        website_url         TEXT        UNIQUE,
        logo_url            TEXT,
        phone               TEXT,
        email               TEXT,
        address             TEXT,
        city                TEXT,
        state               TEXT,
        country             TEXT        DEFAULT 'US',
        timezone            TEXT,
        instagram_url       TEXT,
        facebook_url        TEXT,
        tier                TEXT        NOT NULL DEFAULT 'free'
                              CHECK (tier IN ('free','featured','elite')),
        tier_expires_at     TIMESTAMPTZ,
        verified            BOOLEAN     NOT NULL DEFAULT FALSE,
        verified_at         TIMESTAMPTZ,
        about               TEXT,
        meta_title          TEXT,
        meta_description    TEXT,
        g99_business_id     BIGINT      UNIQUE,
        g99_tenant_id       BIGINT      UNIQUE,
        data_source         TEXT        NOT NULL DEFAULT 'manual'
                              CHECK (data_source IN ('manual','g99','scraped')),
        last_synced_at      TIMESTAMPTZ,
        is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_by          UUID,
        updated_by          UUID
      )
    `);
    await client.query(`CREATE INDEX idx_businesses_slug ON businesses (slug)`);
    await client.query(`CREATE INDEX idx_businesses_tier ON businesses (tier) WHERE is_active = TRUE`);
    await client.query(`CREATE INDEX idx_businesses_g99_id ON businesses (g99_business_id)`);
    await client.query(`CREATE INDEX idx_businesses_name_trgm ON businesses USING gin (name gin_trgm_ops)`);
    await client.query(`
      CREATE TRIGGER trg_businesses_updated_at
        BEFORE UPDATE ON businesses
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);
    console.log("✓ businesses table created");

    // ── 2. CLINICS ─────────────────────────────────────────────────────────
    console.log("⏳ Creating clinics table...");
    await client.query(`
      CREATE TABLE clinics (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id         UUID        NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
        name                TEXT        NOT NULL,
        slug                TEXT        NOT NULL,
        tagline             TEXT,
        address             TEXT,
        city                TEXT,
        state               TEXT,
        zip                 TEXT,
        country             TEXT        DEFAULT 'US',
        lat                 NUMERIC(9,6),
        lng                 NUMERIC(9,6),
        phone               TEXT,
        email               TEXT,
        website             TEXT,
        booking_url         TEXT,
        instagram_url       TEXT,
        facebook_url        TEXT,
        google_my_business  TEXT,
        google_place_id     TEXT,
        yelp_url            TEXT,
        about               TEXT,
        hours               JSONB,
        tier                TEXT        NOT NULL DEFAULT 'free'
                              CHECK (tier IN ('free','featured','elite')),
        verified            BOOLEAN     NOT NULL DEFAULT FALSE,
        featured            BOOLEAN     NOT NULL DEFAULT FALSE,
        is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
        avg_rating          NUMERIC(3,2) CHECK (avg_rating BETWEEN 0 AND 5),
        review_count        INTEGER     NOT NULL DEFAULT 0,
        meta_title          TEXT,
        meta_description    TEXT,
        g99_clinic_id       BIGINT      UNIQUE,
        data_source         TEXT        NOT NULL DEFAULT 'manual'
                              CHECK (data_source IN ('manual','g99','scraped')),
        last_synced_at      TIMESTAMPTZ,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_by          UUID,
        updated_by          UUID,
        UNIQUE (business_id, slug)
      )
    `);
    await client.query(`CREATE INDEX idx_clinics_business_id ON clinics (business_id)`);
    await client.query(`CREATE INDEX idx_clinics_slug ON clinics (slug)`);
    await client.query(`CREATE INDEX idx_clinics_city_state ON clinics (lower(city), lower(state))`);
    await client.query(`CREATE INDEX idx_clinics_tier ON clinics (tier) WHERE is_active = TRUE`);
    await client.query(`CREATE INDEX idx_clinics_featured ON clinics (featured) WHERE is_active = TRUE`);
    await client.query(`CREATE INDEX idx_clinics_g99_id ON clinics (g99_clinic_id)`);
    await client.query(`CREATE INDEX idx_clinics_name_trgm ON clinics USING gin (name gin_trgm_ops)`);
    await client.query(`CREATE INDEX idx_clinics_search ON clinics (city, state, tier, avg_rating DESC) WHERE is_active = TRUE AND featured = TRUE`);
    await client.query(`
      CREATE TRIGGER trg_clinics_updated_at
        BEFORE UPDATE ON clinics
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);
    console.log("✓ clinics table created");

    // ── 3. PROVIDERS ───────────────────────────────────────────────────────
    console.log("⏳ Creating providers table...");
    await client.query(`
      CREATE TABLE providers (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id         UUID        NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
        name                TEXT        NOT NULL,
        slug                TEXT        NOT NULL,
        title               TEXT,
        designation         TEXT,
        bio                 TEXT,
        photo_url           TEXT,
        years_experience    SMALLINT    CHECK (years_experience >= 0),
        specializations     TEXT[],
        avg_rating          NUMERIC(3,2) CHECK (avg_rating BETWEEN 0 AND 5),
        review_count        INTEGER     NOT NULL DEFAULT 0,
        is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
        g99_user_id         BIGINT      UNIQUE,
        data_source         TEXT        NOT NULL DEFAULT 'manual'
                              CHECK (data_source IN ('manual','g99','scraped')),
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_by          UUID,
        updated_by          UUID,
        UNIQUE (business_id, slug)
      )
    `);
    await client.query(`CREATE INDEX idx_providers_business_id ON providers (business_id)`);
    await client.query(`CREATE INDEX idx_providers_slug ON providers (slug)`);
    await client.query(`CREATE INDEX idx_providers_g99_id ON providers (g99_user_id)`);
    await client.query(`CREATE INDEX idx_providers_name_trgm ON providers USING gin (name gin_trgm_ops)`);
    await client.query(`
      CREATE TRIGGER trg_providers_updated_at
        BEFORE UPDATE ON providers
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);
    console.log("✓ providers table created");

    // ── 4. CLINIC_PROVIDERS ────────────────────────────────────────────────
    console.log("⏳ Creating clinic_providers table...");
    await client.query(`
      CREATE TABLE clinic_providers (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        clinic_id           UUID        NOT NULL REFERENCES clinics   (id) ON DELETE CASCADE,
        provider_id         UUID        NOT NULL REFERENCES providers (id) ON DELETE CASCADE,
        is_primary          BOOLEAN     NOT NULL DEFAULT FALSE,
        is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (clinic_id, provider_id)
      )
    `);
    await client.query(`CREATE INDEX idx_clinic_providers_clinic ON clinic_providers (clinic_id)`);
    await client.query(`CREATE INDEX idx_clinic_providers_provider ON clinic_providers (provider_id)`);
    console.log("✓ clinic_providers table created");

    // ── 5. CATEGORIES ──────────────────────────────────────────────────────
    console.log("⏳ Creating categories table...");
    await client.query(`
      CREATE TABLE categories (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name                TEXT        NOT NULL,
        slug                TEXT        NOT NULL UNIQUE,
        description         TEXT,
        icon_url            TEXT,
        display_order       SMALLINT    NOT NULL DEFAULT 0,
        is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
        g99_category_id     BIGINT      UNIQUE,
        data_source         TEXT        NOT NULL DEFAULT 'manual'
                              CHECK (data_source IN ('manual','g99','scraped')),
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(`CREATE INDEX idx_categories_slug ON categories (slug)`);
    await client.query(`CREATE INDEX idx_categories_order ON categories (display_order) WHERE is_active = TRUE`);
    await client.query(`
      CREATE TRIGGER trg_categories_updated_at
        BEFORE UPDATE ON categories
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);
    console.log("✓ categories table created");

    // ── 6. SERVICES ────────────────────────────────────────────────────────
    console.log("⏳ Creating services table...");
    await client.query(`
      CREATE TABLE services (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name                TEXT        NOT NULL,
        slug                TEXT        NOT NULL UNIQUE,
        alias               TEXT[],
        summary             TEXT,
        what_it_is          TEXT,
        how_it_works        TEXT,
        cost_range_low      NUMERIC(10,2),
        cost_range_high     NUMERIC(10,2),
        cost_notes          TEXT,
        recovery_time       TEXT,
        duration_minutes    SMALLINT,
        faqs                JSONB,
        medical_reviewer    TEXT,
        reviewer_credentials TEXT,
        last_reviewed_at    TIMESTAMPTZ,
        meta_title          TEXT,
        meta_description    TEXT,
        schema_markup       JSONB,
        is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
        is_published        BOOLEAN     NOT NULL DEFAULT FALSE,
        display_order       SMALLINT    NOT NULL DEFAULT 0,
        g99_service_id      BIGINT,
        data_source         TEXT        NOT NULL DEFAULT 'manual'
                              CHECK (data_source IN ('manual','g99','scraped')),
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(`CREATE INDEX idx_services_slug ON services (slug)`);
    await client.query(`CREATE INDEX idx_services_published ON services (is_published) WHERE is_active = TRUE`);
    await client.query(`CREATE INDEX idx_services_name_trgm ON services USING gin (name gin_trgm_ops)`);
    await client.query(`CREATE INDEX idx_services_alias ON services USING gin (alias)`);
    await client.query(`
      CREATE TRIGGER trg_services_updated_at
        BEFORE UPDATE ON services
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);
    console.log("✓ services table created");

    // ── 7. SERVICE_CATEGORIES ──────────────────────────────────────────────
    console.log("⏳ Creating service_categories table...");
    await client.query(`
      CREATE TABLE service_categories (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        service_id          UUID        NOT NULL REFERENCES services    (id) ON DELETE CASCADE,
        category_id         UUID        NOT NULL REFERENCES categories  (id) ON DELETE CASCADE,
        is_primary          BOOLEAN     NOT NULL DEFAULT TRUE,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (service_id, category_id)
      )
    `);
    await client.query(`CREATE INDEX idx_svc_categories_service ON service_categories (service_id)`);
    await client.query(`CREATE INDEX idx_svc_categories_category ON service_categories (category_id)`);
    console.log("✓ service_categories table created");

    // ── 8. CLINIC_SERVICES ─────────────────────────────────────────────────
    console.log("⏳ Creating clinic_services table...");
    await client.query(`
      CREATE TABLE clinic_services (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        clinic_id           UUID        NOT NULL REFERENCES clinics  (id) ON DELETE CASCADE,
        service_id          UUID        NOT NULL REFERENCES services (id) ON DELETE CASCADE,
        price_from          NUMERIC(10,2),
        price_to            NUMERIC(10,2),
        price_notes         TEXT,
        price_varies        BOOLEAN     NOT NULL DEFAULT FALSE,
        featured_service    BOOLEAN     NOT NULL DEFAULT FALSE,
        is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
        display_order       SMALLINT    NOT NULL DEFAULT 0,
        g99_service_clinic_id BIGINT    UNIQUE,
        data_source         TEXT        NOT NULL DEFAULT 'manual'
                              CHECK (data_source IN ('manual','g99','scraped')),
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (clinic_id, service_id)
      )
    `);
    await client.query(`CREATE INDEX idx_clinic_services_clinic ON clinic_services (clinic_id)`);
    await client.query(`CREATE INDEX idx_clinic_services_service ON clinic_services (service_id)`);
    await client.query(`CREATE INDEX idx_clinic_services_featured ON clinic_services (clinic_id, featured_service) WHERE is_active = TRUE`);
    await client.query(`CREATE INDEX idx_clinic_services_search ON clinic_services (service_id, clinic_id) WHERE is_active = TRUE`);
    await client.query(`
      CREATE TRIGGER trg_clinic_services_updated_at
        BEFORE UPDATE ON clinic_services
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);
    console.log("✓ clinic_services table created");

    // ── 9. IMAGES ──────────────────────────────────────────────────────────
    console.log("⏳ Creating images table...");
    await client.query(`
      CREATE TABLE images (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type         TEXT        NOT NULL
                              CHECK (entity_type IN ('business','clinic','provider','service','category')),
        entity_id           UUID        NOT NULL,
        source_url          TEXT        NOT NULL,
        scraped_domain      TEXT,
        role                TEXT        NOT NULL DEFAULT 'gallery'
                              CHECK (role IN ('cover','gallery','avatar','logo','before_after')),
        sort_order          SMALLINT    NOT NULL DEFAULT 0,
        alt_text            TEXT,
        width               INTEGER,
        height              INTEGER,
        mime_type           TEXT,
        scrape_status       TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (scrape_status IN ('ok','pending','failed','broken')),
        last_checked_at     TIMESTAMPTZ,
        cdn_url             TEXT,
        storage_key         TEXT,
        g99_image_id        BIGINT,
        data_source         TEXT        NOT NULL DEFAULT 'scraped'
                              CHECK (data_source IN ('manual','g99','scraped')),
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (entity_type, entity_id, source_url)
      )
    `);
    await client.query(`CREATE INDEX idx_images_entity ON images (entity_type, entity_id, role, sort_order)`);
    await client.query(`CREATE INDEX idx_images_status ON images (scrape_status) WHERE scrape_status != 'ok'`);
    await client.query(`CREATE INDEX idx_images_domain ON images (scraped_domain)`);
    await client.query(`
      CREATE TRIGGER trg_images_updated_at
        BEFORE UPDATE ON images
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);
    console.log("✓ images table created");

    // ── 10. REVIEWS ────────────────────────────────────────────────────────
    console.log("⏳ Creating reviews table...");
    await client.query(`
      CREATE TABLE reviews (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        clinic_id           UUID        NOT NULL REFERENCES clinics   (id) ON DELETE CASCADE,
        provider_id         UUID        REFERENCES providers (id) ON DELETE SET NULL,
        rating              SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
        body                TEXT,
        reviewer_name       TEXT,
        source              TEXT        NOT NULL DEFAULT 'internal'
                              CHECK (source IN ('google','yelp','internal','imported')),
        source_review_id    TEXT,
        source_url          TEXT,
        is_approved         BOOLEAN     NOT NULL DEFAULT TRUE,
        is_flagged          BOOLEAN     NOT NULL DEFAULT FALSE,
        flagged_reason      TEXT,
        g99_review_id       BIGINT      UNIQUE,
        data_source         TEXT        NOT NULL DEFAULT 'g99'
                              CHECK (data_source IN ('manual','g99','scraped')),
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(`CREATE INDEX idx_reviews_clinic ON reviews (clinic_id, is_approved, rating DESC)`);
    await client.query(`CREATE INDEX idx_reviews_provider ON reviews (provider_id) WHERE provider_id IS NOT NULL`);
    await client.query(`CREATE INDEX idx_reviews_source ON reviews (source)`);
    await client.query(`CREATE INDEX idx_reviews_g99_id ON reviews (g99_review_id)`);
    await client.query(`
      CREATE TRIGGER trg_reviews_updated_at
        BEFORE UPDATE ON reviews
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);
    console.log("✓ reviews table created");

    // ── 11. CONCERNS ───────────────────────────────────────────────────────
    console.log("⏳ Creating concerns table...");
    await client.query(`
      CREATE TABLE concerns (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name                TEXT        NOT NULL,
        slug                TEXT        NOT NULL UNIQUE,
        description         TEXT,
        overview            TEXT,
        faqs                JSONB,
        meta_title          TEXT,
        meta_description    TEXT,
        schema_markup       JSONB,
        is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
        is_published        BOOLEAN     NOT NULL DEFAULT FALSE,
        display_order       SMALLINT    NOT NULL DEFAULT 0,
        g99_symptom_id      BIGINT      UNIQUE,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(`CREATE INDEX idx_concerns_slug ON concerns (slug)`);
    await client.query(`CREATE INDEX idx_concerns_published ON concerns (is_published) WHERE is_active = TRUE`);
    await client.query(`
      CREATE TRIGGER trg_concerns_updated_at
        BEFORE UPDATE ON concerns
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);
    console.log("✓ concerns table created");

    // ── 12. CONCERN_SERVICES ───────────────────────────────────────────────
    console.log("⏳ Creating concern_services table...");
    await client.query(`
      CREATE TABLE concern_services (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        concern_id          UUID        NOT NULL REFERENCES concerns  (id) ON DELETE CASCADE,
        service_id          UUID        NOT NULL REFERENCES services  (id) ON DELETE CASCADE,
        display_order       SMALLINT    NOT NULL DEFAULT 0,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (concern_id, service_id)
      )
    `);
    await client.query(`CREATE INDEX idx_concern_services_concern ON concern_services (concern_id)`);
    await client.query(`CREATE INDEX idx_concern_services_service ON concern_services (service_id)`);
    console.log("✓ concern_services table created");

    // ── 13. LISTING_CLAIMS ─────────────────────────────────────────────────
    console.log("⏳ Creating listing_claims table...");
    await client.query(`
      CREATE TABLE listing_claims (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id         UUID        NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
        contact_name        TEXT        NOT NULL,
        contact_email       TEXT        NOT NULL,
        contact_phone       TEXT,
        spa_name            TEXT,
        status              TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','verified','approved','rejected')),
        verification_token  TEXT        UNIQUE,
        verified_at         TIMESTAMPTZ,
        approved_at         TIMESTAMPTZ,
        rejected_reason     TEXT,
        source_page         TEXT,
        utm_source          TEXT,
        utm_medium          TEXT,
        utm_campaign        TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(`CREATE INDEX idx_claims_business ON listing_claims (business_id)`);
    await client.query(`CREATE INDEX idx_claims_status ON listing_claims (status)`);
    await client.query(`CREATE INDEX idx_claims_email ON listing_claims (contact_email)`);
    await client.query(`
      CREATE TRIGGER trg_claims_updated_at
        BEFORE UPDATE ON listing_claims
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);
    console.log("✓ listing_claims table created");

    // ── Rating refresh trigger ─────────────────────────────────────────────
    console.log("⏳ Creating rating refresh trigger...");
    await client.query(`
      CREATE OR REPLACE FUNCTION refresh_clinic_rating()
      RETURNS TRIGGER AS $$
      DECLARE
        target_clinic_id UUID;
      BEGIN
        target_clinic_id := COALESCE(NEW.clinic_id, OLD.clinic_id);
        UPDATE clinics
        SET
          avg_rating   = (
            SELECT ROUND(AVG(rating)::NUMERIC, 2)
            FROM reviews
            WHERE clinic_id = target_clinic_id AND is_approved = TRUE
          ),
          review_count = (
            SELECT COUNT(*)
            FROM reviews
            WHERE clinic_id = target_clinic_id AND is_approved = TRUE
          )
        WHERE id = target_clinic_id;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql
    `);
    await client.query(`
      CREATE TRIGGER trg_refresh_clinic_rating
        AFTER INSERT OR UPDATE OR DELETE ON reviews
        FOR EACH ROW EXECUTE FUNCTION refresh_clinic_rating()
    `);
    console.log("✓ Rating refresh trigger created");

    // ── Table comments ─────────────────────────────────────────────────────
    await client.query(`COMMENT ON TABLE businesses IS 'Top-level entity. One business owns multiple clinic locations.'`);
    await client.query(`COMMENT ON TABLE clinics IS 'Physical medspa locations.'`);
    await client.query(`COMMENT ON TABLE providers IS 'Practitioners.'`);
    await client.query(`COMMENT ON TABLE clinic_providers IS 'Junction: which provider works at which clinic.'`);
    await client.query(`COMMENT ON TABLE categories IS 'Top-level service groups (Injectables, Laser...).'`);
    await client.query(`COMMENT ON TABLE services IS 'Master treatment catalog. Powers /treatments/{slug} pages.'`);
    await client.query(`COMMENT ON TABLE service_categories IS 'Junction: service → category.'`);
    await client.query(`COMMENT ON TABLE clinic_services IS 'Which services a clinic offers + location-specific pricing.'`);
    await client.query(`COMMENT ON TABLE images IS 'All images — scraped URLs.'`);
    await client.query(`COMMENT ON TABLE reviews IS 'Patient reviews.'`);
    await client.query(`COMMENT ON TABLE concerns IS '/conditions pages.'`);
    await client.query(`COMMENT ON TABLE concern_services IS 'Concern → treatment mapping.'`);
    await client.query(`COMMENT ON TABLE listing_claims IS 'Claim flow for unclaimed listings.'`);

    await client.query("COMMIT");
    console.log("\n✅ Migration complete! All 13 tables created successfully.");

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
