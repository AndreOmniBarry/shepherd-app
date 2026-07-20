-- Fix trial dates so countdown works correctly
UPDATE church_config
SET 
  trial_started_at = NOW(),
  trial_ends_at = NOW() + INTERVAL '30 days',
  subscription_status = 'trial',
  plan_tier = 'trial'
WHERE trial_ends_at IS NULL OR trial_started_at IS NULL;

-- Verify
SELECT church_name, plan_tier, subscription_status, trial_started_at, trial_ends_at,
  EXTRACT(DAY FROM (trial_ends_at - NOW()))::int as days_remaining
FROM church_config;
