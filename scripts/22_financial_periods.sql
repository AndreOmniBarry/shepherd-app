-- Lock-step reconciliation: once a month is closed, income entries for that
-- month can no longer be added as if they were part of the original total —
-- new entries for a closed month must be explicitly logged as an adjustment,
-- so a closed month's reported figure never silently changes after the fact.

CREATE TABLE IF NOT EXISTS financial_periods (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month DATE UNIQUE NOT NULL,      -- always the 1st of the month
  closed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_by   UUID REFERENCES users(id),
  note        TEXT
);

ALTER TABLE income_records ADD COLUMN IF NOT EXISTS is_adjustment BOOLEAN DEFAULT false;
ALTER TABLE income_records ADD COLUMN IF NOT EXISTS adjustment_note TEXT;
