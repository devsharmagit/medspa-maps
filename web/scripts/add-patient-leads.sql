-- Patient leads captured from the public search flow and the AI Skin/Treatment
-- Navigator. A lead is collected before the visitor is shown search results or
-- navigator results, so we can follow up on the treatment/condition/location
-- they were looking for.
CREATE TABLE IF NOT EXISTS patient_leads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name     TEXT NOT NULL,
  last_name      TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT NOT NULL,
  -- Where the lead came from: 'search' (home/hero search bar) or
  -- 'skin_navigator' (AI Treatment Navigator).
  source         TEXT NOT NULL DEFAULT 'search'
                   CHECK (source IN ('search', 'skin_navigator')),
  treatment      TEXT,
  concern        TEXT,
  location       TEXT,
  -- Full navigator questionnaire payload (basics/goals/preferences), null for
  -- plain search leads.
  skin_navigator JSONB,
  ip_address     TEXT,
  user_agent     TEXT,
  -- Processing workflow (managed from the admin dashboard).
  status         TEXT NOT NULL DEFAULT 'new'
                   CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'rejected')),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_leads_created_at ON patient_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_leads_source ON patient_leads (source);
CREATE INDEX IF NOT EXISTS idx_patient_leads_email ON patient_leads (email);
CREATE INDEX IF NOT EXISTS idx_patient_leads_status ON patient_leads (status);

COMMENT ON TABLE patient_leads IS 'Patient contact leads captured before showing search / navigator results';
