-- ============================================================
-- SHEP.HERD — Account violations & suspension audit trail
-- Run in Supabase SQL editor
--
-- Mentor review feedback: retain the right to permanently disable a user
-- who violates terms of use (e.g. attempting to bypass payment/subscription
-- gates), with a real record of why. Two tables:
--
-- account_violations: every suspend/reinstate action taken on a user,
-- who did it, and why — written by PATCH /api/admin/users, read on the
-- admin Team & Access panel. This is the audit trail that makes a
-- suspension defensible, not just a silent flag flip.
--
-- access_violations: every blocked attempt at a premium-gated action
-- (Moshe, SMS, Chat) — written by src/lib/plan-gate.ts on every 403 it
-- returns. src/lib/health-checks.ts reads this to flag a church with an
-- unusual volume of blocked attempts as a possible-bypass system_alert,
-- surfaced on the existing Health & Alerts admin tab (no new UI needed).
-- ============================================================

CREATE TABLE IF NOT EXISTS account_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('suspended', 'reinstated')),
  reason TEXT NOT NULL,
  actor_id UUID REFERENCES users(id), -- the admin who took the action
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_account_violations_user ON account_violations (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS access_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  gate TEXT NOT NULL, -- 'premium' | 'chat'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_access_violations_church_time ON access_violations (church_id, created_at);
