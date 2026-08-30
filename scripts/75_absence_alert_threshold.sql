-- ============================================================
-- Configurable absence-alert threshold
-- Run in Supabase SQL editor
--
-- /api/care/trigger-alerts previously created a care lead the instant a
-- member missed a single Sunday, with no way for a church to change
-- that. This adds a per-church setting for how many CONSECUTIVE missed
-- Sundays it takes before that escalation happens.
--
-- Purely additive: nullable-with-default column, existing rows get the
-- default (1) automatically, which is exactly today's fixed behavior —
-- no church's alerts change unless they actually open Settings and
-- change the number.
-- ============================================================

ALTER TABLE church_config ADD COLUMN IF NOT EXISTS absence_alert_threshold INTEGER NOT NULL DEFAULT 1;

-- Postgres has no "ADD CONSTRAINT IF NOT EXISTS" — guard manually so this
-- script is safe to re-run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'absence_alert_threshold_range'
  ) THEN
    ALTER TABLE church_config ADD CONSTRAINT absence_alert_threshold_range CHECK (absence_alert_threshold BETWEEN 1 AND 6);
  END IF;
END $$;
