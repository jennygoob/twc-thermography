-- ============================================================
-- THE WELLNESS CO. — Thermography System Migration
-- Run in Supabase SQL Editor (same instance as encounter ticket app)
-- ============================================================

-- Table: thermography_sessions (one per patient visit)
CREATE TABLE IF NOT EXISTS thermography_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) NOT NULL,
  prospyr_contact_id VARCHAR(100) NOT NULL,
  patient_name VARCHAR(200) NOT NULL,
  session_date TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  notes TEXT,
  performed_by VARCHAR(100),
  analysis_completed_at TIMESTAMPTZ,
  report_generated_at TIMESTAMPTZ,
  portal_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thermo_sessions_patient ON thermography_sessions(patient_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_thermo_sessions_date ON thermography_sessions(session_date DESC);

-- Table: thermography_images (individual captures within a session)
CREATE TABLE IF NOT EXISTS thermography_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES thermography_sessions(id) ON DELETE CASCADE NOT NULL,
  view_type VARCHAR(20) NOT NULL,
  capture_order INTEGER NOT NULL DEFAULT 0,
  radiometric_data_url TEXT,
  display_image_url TEXT,
  thumbnail_url TEXT,
  min_temp_celsius DECIMAL(5,2),
  max_temp_celsius DECIMAL(5,2),
  avg_temp_celsius DECIMAL(5,2),
  ambient_temp_celsius DECIMAL(5,2),
  emissivity DECIMAL(3,2) DEFAULT 0.98,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thermo_images_session ON thermography_images(session_id, capture_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_thermo_images_view ON thermography_images(session_id, view_type);

-- Table: thermography_findings (analysis results per session)
CREATE TABLE IF NOT EXISTS thermography_findings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES thermography_sessions(id) ON DELETE CASCADE NOT NULL,
  finding_type VARCHAR(30) NOT NULL,
  body_region VARCHAR(50) NOT NULL,
  severity VARCHAR(15) NOT NULL DEFAULT 'moderate',
  temperature_delta_celsius DECIMAL(5,2),
  peak_temperature_celsius DECIMAL(5,2),
  reference_temperature_celsius DECIMAL(5,2),
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  clinical_significance TEXT,
  recommended_treatments JSONB DEFAULT '[]',
  image_id UUID REFERENCES thermography_images(id),
  region_coords JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thermo_findings_session ON thermography_findings(session_id);
CREATE INDEX IF NOT EXISTS idx_thermo_findings_region ON thermography_findings(body_region);

-- Table: thermography_annotations (manual markings by provider)
CREATE TABLE IF NOT EXISTS thermography_annotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  image_id UUID REFERENCES thermography_images(id) ON DELETE CASCADE NOT NULL,
  annotation_type VARCHAR(20) NOT NULL,
  coordinates JSONB NOT NULL,
  label TEXT,
  color VARCHAR(7) DEFAULT '#FF0000',
  stroke_width INTEGER DEFAULT 2,
  created_by VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thermo_annotations_image ON thermography_annotations(image_id);

-- Table: thermography_reports (generated PDF metadata)
CREATE TABLE IF NOT EXISTS thermography_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES thermography_sessions(id) ON DELETE CASCADE NOT NULL,
  report_url TEXT,
  report_version INTEGER DEFAULT 1,
  portal_token VARCHAR(100),
  portal_synced BOOLEAN DEFAULT false,
  portal_synced_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thermo_reports_session ON thermography_reports(session_id);

-- ============================================================
-- RLS POLICIES (service-role-only access, same as feedback tables)
-- ============================================================
ALTER TABLE thermography_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE thermography_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE thermography_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE thermography_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE thermography_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON thermography_sessions FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON thermography_images FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON thermography_findings FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON thermography_annotations FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON thermography_reports FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- NOTE: Create Supabase Storage bucket "thermography" (private)
-- via Dashboard → Storage → New Bucket
-- ============================================================
