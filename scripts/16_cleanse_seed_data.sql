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
-- This column should already exist from 13_member_extra_columns.sql, but
-- that script errored out before adding it on your database, so it's
-- included here too (idempotent — safe either way).
ALTER TABLE member_additions ADD COLUMN IF NOT EXISTS created_member_id UUID REFERENCES members(id);

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

-- ── PART 6: point CYDF's head at the real, independent CYDF fellowship ──
-- David Osasenaga (david.osasenaga@shepherd.app) was set up as "Teenager's
-- Fellowship Head" in leaders_for_accounts.json, but you've confirmed he's
-- actually the CYDF head — and CYDF must stay independent of Men/Women/
-- Youth, not nested under any of them. The app already has a real CYDF
-- fellowship id, hardcoded in /api/fellowship/cydf-headcount because it
-- predates this scripted setup: cb72d6c2-a206-45b9-895c-a26d705d2367.
-- This only repoints his account — it does not touch any cells or members.
-- Diagnostic first, so you can see his current fellowship before it changes:
SELECT u.email, u.full_name, u.fellowship_id AS current_fellowship_id, f.name AS current_fellowship_name
FROM users u LEFT JOIN fellowships f ON f.id = u.fellowship_id
WHERE u.email = 'david.osasenaga@shepherd.app';

UPDATE users SET fellowship_id = 'cb72d6c2-a206-45b9-895c-a26d705d2367'
WHERE email = 'david.osasenaga@shepherd.app';

-- If "Teenager's Fellowship" (whatever he was pointed at before) turns out
-- to be a real fellowship with its own cells/members distinct from CYDF,
-- tell me and I'll give you a proper plan for it (new head account, or
-- merge into CYDF) rather than leaving it orphaned by this update.

-- ── PART 7: fix confirmed CYDF/Men/Women duplicates ──────────────────────
-- Confirmed via Part 5 + follow-up checks:
--   - cydf@shepherd.app ("Demo CYDF Head") is a leftover placeholder
--     account, same species as the ones already deleted in Part 1.
--   - "Men Fellowship" (no apostrophe, 679d5222-0848-4f88-8ea7-e20a11f8b4e1)
--     has 10 cells and 1 head account, but 0 members.
--   - "Men's Fellowship" (apostrophe, a62b19bf-1753-479d-8586-cb9dfd735a69)
--     has your 29 real members, but 0 cells — and every one of those 29
--     has cell_id = NULL, so they aren't in any of the 10 cells either.
--   - Same shape for Women: "Women Fellowship" (no apostrophe,
--     d161ae2c-2a70-4062-947c-eeefc6d2c27c) has 17 empty cells; "Women's
--     Fellowship" (apostrophe, b63b7285-ce63-4685-87ed-498c6d7c1035) has
--     your 46 real members, all with cell_id = NULL.
-- This moves the 10/17 cells and the 1 head account onto the fellowship
-- that actually holds the real members, then removes the now-empty
-- duplicate rows. It does NOT assign the 29/46 members into a cell yet —
-- that's the "put all the men in one cell" step, which needs you to pick
-- which cell survives (via the Merge Cells tool once this runs, or tell me
-- the cell name and I'll write the one-line member assignment for you).
DELETE FROM users WHERE email = 'cydf@shepherd.app';

UPDATE cells SET fellowship_id = 'a62b19bf-1753-479d-8586-cb9dfd735a69'
WHERE fellowship_id = '679d5222-0848-4f88-8ea7-e20a11f8b4e1';
UPDATE users SET fellowship_id = 'a62b19bf-1753-479d-8586-cb9dfd735a69'
WHERE fellowship_id = '679d5222-0848-4f88-8ea7-e20a11f8b4e1';
DELETE FROM fellowships WHERE id = '679d5222-0848-4f88-8ea7-e20a11f8b4e1';

UPDATE cells SET fellowship_id = 'b63b7285-ce63-4685-87ed-498c6d7c1035'
WHERE fellowship_id = 'd161ae2c-2a70-4062-947c-eeefc6d2c27c';
UPDATE users SET fellowship_id = 'b63b7285-ce63-4685-87ed-498c6d7c1035'
WHERE fellowship_id = 'd161ae2c-2a70-4062-947c-eeefc6d2c27c';
DELETE FROM fellowships WHERE id = 'd161ae2c-2a70-4062-947c-eeefc6d2c27c';

-- Verify — Men's/Women's Fellowship should now each show their real
-- member count plus the 10/17 cells; the no-apostrophe rows should be gone.
SELECT f.id, f.name,
       (SELECT count(*) FROM cells c WHERE c.fellowship_id = f.id) AS cell_count,
       (SELECT count(*) FROM members m WHERE m.fellowship_id = f.id) AS member_count
FROM fellowships f
WHERE f.name IN ('Men''s Fellowship', 'Women''s Fellowship')
ORDER BY f.name;

-- ── PART 8: one cell for all of Men's Fellowship, for now ────────────────
-- Pastor's plan is to migrate members and set up a proper cell structure
-- later — until then, per your instruction, all 29 Men's Fellowship
-- members go into a single cell, named "Men's Fellowship" as a
-- placeholder. Repurposing "Covenant Cell" (none of the 10 have any
-- members, so which one doesn't matter) rather than creating a new row;
-- the other 9 are deactivated, not deleted, so nothing is lost once the
-- real cell structure is ready.
UPDATE cells SET name = 'Men''s Fellowship'
WHERE id = 'd670b4d2-3e1f-4cfb-b246-e5ac83920e7b';

UPDATE members SET cell_id = 'd670b4d2-3e1f-4cfb-b246-e5ac83920e7b'
WHERE fellowship_id = 'a62b19bf-1753-479d-8586-cb9dfd735a69';

UPDATE cells SET is_active = false
WHERE fellowship_id = 'a62b19bf-1753-479d-8586-cb9dfd735a69'
  AND id != 'd670b4d2-3e1f-4cfb-b246-e5ac83920e7b';

-- Verify — should show 1 active cell, 29 members in it
SELECT c.name, c.is_active, (SELECT count(*) FROM members m WHERE m.cell_id = c.id) AS members_in_cell
FROM cells c
WHERE c.fellowship_id = 'a62b19bf-1753-479d-8586-cb9dfd735a69'
ORDER BY c.is_active DESC, c.name;
