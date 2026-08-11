-- ============================================================
-- Polls — Telegram-style poll as a post/message variant, usable both on
-- Church Feed (feed_posts) and inside group chat threads (chat_messages).
-- Real analytics behind it (response rate vs. eligible audience,
-- structural breakdown by cell/fellowship/branch, engagement timeline,
-- non-responder list, full per-voter attribution for the creator/
-- leadership) rather than a bare vote-count widget.
--
-- One poll schema shared by both surfaces rather than two parallel sets
-- of tables — the mechanics (question, options, single/multi vote,
-- vote-change, manual/scheduled close) are identical either way, only
-- the eligible-audience calculation differs (church/branch/department
-- structure for feed polls vs. chat_participants for chat polls), and
-- that lives in application code, not schema. feed_polls.post_id and
-- feed_polls.message_id are both nullable FKs; exactly one is set per
-- poll (CHECK below), pointing at the feed_posts or chat_messages row
-- that carries it. feed_posts.poll_id / chat_messages.poll_id are the
-- matching back-references so each renderer can tell a poll post/message
-- from a plain one with a single column check.
--
-- No "anonymous" mode: visibility is fixed, not configurable — everyone
-- who isn't the poll's creator or a leadership role only ever sees
-- aggregate tallies (enforced by the results endpoints simply refusing
-- to serve anyone else, not by a flag on this table); the creator and
-- leadership always get full per-voter attribution. See
-- src/lib/poll-analytics.ts and the /results routes.
--
-- Vote-changing is handled at the application layer, not via a partial
-- unique index: a re-vote deletes the caller's existing row(s) for that
-- poll and inserts the new selection(s) in one request. This works
-- identically for single-choice (one row survives) and multiple-choice
-- (the caller's full new selected set survives), so no CHECK/trigger is
-- needed to keep single-choice down to one row — the app enforces it by
-- construction. UNIQUE(poll_id, option_id, user_id) below only guards
-- against the same option being double-submitted within one multi-select
-- request.
--
-- Additive, idempotent — safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS feed_polls (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id            UUID UNIQUE REFERENCES feed_posts(id) ON DELETE CASCADE,
  message_id         UUID UNIQUE REFERENCES chat_messages(id) ON DELETE CASCADE,
  question           TEXT NOT NULL,
  poll_type          TEXT NOT NULL CHECK (poll_type IN ('single', 'multiple')),
  allow_vote_change  BOOLEAN NOT NULL DEFAULT true,
  closes_at          TIMESTAMPTZ,
  closed_by          UUID REFERENCES users(id),
  closed_at          TIMESTAMPTZ,
  created_by         UUID REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT feed_polls_exactly_one_parent CHECK (
    (CASE WHEN post_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN message_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
);

CREATE TABLE IF NOT EXISTS feed_poll_options (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id        UUID NOT NULL REFERENCES feed_polls(id) ON DELETE CASCADE,
  option_text    TEXT NOT NULL,
  display_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS feed_poll_votes (
  poll_id    UUID NOT NULL REFERENCES feed_polls(id) ON DELETE CASCADE,
  option_id  UUID NOT NULL REFERENCES feed_poll_options(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  voted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (poll_id, option_id, user_id)
);

-- The one column added to each existing table — nullable, so every row
-- that predates polls stays a plain post/message (poll_id IS NULL).
ALTER TABLE feed_posts    ADD COLUMN IF NOT EXISTS poll_id UUID REFERENCES feed_polls(id);
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS poll_id UUID REFERENCES feed_polls(id);

CREATE INDEX IF NOT EXISTS idx_feed_poll_options_poll ON feed_poll_options(poll_id, display_order ASC);
CREATE INDEX IF NOT EXISTS idx_feed_poll_votes_poll ON feed_poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_feed_poll_votes_poll_user ON feed_poll_votes(poll_id, user_id);
CREATE INDEX IF NOT EXISTS idx_feed_posts_poll ON feed_posts(poll_id) WHERE poll_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_poll ON chat_messages(poll_id) WHERE poll_id IS NOT NULL;

-- Verify: additive-only — no existing feed_posts/chat_messages row should
-- have picked up a poll_id from this migration, so this should always
-- return 0 for both.
SELECT
  (SELECT count(*) FROM feed_posts WHERE poll_id IS NOT NULL) AS unexpected_poll_posts,
  (SELECT count(*) FROM chat_messages WHERE poll_id IS NOT NULL) AS unexpected_poll_messages;
