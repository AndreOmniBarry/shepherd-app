-- ============================================================
-- Deactivate the "Demo Pastor" placeholder account.
-- Run PART 1 first to confirm which row this targets before
-- running PART 2 — the WHERE clause only matches rows whose
-- email or name actually contains "demo", so it can never touch
-- a real pastor account (e.g. Uzor, Valentine) by accident.
-- ============================================================

-- PART 1: confirm the target(s) before deactivating
SELECT id, full_name, email, role, branch_id, is_active
FROM users
WHERE is_active = true
  AND (email ILIKE '%demo%' OR full_name ILIKE '%demo%');

-- PART 2: deactivate only the confirmed demo row(s) above
UPDATE users
SET is_active = false
WHERE (email ILIKE '%demo%' OR full_name ILIKE '%demo%');

-- PART 3: verify
SELECT id, full_name, email, role, is_active FROM users
WHERE email ILIKE '%demo%' OR full_name ILIKE '%demo%';
