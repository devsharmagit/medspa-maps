/**
 * migrate.ts — run with: bun scripts/migrate.ts
 *
 * Resets the database and applies the MedSpaMaps v2 schema.
 * Drops ALL existing tables, views, triggers, and functions,
 * then recreates everything from scratch.
 *
 * Tables: businesses, clinics, services, clinic_services,
 *         providers, clinic_providers, images, listing_claims,
 *         scrape_jobs
 * Views:  clinic_search_view (materialized)
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

    // ── Extensions ─────────────────────────────────────────────────────────
    console.log("⏳ Enabling extensions...");
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS "unaccent"`);
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS "postgis"`);
      console.log("✓ PostGIS enabled");
    } catch {
      console.log("⚠ PostGIS not available on this plan — geo column will be TEXT");
    }
    console.log("✓ Extensions ready");

    // ── Drop everything in dependency order ──────────────────────────────────
    console.log("⏳ Dropping existing objects...");
    await client.query(`DROP MATERIALIZED VIEW IF EXISTS clinic_search_view CASCADE`);
    await client.query(`DROP TABLE IF EXISTS scrape_jobs CASCADE`);
    await client.query(`DROP TABLE IF EXISTS listing_claims CASCADE`);
    await client.query(`DROP TABLE IF EXISTS images CASCADE`);
    await client.query(`DROP TABLE IF EXISTS clinic_providers CASCADE`);
    await client.query(`DROP TABLE IF EXISTS providers CASCADE`);
    await client.query(`DROP TABLE IF EXISTS clinic_services CASCADE`);
    await client.query(`DROP TABLE IF EXISTS services CASCADE`);
    await client.query(`DROP TABLE IF EXISTS clinics CASCADE`);
    await client.query(`DROP TABLE IF EXISTS businesses CASCADE`);
    // Legacy tables from old schema
    await client.query(`DROP TABLE IF EXISTS concern_services CASCADE`);
    await client.query(`DROP TABLE IF EXISTS concerns CASCADE`);
    await client.query(`DROP TABLE IF EXISTS reviews CASCADE`);
    await client.query(`DROP TABLE IF EXISTS service_categories CASCADE`);
    await client.query(`DROP TABLE IF EXISTS categories CASCADE`);
    await client.query(`DROP FUNCTION IF EXISTS set_updated_at() CASCADE`);
    await client.query(`DROP FUNCTION IF EXISTS slugify(TEXT) CASCADE`);
    await client.query(`DROP FUNCTION IF EXISTS refresh_clinic_rating() CASCADE`);
    console.log("✓ Old objects dropped");

    // ── Helper: set_updated_at ────────────────────────────────────────────────
    await client.query(`
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    // ── Helper: slugify ───────────────────────────────────────────────────────
    await client.query(`
      CREATE OR REPLACE FUNCTION slugify(val TEXT)
      RETURNS TEXT AS $$
      BEGIN
        RETURN lower(
          regexp_replace(
            regexp_replace(
              public.unaccent(trim(val)),
              '[^a-zA-Z0-9\\s-]', '', 'g'
            ),
            '[\\s-]+', '-', 'g'
          )
        );
      END;
      $$ LANGUAGE plpgsql IMMUTABLE
    `);
    console.log("✓ Helper functions created");

    // ── 1. BUSINESSES ─────────────────────────────────────────────────────────
    console.log("⏳ Creating businesses table...");
    await client.query(`
      CREATE TABLE businesses (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        tier TEXT NOT NULL DEFAULT 'free',
        tier_expires_at TIMESTAMPTZ,
        verified BOOLEAN NOT NULL DEFAULT false,
        verified_at TIMESTAMPTZ,
        data_source TEXT NOT NULL DEFAULT 'manual',
        g99_business_id BIGINT UNIQUE,
        g99_tenant_id BIGINT UNIQUE,
        last_synced_at TIMESTAMPTZ,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX idx_businesses_g99_id ON businesses (g99_business_id)`);
    await client.query(`CREATE INDEX idx_businesses_tenant_id ON businesses (g99_tenant_id)`);
    await client.query(`CREATE INDEX idx_businesses_tier ON businesses (tier)`);
    await client.query(`CREATE INDEX idx_businesses_is_active ON businesses (is_active)`);
    await client.query(`
      CREATE TRIGGER trg_businesses_updated_at
      BEFORE UPDATE ON businesses
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);
    console.log("✓ businesses table created");

    // ── 2. CLINICS ────────────────────────────────────────────────────────────
    console.log("⏳ Creating clinics table...");
    await client.query(`
      CREATE TABLE clinics (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE RESTRICT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        website TEXT NOT NULL,
        booking_url TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        zip TEXT,
        country TEXT DEFAULT 'US',
        geo GEOGRAPHY(POINT, 4326),
        lat NUMERIC(10, 7),
        lng NUMERIC(10, 7),
        phone TEXT,
        email TEXT,
        about TEXT,
        instagram_url TEXT,
        facebook_url TEXT,
        tiktok_url TEXT,
        youtube_url TEXT,
        x_url TEXT,
        linkedin_url TEXT,
        yelp_url TEXT,
        google_my_business TEXT,
        google_place_id TEXT,
        hours JSONB,
        tier TEXT NOT NULL DEFAULT 'free',
        verified BOOLEAN NOT NULL DEFAULT false,
        featured BOOLEAN NOT NULL DEFAULT false,
        avg_rating NUMERIC(3, 2),
        review_count INTEGER NOT NULL DEFAULT 0,
        data_source TEXT NOT NULL DEFAULT 'manual',
        g99_clinic_id BIGINT UNIQUE,
        last_synced_at TIMESTAMPTZ,
        last_scraped_at TIMESTAMPTZ,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (business_id, slug)
      )
    `);
    await client.query(`CREATE INDEX idx_clinics_business_id ON clinics (business_id)`);
    await client.query(`CREATE INDEX idx_clinics_slug ON clinics (business_id, slug)`);
    await client.query(`CREATE INDEX idx_clinics_g99_id ON clinics (g99_clinic_id)`);
    await client.query(`CREATE INDEX idx_clinics_city ON clinics (lower(city))`);
    await client.query(`CREATE INDEX idx_clinics_state ON clinics (lower(state))`);
    await client.query(`CREATE INDEX idx_clinics_tier ON clinics (tier)`);
    await client.query(`CREATE INDEX idx_clinics_is_active ON clinics (is_active)`);
    await client.query(`CREATE INDEX idx_clinics_website ON clinics (website)`);
    await client.query(`CREATE INDEX idx_clinics_google_place ON clinics (google_place_id)`);
    try {
      await client.query(`CREATE INDEX idx_clinics_geo ON clinics USING GIST (geo)`);
    } catch {
      console.log("  ⚠ Skipping PostGIS index on clinics.geo");
    }
    await client.query(`
      CREATE INDEX idx_clinics_fts ON clinics
      USING GIN (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(city, '')))
    `);
    await client.query(`
      CREATE TRIGGER trg_clinics_updated_at
      BEFORE UPDATE ON clinics
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);
    console.log("✓ clinics table created");

    // ── 3. SERVICES (canonical taxonomy) ─────────────────────────────────────
    // A short, curated catalog of service *types* (Botox, Dermal Fillers,
    // Laser Hair Removal, ...). This is what search/filter UI is built on.
    // It is NOT per-clinic — clinic_services links clinics to these rows.
    console.log("⏳ Creating services table...");
    await client.query(`
      CREATE TABLE services (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        category TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (slug)
      )
    `);
    await client.query(`CREATE INDEX idx_services_slug ON services (slug)`);
    await client.query(`CREATE INDEX idx_services_category ON services (category)`);
    await client.query(`CREATE INDEX idx_services_is_active ON services (is_active)`);
    await client.query(`
      CREATE TRIGGER trg_services_updated_at
      BEFORE UPDATE ON services
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);
    console.log("✓ services table created");

    // ── 4. CLINIC_SERVICES (join: what a clinic actually offers) ────────────
    // One row per offering as scraped/entered. service_id is nullable until
    // raw_name has been matched to a canonical service — scraping should
    // never block on taxonomy matching.
    console.log("⏳ Creating clinic_services table...");
    await client.query(`
      CREATE TABLE clinic_services (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        clinic_id UUID NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
        service_id UUID REFERENCES services (id) ON DELETE SET NULL,
        raw_name TEXT NOT NULL,
        description TEXT,
        data_source TEXT NOT NULL DEFAULT 'scraped',
        scraped_from_url TEXT,
        last_scraped_at TIMESTAMPTZ,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (clinic_id, raw_name)
      )
    `);
    await client.query(`CREATE INDEX idx_clinic_services_clinic_id ON clinic_services (clinic_id)`);
    await client.query(`CREATE INDEX idx_clinic_services_service_id ON clinic_services (service_id)`);
    await client.query(`CREATE INDEX idx_clinic_services_is_active ON clinic_services (is_active)`);
    await client.query(`
      CREATE INDEX idx_clinic_services_fts ON clinic_services
      USING GIN (to_tsvector('english', coalesce(raw_name, '') || ' ' || coalesce(description, '')))
    `);
    await client.query(`
      CREATE TRIGGER trg_clinic_services_updated_at
      BEFORE UPDATE ON clinic_services
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);
    console.log("✓ clinic_services table created");

   console.log("⏳ Creating images table...");
    await client.query(`
      CREATE TABLE images (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        entity_type TEXT NOT NULL,
        entity_id UUID NOT NULL,
        source_url TEXT NOT NULL,
        cdn_url TEXT,
        storage_key TEXT,
        role TEXT NOT NULL DEFAULT 'gallery',
        sort_order SMALLINT NOT NULL DEFAULT 0,
        alt_text TEXT,
        scraped_domain TEXT,
        scrape_status TEXT NOT NULL DEFAULT 'pending',
        last_checked_at TIMESTAMPTZ,
        g99_image_id BIGINT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (entity_type, entity_id, source_url)
      )
    `);
    await client.query(`CREATE INDEX idx_images_entity ON images (entity_type, entity_id)`);
    await client.query(`CREATE INDEX idx_images_role ON images (entity_type, entity_id, role)`);
    await client.query(`CREATE INDEX idx_images_scrape_status ON images (scrape_status)`);
    await client.query(`CREATE INDEX idx_images_scraped_domain ON images (scraped_domain)`);
    await client.query(`
      CREATE TRIGGER trg_images_updated_at
      BEFORE UPDATE ON images
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);
    console.log("✓ images table created");

    // ── 8. LISTING_CLAIMS ─────────────────────────────────────────────────────
    console.log("⏳ Creating listing_claims table...");
    await client.query(`
      CREATE TABLE listing_claims (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
        contact_name TEXT NOT NULL,
        contact_email TEXT NOT NULL,
        contact_phone TEXT,
        spa_name TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        verification_token TEXT UNIQUE,
        verified_at TIMESTAMPTZ,
        approved_at TIMESTAMPTZ,
        rejected_at TIMESTAMPTZ,
        rejection_reason TEXT,
        source_page TEXT,
        utm_source TEXT,
        utm_medium TEXT,
        utm_campaign TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX idx_listing_claims_business_id ON listing_claims (business_id)`);
    await client.query(`CREATE INDEX idx_listing_claims_status ON listing_claims (status)`);
    await client.query(`CREATE INDEX idx_listing_claims_email ON listing_claims (contact_email)`);
    await client.query(`
      CREATE TRIGGER trg_listing_claims_updated_at
      BEFORE UPDATE ON listing_claims
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);
    console.log("✓ listing_claims table created");

    // ── 9. SCRAPE_JOBS ────────────────────────────────────────────────────────
    console.log("⏳ Creating scrape_jobs table...");
    await client.query(`
      CREATE TABLE scrape_jobs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        clinic_id UUID NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
        target_url TEXT NOT NULL,
        job_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        started_at TIMESTAMPTZ,
        finished_at TIMESTAMPTZ,
        error_message TEXT,
        services_found INTEGER DEFAULT 0,
        images_found INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX idx_scrape_jobs_clinic_id ON scrape_jobs (clinic_id)`);
    await client.query(`CREATE INDEX idx_scrape_jobs_status ON scrape_jobs (status)`);
    await client.query(`CREATE INDEX idx_scrape_jobs_type ON scrape_jobs (job_type)`);
    await client.query(`CREATE INDEX idx_scrape_jobs_created ON scrape_jobs (created_at DESC)`);
    await client.query(`
      CREATE TRIGGER trg_scrape_jobs_updated_at
      BEFORE UPDATE ON scrape_jobs
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);
    console.log("✓ scrape_jobs table created");

    // ── 10. MATERIALIZED VIEW: clinic_search_view ────────────────────────────
    console.log("⏳ Creating clinic_search_view materialized view...");
    await client.query(`
      CREATE MATERIALIZED VIEW clinic_search_view AS
      SELECT
        c.id AS clinic_id,
        c.business_id,
        c.name AS clinic_name,
        c.slug AS clinic_slug,
        b.name AS business_name,
        c.address,
        c.city,
        c.state,
        c.zip,
        c.country,
        c.lat,
        c.lng,
        c.geo,
        c.phone,
        c.website,
        c.booking_url,
        c.about,
        c.instagram_url,
        c.facebook_url,
        c.google_place_id,
        c.yelp_url,
        c.hours,
        c.tier,
        c.verified,
        c.featured,
        c.avg_rating,
        c.review_count,
        COALESCE(
          ARRAY_AGG(DISTINCT COALESCE(sv.name, cs.raw_name))
            FILTER (WHERE cs.is_active = true),
          '{}'
        ) AS service_names,
        COALESCE(
          ARRAY_AGG(DISTINCT COALESCE(sv.slug, slugify(cs.raw_name)))
            FILTER (WHERE cs.is_active = true),
          '{}'
        ) AS service_slugs,
        (
          SELECT source_url FROM images i
          WHERE i.entity_type = 'clinic' AND i.entity_id = c.id
            AND i.role = 'cover' AND i.scrape_status = 'ok'
          ORDER BY i.sort_order LIMIT 1
        ) AS cover_image_url,
        (
          SELECT source_url FROM images i
          WHERE i.entity_type = 'business' AND i.entity_id = c.business_id
            AND i.role = 'logo' AND i.scrape_status = 'ok'
          ORDER BY i.sort_order LIMIT 1
        ) AS logo_url
      FROM clinics c
      JOIN businesses b ON b.id = c.business_id
      LEFT JOIN clinic_services cs ON cs.clinic_id = c.id
      LEFT JOIN services sv ON sv.id = cs.service_id
      WHERE c.is_active = true AND b.is_active = true
      GROUP BY
        c.id, c.business_id, c.name, c.slug, b.name,
        c.address, c.city, c.state, c.zip, c.country, c.lat, c.lng, c.geo,
        c.phone, c.website, c.booking_url, c.about, c.instagram_url,
        c.facebook_url, c.google_place_id, c.yelp_url, c.hours, c.tier,
        c.verified, c.featured, c.avg_rating, c.review_count
    `);
    await client.query(`CREATE UNIQUE INDEX idx_csv_clinic_id ON clinic_search_view (clinic_id)`);
    await client.query(`CREATE INDEX idx_csv_city ON clinic_search_view (lower(city))`);
    await client.query(`CREATE INDEX idx_csv_state ON clinic_search_view (lower(state))`);
    await client.query(`CREATE INDEX idx_csv_tier ON clinic_search_view (tier)`);
    await client.query(`CREATE INDEX idx_csv_avg_rating ON clinic_search_view (avg_rating DESC)`);
    await client.query(`CREATE INDEX idx_csv_service_slugs ON clinic_search_view USING GIN (service_slugs)`);
    try {
      await client.query(`CREATE INDEX idx_csv_geo ON clinic_search_view USING GIST (geo)`);
    } catch {
      console.log("  ⚠ Skipping PostGIS index on clinic_search_view.geo");
    }
    console.log("✓ clinic_search_view created");

    await client.query("COMMIT");
    console.log(`
✅ Migration complete!

Tables created:
  1. businesses
  2. clinics
  3. services          (canonical taxonomy)
  4. clinic_services   (clinic ↔ service join, raw scraped/entered names)
  5. providers         (skipped for now)
  6. clinic_providers  (skipped for now)
  7. images
  8. listing_claims
  9. scrape_jobs

Views:
  • clinic_search_view (materialized)

Next steps:
  1. Run G99 sync to populate businesses + clinics
  2. Geocode clinics → lat/lng/geo
  3. Run scraper → clinic_services, images
  4. Match clinic_services.raw_name → services.id where possible
  5. REFRESH MATERIALIZED VIEW CONCURRENTLY clinic_search_view;
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