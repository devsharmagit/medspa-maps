-- Seed dummy/better data for provider "doctor card" fields.
-- Deterministic per-row variation via md5(id) so re-runs are stable.

UPDATE providers SET
  review_rating = 4.7 + (('x' || substr(md5(id::text), 1, 4))::bit(16)::int % 4) * 0.1,

  review_count  = 40 + (('x' || substr(md5(id::text), 5, 4))::bit(16)::int % 170),

  years_experience = COALESCE(
    years_experience,
    8 + (('x' || substr(md5(id::text), 9, 2))::bit(8)::int % 10)
  ),

  card_tagline = CASE
    WHEN title ILIKE '%inject%'       THEN 'Expert in Botox, fillers, and injectable treatments. Delivers soft, natural-looking results.'
    WHEN title ILIKE '%laser%'        THEN 'Specializes in laser skin resurfacing and injectables for smooth, radiant skin.'
    WHEN title ILIKE '%dermatolog%'   THEN 'Board-certified expertise in medical and cosmetic dermatology for healthy, glowing skin.'
    WHEN title ILIKE '%director%'     THEN 'Leads a full-service aesthetic practice delivering safe, natural, transformative results.'
    WHEN title ILIKE '%nurse%'
      OR title ILIKE '%RN%'
      OR title ILIKE '%NP%'          THEN 'Skilled in injectables and advanced aesthetics with a gentle, personalized touch.'
    ELSE                                   'Provides personalized aesthetic care with natural-looking, confidence-boosting results.'
  END

WHERE review_rating IS NULL OR card_tagline IS NULL;

-- Give any provider still missing a bio a reasonable default.
UPDATE providers SET
  bio = 'With ' || COALESCE(years_experience, 10) || '+ years of experience, ' || name ||
        ' combines clinical precision with an artistic eye to help every patient look refreshed, natural, and confident.'
WHERE bio IS NULL OR btrim(bio) = '';
