-- 2026-07-29: remove dentistry from the directory
--
-- Decision: this is a MEDSPA directory and carries no dentistry — no dental
-- treatment, no dental concern, and no dentistry-first clinic. This reverses the
-- "cosmetic dentistry counts" part of the broadened re-triage criteria applied
-- earlier the same day.
--
-- The app already half-assumed this: api/search/route.ts filters
-- `s.name !~* '(dentistry|dental|orthodont|veneer)'` in three places, so dental
-- services were listed on clinic pages but unsearchable — inconsistent either way.
-- This makes the data match the intent.
--
-- Survey that defined the scope (2026-07-29):
--   services: Teeth Whitening (8 clinics), Laser Teeth Whitening (1),
--             Professional Teeth Whitening (1), Smile Makeover (1),
--             Snap-On Smile (1), Veneers (1)
--   concerns: none matched any dental pattern
--   clinics : 1 dentistry-first — Dr. Joseph Field, DDS (dr-joseph-field-dds),
--             whose 6 treatments were ALL dental, so removing them would leave a
--             clinic with zero treatments (invisible in search). Deleted outright.
--   The other 9 clinics holding a dental row are real medspas with 5-54 other
--   treatments; they keep everything except the single dental row.
--
-- Backup taken first: web/reports/retriage-2026-07-29/backup/pre-dental-purge.sql

BEGIN;

-- ── 1. The dentistry-first clinic ───────────────────────────────────────────
-- `images` is polymorphic (entity_type/entity_id, no FK) so it does NOT cascade
-- and must be cleared explicitly, or its rows are orphaned forever.
DELETE FROM images
 WHERE entity_type = 'clinic'
   AND entity_id IN (SELECT id FROM clinics WHERE slug = 'dr-joseph-field-dds');

-- Everything else (clinic_services, clinic_locations, providers, clinic_concerns,
-- reviews, clinic_refresh_runs, clinic_catalog_changes, clinic_service_concerns)
-- is ON DELETE CASCADE.
DELETE FROM clinics WHERE slug = 'dr-joseph-field-dds';

-- ── 2. Dental service memberships on the surviving medspas ──────────────────
DELETE FROM clinic_services
 WHERE service_id IN (
   SELECT id FROM services WHERE slug IN (
     'teeth-whitening','laser-teeth-whitening','professional-teeth-whitening',
     'smile-makeover','snap-on-smile','veneers'
   )
 );

-- ── 3. The dental catalog rows themselves ───────────────────────────────────
DELETE FROM services WHERE slug IN (
  'teeth-whitening','laser-teeth-whitening','professional-teeth-whitening',
  'smile-makeover','snap-on-smile','veneers'
);

COMMIT;

-- Search view holds service_slugs[]; refresh so the removed treatments stop
-- appearing in treatment search.
REFRESH MATERIALIZED VIEW public.clinic_search_view;
