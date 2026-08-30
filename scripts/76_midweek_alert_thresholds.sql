-- ============================================================
-- Configurable midweek absence-alert thresholds
-- Run in Supabase SQL editor
--
-- /api/care/trigger-midweek-alerts previously hardcoded its two-stage
-- escalation (a soft alert to the cell leader after 2 missed Wednesdays,
-- a full care-team lead after 3) with no way for a church to change
-- either number — same gap as the Sunday absence threshold fixed in
-- scripts/75, now closed the same way for midweek.
--
-- Purely additive: both columns default to today's fixed behavior (2/3),
-- so no church's alerts change unless they actually open Settings and
-- change the numbers.
-- ============================================================

ALTER TABLE church_config ADD COLUMN IF NOT EXISTS midweek_soft_alert_threshold INTEGER NOT NULL DEFAULT 2;
ALTER TABLE church_config ADD COLUMN IF NOT EXISTS midweek_care_lead_threshold INTEGER NOT NULL DEFAULT 3;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'midweek_soft_alert_threshold_range') THEN
    ALTER TABLE church_config ADD CONSTRAINT midweek_soft_alert_threshold_range CHECK (midweek_soft_alert_threshold BETWEEN 1 AND 8);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'midweek_care_lead_threshold_range') THEN
    ALTER TABLE church_config ADD CONSTRAINT midweek_care_lead_threshold_range CHECK (midweek_care_lead_threshold BETWEEN 1 AND 8);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'midweek_threshold_order') THEN
    ALTER TABLE church_config ADD CONSTRAINT midweek_threshold_order CHECK (midweek_care_lead_threshold > midweek_soft_alert_threshold);
  END IF;
END $$;
