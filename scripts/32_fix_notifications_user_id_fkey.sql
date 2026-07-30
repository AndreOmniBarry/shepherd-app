-- Confirmed via live error: "insert or update on table notifications
-- violates foreign key constraint notifications_user_id_fkey" when
-- commending a leader whose id is a real, valid row in the users table.
-- Same root cause already found and fixed once before for
-- invites_created_by_fkey — a leftover constraint from an early
-- Supabase-Auth-style setup pointing notifications.user_id at auth.users
-- instead of the app's own users table. Every notification insert for a
-- custom (non Supabase-Auth) user id has been silently at risk of this,
-- not just commendations — this just happened to be the one that got
-- exercised and caught it.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
