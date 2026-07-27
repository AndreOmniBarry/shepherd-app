-- SHEP.HERD — Remove demo/placeholder data, keep only real Grace Dome data.
--
-- PART 1 is safe to run as-is: these 6 email addresses only ever existed as
-- placeholder demo accounts (scripts/06_demo_users.sql, 06b_insert_user_profiles.sql)
-- with fake names (Sister Grace Adeyemi, Pastor Daniel Okonkwo, etc). None of
-- them appear anywhere in the real Grace Dome leader roster
-- (scripts/leaders_for_accounts.json) — confirmed by direct comparison.
--
-- PART 2 is a DIAGNOSTIC ONLY — it does not delete anything. It groups
-- members/cells/fellowships/departments by the minute they were created, so
-- the one big cluster from running 12_import_grace_dome_data.sql (hundreds of
-- rows within the same minute) is obvious, and anything outside that cluster
-- — leftover manual test entries — stands out for you to review before
-- anyone deletes it. Run Part 2, look at the results, and tell me what you
-- see; I'll turn it into an exact delete list rather than guessing.

-- ── PART 1: remove known demo user accounts ──────────────────────────────
DELETE FROM public.users
WHERE email IN (
  'pa@shepherd.app',
  'fellowshiphead@shepherd.app',
  'depthead@shepherd.app',
  'accounts@shepherd.app',
  'partnership@shepherd.app'
);
-- careteam@shepherd.app was already handled separately (deactivated, not
-- deleted, since you said Care Team will get a real assignment tomorrow).

-- ── PART 2: diagnostic — find anything outside the Grace Dome import batch ──
SELECT 'members' AS table_name, date_trunc('minute', created_at) AS batch_minute, count(*)
FROM members GROUP BY 2 ORDER BY 3 DESC;

SELECT 'cells' AS table_name, date_trunc('minute', created_at) AS batch_minute, count(*)
FROM cells GROUP BY 2 ORDER BY 3 DESC;

SELECT 'fellowships' AS table_name, date_trunc('minute', created_at) AS batch_minute, count(*)
FROM fellowships GROUP BY 2 ORDER BY 3 DESC;

SELECT 'departments' AS table_name, date_trunc('minute', created_at) AS batch_minute, count(*)
FROM departments GROUP BY 2 ORDER BY 3 DESC;

-- Whichever batch_minute has the huge count (hundreds for members, dozens
-- for cells) is the Grace Dome import. Anything in a different, small batch
-- is what needs a closer look — could be legitimate manual additions you've
-- made since, or leftover test data. Share what these return and I'll give
-- you an exact, safe delete statement for whatever's actually stray.

-- ── PART 3: is the dashboard showing ~1,000 members really your import? ──
-- 12_import_grace_dome_data.sql never sets gender or date_of_birth — it
-- only has name/phone/cell/fellowship. So if the real import is your only
-- batch of members, gender_filled and dob_filled below should both be ~0.
-- If instead most rows in a DIFFERENT batch_minute have gender/DOB filled
-- in, that batch was generated some other way (not your Excel import) and
-- is exactly what's inflating the member count and driving the age/gender
-- charts. Run this and share the output — it tells us precisely which
-- batch to delete.
SELECT date_trunc('minute', created_at) AS batch_minute,
       count(*) AS total_rows,
       count(gender) AS gender_filled,
       count(date_of_birth) AS dob_filled
FROM members
GROUP BY 1
ORDER BY 2 DESC;

