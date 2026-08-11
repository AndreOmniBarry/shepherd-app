-- ══════════════════════════════════════════════════════════════════
-- PA financial/giving access gate.
--
-- Founder decision: PA is naturally pastoral-facing and already sees
-- membership, attendance, structure, events, workforce scheduling, and
-- pastoral care notes by default (commit 7fe1b14 made PA church-wide,
-- not branch-locked). The one category that stays gated is financial/
-- giving records — a PA is blocked from those by default and only sees
-- them once the GO (overseer/general_overseer — this codebase treats
-- them as the same effective top tier) explicitly grants it.
--
-- Simplest correct model for one gated category: a single boolean flag
-- on users, meaningful only for pa-role accounts. NULL/false = no
-- access (also the safe fallback for every pre-existing pa row, and for
-- JWTs issued before this field existed — see payloadToAuthUser in
-- src/lib/auth.ts). true = access granted by an overseer/general_overseer
-- via PATCH /api/admin/users (action: 'set_finance_access').
--
-- Additive only. Safe to re-run. No backfill needed — default false is
-- exactly the intended starting state for every existing pa account.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN IF NOT EXISTS finance_access_granted BOOLEAN NOT NULL DEFAULT false;

-- Verify: should return 0 (no NULLs — the DEFAULT above should have
-- covered every row, including pre-existing ones, since ALTER TABLE
-- ADD COLUMN ... DEFAULT backfills existing rows in Postgres).
SELECT count(*) AS unexpected_null_finance_access FROM users WHERE finance_access_granted IS NULL;
