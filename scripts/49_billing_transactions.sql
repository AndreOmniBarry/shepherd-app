-- ============================================================
-- SHEP.HERD — Billing transactions (Paystack)
-- Run in Supabase SQL editor
--
-- One row per verified Paystack transaction — written by
-- PATCH /api/subscription (self-service upgrade) and by
-- POST /api/webhooks/paystack (charge.success / subscription events).
-- The UNIQUE constraint on paystack_reference is the actual replay
-- guard: a client-supplied reference can only ever upgrade a church
-- once, no matter how many times the same request is retried/replayed.
-- ============================================================

CREATE TABLE IF NOT EXISTS billing_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  paystack_reference TEXT NOT NULL UNIQUE,
  plan_tier TEXT NOT NULL CHECK (plan_tier IN ('starter', 'growth', 'enterprise')),
  amount_ngn NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  source TEXT NOT NULL DEFAULT 'self_service' CHECK (source IN ('self_service', 'webhook')),
  raw_event JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_transactions_church ON billing_transactions (church_id, created_at DESC);
