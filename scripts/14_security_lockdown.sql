-- SHEP.HERD — Security lockdown: close direct-Supabase-API exposure.
--
-- The browser ships a public "anon" key (NEXT_PUBLIC_SUPABASE_ANON_KEY) baked
-- into every page's JS bundle — anyone can read it from browser DevTools →
-- Network/Sources. If a table has RLS disabled, or a permissive
-- "USING (true)" policy (several tables in this project do — see
-- 02_church_config.sql, 05_service_planner.sql, 10_member_creation_chain.sql,
-- 11_department_attendance.sql), that key can be used to query it directly
-- via Supabase's REST API — reading member names/phones/addresses, giving
-- records, prayer requests, everything — completely bypassing this app's own
-- login and role checks.
--
-- Every feature in this app already reads/writes through Next.js API routes
-- using the SERVICE ROLE key, server-side only, which always bypasses RLS —
-- confirmed by grep across src/app/api/**. The anon/authenticated Postgres
-- roles have no legitimate reason to touch any table directly. Run this once
-- in the Supabase SQL editor. It is safe to re-run.

-- 1. Enable RLS on every table in the public schema, even ones that already
--    have policies — a table with RLS enabled and NO matching policy denies
--    access by default, which is exactly what we want for anon/authenticated.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;

-- 2. Belt-and-suspenders: revoke table/sequence/function privileges from
--    anon and authenticated outright, at the grant level — this closes the
--    gap even where an existing policy says "USING (true)". The service_role
--    key used by every API route bypasses RLS and grants entirely, so this
--    changes nothing for the app itself.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- 3. Verify — every row should show rowsecurity = true.
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Known, accepted trade-off: NotificationBell.tsx opens a direct Supabase
-- Realtime WebSocket with the anon key for instant push notifications. After
-- this lockdown that subscription will no longer receive events (Realtime
-- honours RLS/grants) — it already falls back to polling /api/notifications
-- every 15 seconds, so notifications still arrive, just not instantly. This
-- was the only other client-side anon-key usage found in the codebase (the
-- "Create Cell" fellowship dropdown was fixed in the same pass to go through
-- a proper server-side API route instead).
