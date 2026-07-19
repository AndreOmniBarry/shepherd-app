-- ============================================================
-- SHEP.HERD — Church Configuration Table
-- Run this in Supabase SQL editor
-- ============================================================

CREATE TABLE IF NOT EXISTS church_config (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  church_name   TEXT NOT NULL DEFAULT 'My Church',
  structure_type TEXT NOT NULL DEFAULT 'cell_church'
    CHECK (structure_type IN ('cell_church','zonal','campus','department','house_network','single')),
  tier1_label   TEXT,
  tier2_label   TEXT,
  tier3_label   TEXT,
  tier1_head_label TEXT NOT NULL DEFAULT 'Fellowship Head',
  tier2_head_label TEXT NOT NULL DEFAULT 'Cell Leader',
  currency      TEXT NOT NULL DEFAULT 'NGN',
  country       TEXT NOT NULL DEFAULT 'Nigeria',
  timezone      TEXT NOT NULL DEFAULT 'Africa/Lagos',
  service_days  TEXT[] NOT NULL DEFAULT ARRAY['Sunday'],
  logo_url      TEXT,
  is_configured BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Comforters House config (existing church — already configured)
INSERT INTO church_config (
  church_name, structure_type,
  tier1_label, tier2_label, tier3_label,
  tier1_head_label, tier2_head_label,
  currency, country, timezone, service_days, is_configured
) VALUES (
  'The Comforters House Global', 'cell_church',
  'Fellowship', 'Cell', NULL,
  'Fellowship Head', 'Cell Leader',
  'NGN', 'Nigeria', 'Africa/Lagos',
  ARRAY['Sunday', 'Wednesday'], true
)
ON CONFLICT DO NOTHING;

-- RLS: All authenticated users can read config
-- Only overseer/lead_tech/pa can write
ALTER TABLE church_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "church_config_read" ON church_config
  FOR SELECT USING (true);

CREATE POLICY "church_config_write" ON church_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('overseer', 'lead_tech', 'pa')
    )
  );
