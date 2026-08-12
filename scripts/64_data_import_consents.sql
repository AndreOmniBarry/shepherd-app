-- ============================================================
-- SHEP.HERD — Data import template consent log
-- Run in Supabase SQL editor
--
-- Every time an admin downloads the blank church-data-import Excel
-- template via /api/admin/import-template, they must first check "I have
-- reviewed this and the data provided is accurate" — this table is the
-- durable record of that acknowledgment (who, which church, when), the
-- same audit-trail pattern as account_violations. Written by the API
-- route itself, never by the client directly.
-- ============================================================

CREATE TABLE IF NOT EXISTS data_import_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_data_import_consents_church ON data_import_consents (church_id, accepted_at DESC);
