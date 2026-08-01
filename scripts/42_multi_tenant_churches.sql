-- ============================================================
-- Multi-tenant foundation — SHEP.HERD moves from "one church, many
-- branches" to "many churches, each with their own branches." Every
-- existing row belongs to the church that's already live in production,
-- pinned to a fixed id so this script is safe to run once against real
-- data without losing anything. New churches created after this point
-- get their own id and are isolated from every other church's data.
--
-- IMPORTANT: this script only adds the columns and backfills them. It
-- does NOT yet make every app route filter by church_id — that is a
-- separate, ongoing rollout across the API routes. Until a given route
-- is updated to filter by church_id, it still queries globally.
-- ============================================================

CREATE TABLE IF NOT EXISTS churches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fixed id for the church already live in production, so every backfill
-- below can reference it directly without a round-trip.
INSERT INTO churches (id, name)
SELECT '00000000-0000-0000-0000-000000000001', COALESCE((SELECT church_name FROM church_config ORDER BY created_at ASC LIMIT 1), 'My Church')
WHERE NOT EXISTS (SELECT 1 FROM churches WHERE id = '00000000-0000-0000-0000-000000000001');

-- church_config stops being a singleton — one row per church, not one
-- row total. Existing single row is tagged with the fixed church id.
ALTER TABLE church_config ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
UPDATE church_config SET church_id = '00000000-0000-0000-0000-000000000001' WHERE church_id IS NULL;

ALTER TABLE branches ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
UPDATE branches SET church_id = '00000000-0000-0000-0000-000000000001' WHERE church_id IS NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
UPDATE users SET church_id = '00000000-0000-0000-0000-000000000001' WHERE church_id IS NULL;

ALTER TABLE members ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
UPDATE members SET church_id = '00000000-0000-0000-0000-000000000001' WHERE church_id IS NULL;

ALTER TABLE cells ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
UPDATE cells SET church_id = '00000000-0000-0000-0000-000000000001' WHERE church_id IS NULL;

ALTER TABLE fellowships ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
UPDATE fellowships SET church_id = '00000000-0000-0000-0000-000000000001' WHERE church_id IS NULL;

ALTER TABLE departments ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
UPDATE departments SET church_id = '00000000-0000-0000-0000-000000000001' WHERE church_id IS NULL;

ALTER TABLE services ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
UPDATE services SET church_id = '00000000-0000-0000-0000-000000000001' WHERE church_id IS NULL;

ALTER TABLE church_events ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
UPDATE church_events SET church_id = '00000000-0000-0000-0000-000000000001' WHERE church_id IS NULL;

ALTER TABLE income_records ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
UPDATE income_records SET church_id = '00000000-0000-0000-0000-000000000001' WHERE church_id IS NULL;

ALTER TABLE expense_requisitions ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
UPDATE expense_requisitions SET church_id = '00000000-0000-0000-0000-000000000001' WHERE church_id IS NULL;

ALTER TABLE first_timers ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
UPDATE first_timers SET church_id = '00000000-0000-0000-0000-000000000001' WHERE church_id IS NULL;

ALTER TABLE care_leads ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
UPDATE care_leads SET church_id = '00000000-0000-0000-0000-000000000001' WHERE church_id IS NULL;

ALTER TABLE service_plans ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
UPDATE service_plans SET church_id = '00000000-0000-0000-0000-000000000001' WHERE church_id IS NULL;

ALTER TABLE invites ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
UPDATE invites SET church_id = '00000000-0000-0000-0000-000000000001' WHERE church_id IS NULL;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
UPDATE notifications SET church_id = '00000000-0000-0000-0000-000000000001' WHERE church_id IS NULL;

ALTER TABLE prayer_requests ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
UPDATE prayer_requests SET church_id = '00000000-0000-0000-0000-000000000001' WHERE church_id IS NULL;

ALTER TABLE meeting_requests ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
UPDATE meeting_requests SET church_id = '00000000-0000-0000-0000-000000000001' WHERE church_id IS NULL;

-- Newer tables from this session — the ones the chat-isolation question
-- was actually about.
ALTER TABLE feed_groups ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
UPDATE feed_groups SET church_id = '00000000-0000-0000-0000-000000000001' WHERE church_id IS NULL;

ALTER TABLE chat_threads ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
UPDATE chat_threads SET church_id = '00000000-0000-0000-0000-000000000001' WHERE church_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_church ON users(church_id);
CREATE INDEX IF NOT EXISTS idx_members_church ON members(church_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_church ON chat_threads(church_id);
CREATE INDEX IF NOT EXISTS idx_feed_groups_church ON feed_groups(church_id);

-- Verify: every row above should now have a church_id. A count > 0 in
-- any of these means that table still has unbackfilled rows.
SELECT 'users' AS table_name, count(*) AS missing_church_id FROM users WHERE church_id IS NULL
UNION ALL SELECT 'members', count(*) FROM members WHERE church_id IS NULL
UNION ALL SELECT 'branches', count(*) FROM branches WHERE church_id IS NULL
UNION ALL SELECT 'church_config', count(*) FROM church_config WHERE church_id IS NULL
UNION ALL SELECT 'chat_threads', count(*) FROM chat_threads WHERE church_id IS NULL
UNION ALL SELECT 'feed_groups', count(*) FROM feed_groups WHERE church_id IS NULL;
