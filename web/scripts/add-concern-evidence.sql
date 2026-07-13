-- Concern-based clinic discovery: AI-grown concern catalog + on-page evidence.
--
-- 1. concerns.origin — mirrors services.origin ('seed' | 'ai' | 'manual').
--    reconcile-taxonomy.ts only deletes non-priority rows with origin='seed',
--    so AI-grown concerns survive re-runs.
ALTER TABLE concerns ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'seed';

-- 2. Per-clinic scraped evidence. Membership itself lives in clinic_concerns
--    (source='scraped'); this table holds the verbatim proof (quote + page) and
--    the clinic-specific concern→treatment pairing stated on that page. A
--    concern can carry several evidence rows (multiple pages/phrasings).
CREATE TABLE IF NOT EXISTS clinic_concern_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  concern_id uuid NOT NULL REFERENCES concerns(id) ON DELETE CASCADE,
  raw_phrase text NOT NULL,                         -- concern exactly as the site names it
  evidence_quote text NOT NULL,                     -- verbatim sentence from the page (machine-verified)
  source_url text NOT NULL,
  paired_treatments text[] NOT NULL DEFAULT '{}',   -- verbatim treatment names the page pairs with it
  paired_service_ids uuid[] NOT NULL DEFAULT '{}',  -- resolved against the clinic's services when possible
  extracted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, concern_id, source_url, raw_phrase)
);

CREATE INDEX IF NOT EXISTS idx_cce_clinic ON clinic_concern_evidence (clinic_id);
CREATE INDEX IF NOT EXISTS idx_cce_concern ON clinic_concern_evidence (concern_id);
