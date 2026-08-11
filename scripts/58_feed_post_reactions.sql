-- ============================================================
-- Feed post reactions — the Facebook-style multi-emoji "like/love/etc"
-- layer on top of the existing feed_acknowledgements mechanism.
--
-- feed_acknowledgements is NOT replaced or repurposed here — it stays the
-- distinct "who has actually seen/heeded this" signal it always was
-- (see scripts/40_church_feed.sql). feed_post_reactions is purely the
-- new lightweight emoji-reaction layer, modeled 1:1 on the existing
-- chat_reactions table (scripts/41_chat.sql): one reaction per user per
-- post, picking a new emoji replaces the old one.
--
-- Additive, idempotent — safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS feed_post_reactions (
  post_id     UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_post_reactions_post ON feed_post_reactions(post_id);
