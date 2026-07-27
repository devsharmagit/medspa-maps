-- Clinic (B2B) leads captured from the public "List your medspa" form in the
-- site footer (components/hero/resources-section.tsx). Replaces the old
-- Growth99 iframe widget, whose submissions landed in the G99 DB where this app
-- could not see them.
--
-- Scope is deliberately narrow: collect contact info only (name / business email
-- / business name) and show the visitor a "coming soon" message. There is no
-- routing to a sales team yet.
--
-- Distinct from patient_leads, which are consumer leads from search / the AI
-- Skin Navigator.
CREATE TABLE IF NOT EXISTS clinic_leads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name      TEXT NOT NULL,
  business_email TEXT NOT NULL,
  business_name  TEXT NOT NULL,
  ip_address     TEXT,
  user_agent     TEXT,
  -- Processing workflow (managed from the admin dashboard). Same status set as
  -- patient_leads so the admin UI can share its labels/styles.
  status         TEXT NOT NULL DEFAULT 'new'
                   CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'rejected')),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinic_leads_created_at ON clinic_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinic_leads_status ON clinic_leads (status);
CREATE INDEX IF NOT EXISTS idx_clinic_leads_email ON clinic_leads (business_email);

COMMENT ON TABLE clinic_leads IS 'Clinic owner leads captured from the public "List your medspa" form';
