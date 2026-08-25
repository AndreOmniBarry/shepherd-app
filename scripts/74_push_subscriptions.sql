-- ============================================================
-- Web Push subscriptions
-- Run in Supabase SQL editor
--
-- Backs real OS-level push notifications (an alert even when the app/tab
-- is closed) — the in-tab chime + badge in NotificationBell already
-- existed, but had no way to reach a user who isn't looking at an open
-- tab. One row per browser/device a user has granted notification
-- permission on and subscribed from; a user with two devices (phone +
-- laptop) gets two rows and is pushed to both.
--
-- endpoint is UNIQUE (not user_id) because it's the actual push-service
-- URL the browser handed out for that specific subscription — re-running
-- the subscribe flow on the same device re-registers under the same
-- endpoint and should simply refresh keys/user_id, not create a duplicate
-- row (see the API route's upsert with on_conflict=endpoint).
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);
