-- ============================================================
-- SHEP.HERD — System Alerts (technical triage for the lead-tech
-- admin panel)
-- Run in Supabase SQL editor
--
-- Populated by src/lib/health-checks.ts, invoked periodically via
-- POST /api/admin/health-check (protected by CRON_SECRET — wire up
-- a Vercel Cron entry in vercel.json, or any external scheduler, to
-- call it on an interval). Read/acknowledged/resolved via
-- /api/admin/alerts, surfaced on the "Health" tab of /admin.
-- ============================================================

CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID REFERENCES church_config(id) ON DELETE CASCADE, -- null = platform-wide
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'medium', 'low')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  metadata JSONB,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- One open alert per church+category at a time — health-checks.ts
-- upserts against this instead of spawning duplicates on every run.
CREATE UNIQUE INDEX IF NOT EXISTS system_alerts_open_dedupe
  ON system_alerts (COALESCE(church_id, '00000000-0000-0000-0000-000000000000'), category)
  WHERE status != 'resolved';

CREATE INDEX IF NOT EXISTS system_alerts_severity_idx ON system_alerts (severity, status);
CREATE INDEX IF NOT EXISTS system_alerts_church_idx ON system_alerts (church_id);
