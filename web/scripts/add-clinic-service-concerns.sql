-- Clinic-specific treatment -> concern mappings extracted by the unified AI
-- treatments/concerns ingest. This is intentionally separate from the global
-- concern_services taxonomy: the same service can solve different concerns at
-- different clinics depending on what that clinic actually advertises.

CREATE TABLE IF NOT EXISTS clinic_service_concerns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  concern_id uuid NOT NULL REFERENCES concerns(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'scraped',
  raw_service_name text,
  raw_concern_name text,
  source_url text,
  is_active boolean NOT NULL DEFAULT true,
  extracted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, service_id, concern_id, source)
);

CREATE INDEX IF NOT EXISTS idx_csc_clinic ON clinic_service_concerns (clinic_id);
CREATE INDEX IF NOT EXISTS idx_csc_service ON clinic_service_concerns (service_id);
CREATE INDEX IF NOT EXISTS idx_csc_concern ON clinic_service_concerns (concern_id);

