-- ============================================================
-- Prayer requests were reporting "submitted successfully" to the member
-- (and even pinging the pastor's notification bell) while the actual row
-- silently failed to insert — the API code never checked whether the
-- insert succeeded before responding (fixed in the app code separately).
-- The most likely reason an insert would fail at all here is the same
-- stale-foreign-key bug already found twice this session (invites,
-- notifications): submitted_by referencing auth.users instead of this
-- app's own public.users table. This re-points it, exactly like those
-- two fixes.
--
-- PART 1 — confirm the current target of the constraint before touching it
-- ============================================================
SELECT conname, confrelid::regclass AS references_table
FROM pg_constraint
WHERE conrelid = 'prayer_requests'::regclass AND contype = 'f';

-- PART 2 — drop and recreate pointing at public.users
ALTER TABLE prayer_requests DROP CONSTRAINT IF EXISTS prayer_requests_submitted_by_fkey;
ALTER TABLE prayer_requests
  ADD CONSTRAINT prayer_requests_submitted_by_fkey
  FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL;

-- PART 3 — verify
SELECT conname, confrelid::regclass AS references_table
FROM pg_constraint
WHERE conrelid = 'prayer_requests'::regclass AND contype = 'f';
