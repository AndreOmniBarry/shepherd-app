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
FROM members GROUP BY 1 ORDER BY 3 DESC;

SELECT 'cells' AS table_name, date_trunc('minute', created_at) AS batch_minute, count(*)
FROM cells GROUP BY 1 ORDER BY 3 DESC;

SELECT 'fellowships' AS table_name, date_trunc('minute', created_at) AS batch_minute, count(*)
FROM fellowships GROUP BY 1 ORDER BY 3 DESC;

SELECT 'departments' AS table_name, date_trunc('minute', created_at) AS batch_minute, count(*)
FROM departments GROUP BY 1 ORDER BY 3 DESC;

-- Whichever batch_minute has the huge count (hundreds for members, dozens
-- for cells) is the Grace Dome import. Anything in a different, small batch
-- is what needs a closer look — could be legitimate manual additions you've
-- made since, or leftover test data. Share what these return and I'll give
-- you an exact, safe delete statement for whatever's actually stray.
