-- ============================================================
-- Idempotency marker for the daily birthday-alert cron
-- Run in Supabase SQL editor
--
-- /api/care/trigger-birthday-alerts has no guard against being re-run the
-- same day (a manual admin re-run, or a retried cron invocation) — it
-- would re-notify every celebrant's whole leadership chain and re-post to
-- Church Feed a second time. This table is a one-row-per-(member,day)
-- marker: the route inserts into it first and only proceeds with the
-- notifications/feed post if that insert was a genuine new row, not a
-- duplicate of one already recorded for today.
-- ============================================================

CREATE TABLE IF NOT EXISTS birthday_alerts_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  alert_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, alert_date)
);

CREATE INDEX IF NOT EXISTS idx_birthday_alerts_sent_date ON birthday_alerts_sent(alert_date);
