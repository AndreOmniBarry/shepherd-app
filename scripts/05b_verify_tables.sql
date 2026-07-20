-- ============================================================
-- SHEP.HERD — Verify Service Planner Tables Exist
-- Run this to confirm 05_service_planner.sql worked correctly
-- ============================================================

-- Check all 7 tables exist
SELECT table_name, 
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN (
    'service_plans',
    'service_plan_items', 
    'church_events',
    'event_registrations',
    'workforce_rosters',
    'workforce_roster_entries',
    'workforce_profiles'
  )
ORDER BY table_name;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('service_plans','service_plan_items','church_events','event_registrations','workforce_rosters','workforce_roster_entries','workforce_profiles');
