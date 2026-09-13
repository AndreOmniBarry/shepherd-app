-- ============================================================
-- feed_groups -- every existing church is missing its church-wide feed group
-- Run in Supabase SQL editor
--
-- Church Feed's main, church-wide feed reads from the one feed_groups row
-- with type='church' for a given church (see GET /api/feed/groups). No
-- code path anywhere in this app has ever created that row -- confirmed
-- by reading every file that touches feed_groups, and independently
-- confirmed against every real church created this session through the
-- actual /setup flow: zero of them had a feed_groups row of any kind.
-- Church Feed has never actually had anything to post into or read from
-- for any church.
--
-- bootstrapChurch() in /api/settings/church-config now creates this row
-- for every NEW church going forward (see the app-code change in this
-- same PR), but that does nothing for churches that already went through
-- setup before this fix. This backfills them: one 'church'-type,
-- church-wide (branch_id null, so every branch-scoped user sees it too --
-- see the branch_id.is.null OR-clause in GET /api/feed/groups) feed group
-- per existing church that doesn't already have one.
--
-- Idempotent: only inserts for a church_id with no existing type='church'
-- row, so safe to run more than once.
-- ============================================================

INSERT INTO feed_groups (type, church_id, branch_id, name)
SELECT 'church', c.id, NULL, 'Church Feed'
FROM churches c
WHERE NOT EXISTS (
  SELECT 1 FROM feed_groups fg WHERE fg.church_id = c.id AND fg.type = 'church'
);
