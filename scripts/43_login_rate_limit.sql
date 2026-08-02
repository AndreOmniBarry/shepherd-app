-- ============================================================
-- Login brute-force lockout — /api/auth/login had no attempt limit at
-- all, so a script could try unlimited passwords against any account
-- with zero delay. Adds a per-user failure counter and a lockout
-- timestamp; the route itself enforces the threshold (5 attempts / 15
-- minute lock) and resets the counter on a successful sign-in.
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