-- ── PART 4: delete the confirmed synthetic batch ─────────────────────────
-- Your Part 3 results:
--   2026-06-03 22:09 -> 1,147 rows, gender_filled 1147, dob_filled 1147  <- SYNTHETIC (delete)
--   2026-07-22 19:06 ->   350 rows, gender_filled 0,    dob_filled 0     <- your real import (keep)
--   2026-07-22 21:19 ->     1 row,  gender_filled 0,    dob_filled 1     <- real, manually added since (keep)
--   2026-07-02 22:51 ->     1 row,  gender_filled 0,    dob_filled 0     <- real, manually added since (keep)
-- The 06-03 batch is the exact "1,147" figure that used to be hardcoded in
-- the dashboard's placeholder UI before that was fixed — someone seeded it
-- to match the mockup and it was never cleared. It predates your real
-- import (07-22) and every row has fabricated gender+DOB, which your real
-- import process never sets. Clearing dependent references first so the
-- delete can't fail on a foreign key, then removing the batch itself.
DELETE FROM event_registrations WHERE member_id IN (
  SELECT id FROM members WHERE created_at >= '2026-06-03 22:09:00+00' AND created_at < '2026-06-03 22:10:00+00'
);
DELETE FROM workforce_roster_entries WHERE member_id IN (
  SELECT id FROM members WHERE created_at >= '2026-06-03 22:09:00+00' AND created_at < '2026-06-03 22:10:00+00'
);
DELETE FROM workforce_profiles WHERE member_id IN (
  SELECT id FROM members WHERE created_at >= '2026-06-03 22:09:00+00' AND created_at < '2026-06-03 22:10:00+00'
);
DELETE FROM department_members WHERE member_id IN (
  SELECT id FROM members WHERE created_at >= '2026-06-03 22:09:00+00' AND created_at < '2026-06-03 22:10:00+00'
);
DELETE FROM department_attendance_entries WHERE member_id IN (
  SELECT id FROM members WHERE created_at >= '2026-06-03 22:09:00+00' AND created_at < '2026-06-03 22:10:00+00'
);
DELETE FROM attendance_entries WHERE member_id IN (
  SELECT id FROM members WHERE created_at >= '2026-06-03 22:09:00+00' AND created_at < '2026-06-03 22:10:00+00'
);
DELETE FROM absence_reports WHERE member_id IN (
  SELECT id FROM members WHERE created_at >= '2026-06-03 22:09:00+00' AND created_at < '2026-06-03 22:10:00+00'
);
UPDATE member_additions SET created_member_id = NULL WHERE created_member_id IN (
  SELECT id FROM members WHERE created_at >= '2026-06-03 22:09:00+00' AND created_at < '2026-06-03 22:10:00+00'
);

DELETE FROM members
WHERE created_at >= '2026-06-03 22:09:00+00' AND created_at < '2026-06-03 22:10:00+00';

-- ── VERIFY: should return exactly 352 (350 + 1 + 1) ──────────────────────
SELECT count(*) FROM members;

-- ── PART 5: diagnostic — duplicate / stray fellowships ───────────────────
-- 12_import_grace_dome_data.sql creates fellowships by exact-name match
-- ("Men's Fellowship" with an apostrophe). If a fellowship with a slightly
-- different name ("Men Fellowship", no apostrophe) already existed from
-- manual setup before the import ran, that WHERE NOT EXISTS check didn't
-- catch it and you now have two rows for the same real fellowship — one
-- holding the real cells/members, one empty or partially populated.
-- This also surfaces CYDF so we can confirm it's genuinely its own row
-- and not sharing an id with Youth/Men/Women anywhere.
-- DIAGNOSTIC ONLY — deletes nothing. Share the output and I'll write the
-- exact merge (reassign cells/members/users to the row you keep, then
-- delete the empty duplicate) rather than guessing which id survives.
SELECT f.id, f.name, f.created_at,
       (SELECT count(*) FROM cells c WHERE c.fellowship_id = f.id) AS cell_count,
       (SELECT count(*) FROM members m WHERE m.fellowship_id = f.id) AS member_count,
       (SELECT count(*) FROM users u WHERE u.fellowship_id = f.id AND u.role = 'fellowship_head') AS head_accounts
FROM fellowships f
ORDER BY f.name, f.created_at;
