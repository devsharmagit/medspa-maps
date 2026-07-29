-- 2026-07-29: catalog prep for the broadened directory scope
-- (plastic surgery + day spa / nail salon, ahead of the 74-domain re-triage).
--
-- WHY THIS RUNS BEFORE THE INGEST
-- `saveClinicServices` resolves a public treatment by NORMALIZED EXACT NAME on
-- `general_name`, else it CREATES a row. There is no fuzzy step on that path, and
-- exact matching does not collapse plurals or synonyms — "Face Lift" != "Facelift",
-- "Tummy Tuck" != "Abdominoplasty". So without a settled set of canonical target
-- names, 20-odd plastic-surgery menus mint 20 spellings of the same 20 procedures.
-- The catalog is already 1078 rows with ~65% attached to a single clinic; this is
-- the fragmentation we are trying not to double.
--
-- WHY origin='manual' AND NOT CANONICAL_SERVICES
-- 'manual' already means "protected, canonical, hand-made" everywhere it matters:
-- `dedupe-services.ts` treats origin != 'ai' as a canonical merge root, and
-- `clean-catalog-junk.ts` only ever deletes origin='ai'. Adding these to the
-- CANONICAL_SERVICES constant instead would drag in unrelated behaviour — it is
-- the denominator of the admin "priority coverage N / 15" metric
-- (lib/treatments/coverage.ts) and it seeds the chatbot's advertised treatment
-- universe (lib/chat/context.ts), so growing it to 45 would distort both.
--
-- DELIBERATELY NOT RENAMING anything. "Brazilian Butt Lift (BBL)",
-- "Arm Lift Surgery" and "Thigh Lift Surgery" keep their current names even though
-- shorter ones would read better: a rename changes the exact-match target (so the
-- next payload using the old name mints a duplicate) and orphans the indexed
-- /search?q=<slug> URL. The allowlist handed to extraction uses these exact
-- strings instead.
--
-- Idempotent: re-running is a no-op.

BEGIN;

-- ── 1. Promote the 32 existing surgical / spa rows to canonical ──────────────
-- These are already carrying real clinic links (Facials 144, Liposuction 17,
-- Facelift 11, Breast Augmentation 10, Neck Lift 10, Brow Lift 9 …) as org
-- 'ai' rows, which leaves them eligible for junk-cleanup and non-canonical in a
-- dedupe merge. They are the intended long-tail absorbers, so pin them.
UPDATE services SET origin = 'manual', updated_at = NOW()
 WHERE is_active
   AND origin <> 'manual'
   AND slug IN (
     -- face / neck
     'facelift','neck-lift','blepharoplasty','eyelid-surgery','brow-lift',
     'rhinoplasty','non-surgical-rhinoplasty','otoplasty','chin-augmentation',
     'buccal-fat-removal',
     -- breast
     'breast-augmentation','breast-lift','breast-reduction',
     'breast-implant-revision','breast-reconstruction','gynecomastia-surgery',
     -- body
     'liposuction','abdominoplasty','mommy-makeover','brazilian-butt-lift-bbl',
     'arm-lift-surgery','thigh-lift-surgery','labiaplasty',
     -- day spa / lash / brow / nails
     'facials','waxing','permanent-makeup','massage','massage-therapy',
     'brow-lamination','lash-extensions','lash-lift','nail-care'
   );

-- ── 2. The 6 genuinely missing rows ─────────────────────────────────────────
-- Everything else on the target list already existed. The catalog had essentially
-- no nail vocabulary at all (one 'Nail Care' row, 1 clinic).
INSERT INTO services (name, slug, origin, is_active) VALUES
  ('Manicure',          'manicure',          'manual', true),
  ('Pedicure',          'pedicure',          'manual', true),
  ('Gel Manicure',      'gel-manicure',      'manual', true),
  ('Nail Enhancements', 'nail-enhancements', 'manual', true),
  ('Body Wrap',         'body-wrap',         'manual', true),
  ('Body Scrub',        'body-scrub',        'manual', true)
ON CONFLICT (slug) DO NOTHING;

-- ── 3. Concerns for plastic-surgery patients ────────────────────────────────
-- `isConcernNoise` rejects the natural phrasings — anything ending in
-- augmentation/enhancement/contouring/relief, bare body parts, and >4 words — and
-- it is right to: those are procedures and goals, not patient problems. So the
-- procedure is mapped to the CONDITION it addresses. All 13 verified to pass
-- isConcernNoise before insertion.
--
-- Reused instead of created (already in the catalog): Loose & Sagging Skin,
-- Stubborn Body Fat, Drooping Brows, Droopy Eyelids, Jowling, Vaginal Laxity,
-- Stress.
INSERT INTO concerns (name, slug, origin, is_active) VALUES
  ('Small Breasts',         'small-breasts',         'manual', true),  -- Breast Augmentation
  ('Sagging Breasts',       'sagging-breasts',       'manual', true),  -- Breast Lift / Mastopexy
  ('Overly Large Breasts',  'overly-large-breasts',  'manual', true),  -- Breast Reduction
  ('Gynecomastia',          'gynecomastia',          'manual', true),
  ('Nose Shape',            'nose-shape',            'manual', true),  -- Rhinoplasty (cosmetic)
  ('Nasal Obstruction',     'nasal-obstruction',     'manual', true),  -- Rhinoplasty (functional)
  ('Excess Abdominal Skin', 'excess-abdominal-skin', 'manual', true),  -- Abdominoplasty
  ('Diastasis Recti',       'diastasis-recti',       'manual', true),
  ('Excess Skin',           'excess-skin',           'manual', true),  -- Arm/Thigh Lift
  ('Flat Buttocks',         'flat-buttocks',         'manual', true),  -- BBL
  ('Protruding Ears',       'protruding-ears',       'manual', true),  -- Otoplasty
  ('Under-Eye Bags',        'under-eye-bags',        'manual', true),  -- lower blepharoplasty
                                                                      -- (distinct from the
                                                                      -- existing filler concern
                                                                      -- 'Under-Eye Hollows')
  ('Muscle Tension',        'muscle-tension',        'manual', true)   -- massage
ON CONFLICT (slug) DO NOTHING;

COMMIT;
