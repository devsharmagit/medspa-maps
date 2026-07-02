-- Create medspa_leads table for collecting business inquiries
CREATE TABLE IF NOT EXISTS medspa_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  business_email TEXT NOT NULL,
  business_name TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'rejected')),
  notes TEXT,
  source TEXT DEFAULT 'website',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  contacted_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_medspa_leads_status ON medspa_leads(status);
CREATE INDEX IF NOT EXISTS idx_medspa_leads_created_at ON medspa_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medspa_leads_email ON medspa_leads(business_email);

-- Create trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_medspa_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_medspa_leads_updated_at
  BEFORE UPDATE ON medspa_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_medspa_leads_updated_at();

-- Add comment
COMMENT ON TABLE medspa_leads IS 'Stores business leads from the "List your medspa" form';
