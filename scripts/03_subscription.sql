-- ============================================================
-- SHEP.HERD — Subscription & Trial Schema
-- Run in Supabase SQL editor
-- ============================================================

ALTER TABLE church_config 
  ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'trial'
    CHECK (plan_tier IN ('trial','starter','growth','enterprise')),
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial'
    CHECK (subscription_status IN ('trial','active','expired','cancelled')),
  ADD COLUMN IF NOT EXISTS paystack_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS paystack_subscription_code TEXT,
  ADD COLUMN IF NOT EXISTS church_profile JSONB,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Update Comforters House to active growth (existing church)
UPDATE church_config 
SET plan_tier = 'growth',
    subscription_status = 'active',
    subscription_started_at = NOW(),
    trial_ends_at = NOW() + INTERVAL '3650 days'
WHERE church_name = 'The Comforters House Global';

-- View for lead tech admin portal
CREATE OR REPLACE VIEW church_overview AS
SELECT 
  id,
  church_name,
  country,
  structure_type,
  tier1_label,
  tier2_label,
  plan_tier,
  subscription_status,
  trial_started_at,
  trial_ends_at,
  GREATEST(0, EXTRACT(DAY FROM (trial_ends_at - NOW()))::int) as trial_days_remaining,
  subscription_started_at,
  is_configured,
  church_profile,
  created_at
FROM church_config
ORDER BY created_at DESC;
