-- ============================================================
-- SHEP.HERD — Enable Supabase Realtime on notifications table
-- Run in Supabase SQL editor
-- This makes prayer requests, assignments, commend leaders
-- all push to portals in real time without page refresh
-- ============================================================

-- Enable realtime on notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Also enable on prayer_requests so pastor sees new ones instantly
ALTER PUBLICATION supabase_realtime ADD TABLE prayer_requests;

-- Verify
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
