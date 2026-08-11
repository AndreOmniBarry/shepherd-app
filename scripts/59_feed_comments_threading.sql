-- ============================================================
-- Threaded feed comments — one level of replies (a reply to a comment),
-- not full Reddit-style infinite nesting. `parent_comment_id` is nullable
-- so every existing comment (a top-level comment) is unaffected.
--
-- Additive, idempotent — safe to re-run.
-- ============================================================

ALTER TABLE feed_comments ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES feed_comments(id);

CREATE INDEX IF NOT EXISTS idx_feed_comments_parent ON feed_comments(parent_comment_id);

-- Verify: every existing comment should still be top-level after this
-- migration — this is an additive column add, not a backfill, so this
-- should always return 0.
SELECT count(*) AS unexpected_non_null_parent FROM feed_comments WHERE parent_comment_id IS NOT NULL;
