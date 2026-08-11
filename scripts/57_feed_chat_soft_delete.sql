-- ============================================================
-- Phase 1 of the Church Feed / Chat "wall" upgrade — soft-delete with
-- Telegram-style tombstones.
--
-- Deleting a post/comment/message never removes the row (that would break
-- comment/reply threading and message ordering). Instead the row is
-- marked deleted_at/deleted_by; the API layer replaces `body` with a
-- fixed tombstone string for anyone who isn't the author/deleter, and the
-- frontend renders that as "This post/message was deleted".
--
-- Additive, idempotent — safe to re-run.
-- ============================================================

ALTER TABLE feed_posts    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE feed_posts    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);

ALTER TABLE feed_comments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE feed_comments ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);

-- Verify: every existing row should be untouched (not deleted) — this is
-- an additive migration, not a backfill, so this should always return 0.
SELECT
  (SELECT count(*) FROM feed_posts    WHERE deleted_at IS NOT NULL) AS unexpected_deleted_posts,
  (SELECT count(*) FROM feed_comments WHERE deleted_at IS NOT NULL) AS unexpected_deleted_comments,
  (SELECT count(*) FROM chat_messages WHERE deleted_at IS NOT NULL) AS unexpected_deleted_messages;
