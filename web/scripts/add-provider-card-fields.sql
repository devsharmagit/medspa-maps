-- Add editable "doctor card" fields to providers:
--   card_tagline  — short one/two-line pitch shown on the provider card
--   review_rating — customer rating displayed on the card (e.g. 4.9)
--   review_count  — number of reviews displayed on the card (e.g. 89)
-- These are manual/admin-editable values (not derived from the reviews table).

ALTER TABLE providers ADD COLUMN IF NOT EXISTS card_tagline  TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS review_rating NUMERIC(2,1);
ALTER TABLE providers ADD COLUMN IF NOT EXISTS review_count  INTEGER NOT NULL DEFAULT 0;
