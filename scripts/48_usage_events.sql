-- ============================================================
-- SHEP.HERD — Usage events (Moshe AI / SMS / WhatsApp spend tracking)
-- Run in Supabase SQL editor
--
-- Every Moshe query and every SMS/WhatsApp send gets one row here,
-- logged by src/lib/usage.ts. This is what the tech-admin command
-- center reads to show live spend-rate per church, and what
-- src/lib/plan-gate.ts's quota check reads to know whether a given
-- church is still inside its plan's included monthly quota.
--
-- cost_ngn is OUR estimated infra/provider cost for that single event
-- (for margin visibility) — separate from billable_overage, which
-- marks whether this event landed after the church's plan quota was
-- already used up for the month. Overage isn't auto-charged yet
-- (no live payment customers to charge) — it's surfaced on the
-- command center for a human to invoice/upsell.
-- ============================================================

CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('moshe', 'sms', 'whatsapp')),
  cost_ngn NUMERIC(10,2) NOT NULL DEFAULT 0,
  billable_overage BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Command center's core query shape: this church's spend this month, by type.
CREATE INDEX IF NOT EXISTS idx_usage_events_church_type_time ON usage_events (church_id, type, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_time ON usage_events (created_at);
