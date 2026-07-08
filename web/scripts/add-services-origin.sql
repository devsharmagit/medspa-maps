-- Add an `origin` marker to the canonical services catalog.
--   'seed'   — one of the curated Phase-0 treatments (seeded by reconcile-taxonomy.ts)
--   'ai'     — a general treatment created on the fly by the AI ingest resolver
--   'manual' — created/edited by an admin
-- reconcile-taxonomy.ts only deletes rows with origin='seed' that are outside the
-- curated set, so AI-grown / manual treatments survive re-runs.
ALTER TABLE services ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'seed';
