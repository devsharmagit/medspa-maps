-- ============================================================================
-- 2026-07-18  Schema simplification
-- Reduces the DB to: clinic basic details + treatments + concerns + the
-- clinic/treatment/concern joins. Dissolves businesses into clinics, drops
-- unused peripheral tables, strips detail/SEO columns, simplifies providers.
--
-- Backup taken before running: scratchpad/backup-20260718.sql (pg_dump 18.4)
-- Transactional: rolls back entirely on any error.
-- ============================================================================
BEGIN;

-- 1. Drop the search matview (recreated, simplified, at the end) ---------------
DROP MATERIALIZED VIEW IF EXISTS clinic_search_view CASCADE;

-- 2. Drop peripheral / no-longer-needed tables --------------------------------
DROP TABLE IF EXISTS listing_claims        CASCADE;
DROP TABLE IF EXISTS medspa_leads          CASCADE;
DROP TABLE IF EXISTS clinic_service_changes CASCADE;   -- FK -> scrape_jobs
DROP TABLE IF EXISTS scrape_jobs           CASCADE;
DROP TABLE IF EXISTS clinic_concern_evidence CASCADE;  -- evidence gate removed
DROP TABLE IF EXISTS concern_services      CASCADE;    -- global concern->service map

-- 3. Dissolve businesses into clinics -----------------------------------------
--    Carry the two G99 link ids onto the clinic; clinic already has name/slug.
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS g99_business_id int8;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS g99_tenant_id   int8;

UPDATE clinics c
   SET g99_business_id = b.g99_business_id,
       g99_tenant_id   = b.g99_tenant_id
  FROM businesses b
 WHERE b.id = c.business_id;

-- slug was unique per business; make it globally unique now (verified: no collisions)
ALTER TABLE clinics DROP CONSTRAINT IF EXISTS clinics_business_id_slug_key;
ALTER TABLE clinics DROP CONSTRAINT IF EXISTS clinics_business_id_fkey;
ALTER TABLE clinics DROP COLUMN IF EXISTS business_id;      -- drops idx_clinics_business_id
ALTER TABLE clinics ADD CONSTRAINT clinics_slug_key UNIQUE (slug);

DROP TABLE IF EXISTS businesses CASCADE;

-- 4. Strip clinic columns (addresses/geo live in clinic_locations) -------------
--    Kept intentionally: ext_rating, ext_review_count (rating filter), featured,
--    avg_rating, review_count, google_place_id, yelp_url, socials.
ALTER TABLE clinics
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS state,
  DROP COLUMN IF EXISTS zip,
  DROP COLUMN IF EXISTS geo,
  DROP COLUMN IF EXISTS lat,
  DROP COLUMN IF EXISTS lng,
  DROP COLUMN IF EXISTS tier,
  DROP COLUMN IF EXISTS verified,
  DROP COLUMN IF EXISTS founded_year,
  DROP COLUMN IF EXISTS stat_experts,
  DROP COLUMN IF EXISTS stat_cities,
  DROP COLUMN IF EXISTS stat_treatments,
  DROP COLUMN IF EXISTS stat_rating,
  DROP COLUMN IF EXISTS stat_patients;

-- 5. clinic_services: drop columns no app query reads -------------------------
--    Kept: service_id, raw_name, price_from, price_unit, description,
--    match_status, is_active.
ALTER TABLE clinic_services
  DROP COLUMN IF EXISTS match_confidence,
  DROP COLUMN IF EXISTS data_source,
  DROP COLUMN IF EXISTS scraped_from_url,
  DROP COLUMN IF EXISTS last_scraped_at;

