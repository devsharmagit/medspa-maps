-- 2026-07-29: clinics.clinic_type
--
-- The directory's scope broadened beyond medical spas to include plastic-surgery
-- practices, cosmetic dermatology and day spas / nail salons. Nothing in the
-- schema distinguished those from a medspa: `g99_clinic_websites.specialization`
-- is the string 'Medical Aesthetics' for all 742 harvested rows, so it carries no
-- signal, and it was never copied onto `clinics` anyway.
--
-- Captured at ingest time because that is the only cheap moment to know it — the
-- agent reading the site already does. Backfilling later means re-reading every
-- site or hand-labelling.
--
-- Nullable with no default and no index: purely additive, nothing reads it yet,
-- and existing rows stay untouched (NULL = unclassified, not 'medspa', so we
-- never assert a type we did not actually verify).
--
-- Intended values, matching the classifier's `clinic_type` enum:
--   medspa | plastic_surgery | cosmetic_derm | dental_aesthetics
--   day_spa_salon | wellness_plus_aesthetics | other_medical_plus_aesthetics

ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS clinic_type text;

COMMENT ON COLUMN public.clinics.clinic_type IS
  'Practice type as read from the clinic''s own site at ingest: medspa, plastic_surgery, cosmetic_derm, dental_aesthetics, day_spa_salon, wellness_plus_aesthetics, other_medical_plus_aesthetics. NULL = unclassified.';