-- 6. services catalog -> bare (search only): id, name, slug, is_active, origin -
ALTER TABLE services
  DROP COLUMN IF EXISTS aliases,
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS summary,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS price_from,
  DROP COLUMN IF EXISTS price_unit,
  DROP COLUMN IF EXISTS treatment_time,
  DROP COLUMN IF EXISTS results_timeline,
  DROP COLUMN IF EXISTS results_duration,
  DROP COLUMN IF EXISTS recovery_time,
  DROP COLUMN IF EXISTS hero_rating,
  DROP COLUMN IF EXISTS hero_review_count,
  DROP COLUMN IF EXISTS faqs,
  DROP COLUMN IF EXISTS is_published,
  DROP COLUMN IF EXISTS review_status;

-- 7. concerns catalog -> bare: id, name, slug, is_active, origin --------------
ALTER TABLE concerns
  DROP COLUMN IF EXISTS aliases,
  DROP COLUMN IF EXISTS overview,
  DROP COLUMN IF EXISTS details,
  DROP COLUMN IF EXISTS faqs,
  DROP COLUMN IF EXISTS schema_markup,
  DROP COLUMN IF EXISTS meta_title,
  DROP COLUMN IF EXISTS meta_description,
  DROP COLUMN IF EXISTS source_url,
  DROP COLUMN IF EXISTS is_published,
  DROP COLUMN IF EXISTS data_source;

-- 8. clinic_service_concerns -> the single clinic+treatment+concern link ------
--    Kept: clinic_id, service_id, concern_id, is_active, timestamps.
ALTER TABLE clinic_service_concerns
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS raw_service_name,
  DROP COLUMN IF EXISTS raw_concern_name,
  DROP COLUMN IF EXISTS source_url;

-- 9. providers -> cards only --------------------------------------------------
--    Kept: name, title, image_url, is_verified, card_tagline, is_active.
ALTER TABLE providers
  DROP COLUMN IF EXISTS bio,
  DROP COLUMN IF EXISTS years_experience,
  DROP COLUMN IF EXISTS credentials,
  DROP COLUMN IF EXISTS specialties,
  DROP COLUMN IF EXISTS highlights,
  DROP COLUMN IF EXISTS review_rating,
  DROP COLUMN IF EXISTS review_count;

-- 10. Recreate a simplified search matview (never SELECTed by app, only --------
--     REFRESHed; kept valid so refresh call sites keep working).
CREATE MATERIALIZED VIEW clinic_search_view AS
 SELECT c.id AS clinic_id,
        c.name AS clinic_name,
        c.slug AS clinic_slug,
        c.website,
        c.booking_url,
        c.about,
        c.phone,
        c.avg_rating,
        c.review_count,
        c.ext_rating,
        c.ext_review_count,
        c.featured,
        COALESCE(array_agg(DISTINCT COALESCE(sv.name, cs.raw_name))
                 FILTER (WHERE cs.is_active = true), '{}'::text[]) AS service_names,
        COALESCE(array_agg(DISTINCT COALESCE(sv.slug, slugify(cs.raw_name)))
                 FILTER (WHERE cs.is_active = true), '{}'::text[]) AS service_slugs,
        ( SELECT i.source_url FROM images i
           WHERE i.entity_type = 'clinic' AND i.entity_id = c.id
             AND i.role = 'cover' AND i.scrape_status = 'ok'
           ORDER BY i.sort_order LIMIT 1) AS cover_image_url,
        ( SELECT i.source_url FROM images i
           WHERE i.entity_type = 'clinic' AND i.entity_id = c.id
             AND i.role = 'logo' AND i.scrape_status = 'ok'
           ORDER BY i.sort_order LIMIT 1) AS logo_url
   FROM clinics c
   LEFT JOIN clinic_services cs ON cs.clinic_id = c.id
   LEFT JOIN services sv ON sv.id = cs.service_id
  WHERE c.is_active = true
  GROUP BY c.id;

CREATE UNIQUE INDEX idx_csv_clinic_id ON clinic_search_view (clinic_id);
CREATE INDEX idx_csv_service_slugs ON clinic_search_view USING gin (service_slugs);

COMMIT;
