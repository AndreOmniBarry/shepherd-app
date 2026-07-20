-- ============================================================
-- SHEP.HERD — Demo Users for All Roles
-- Run in Supabase SQL editor
--
-- IMPORTANT: SHEPHERD uses Supabase Auth for login.
-- These users must be created in TWO places:
--
-- STEP 1: Create auth users via Supabase Dashboard
--   Go to: Authentication → Users → Invite user (or Add user)
--   Create each email below with password: Demo1234
--
-- STEP 2: Run this SQL to create their profiles in public.users
-- ============================================================

-- After creating auth users, run this to set their roles and profiles.
-- Replace the UUIDs below with the actual IDs from auth.users

-- View auth users to get their UUIDs
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC;

-- ── INSERT DEMO USERS INTO public.users ──────────────────────
-- You must insert one row per auth user with matching id

-- PA user
INSERT INTO public.users (id, full_name, email, role, fellowship_id, is_active)
SELECT 
  au.id,
  'Sister Grace Adeyemi',
  'pa@shepherd.app',
  'pa',
  (SELECT id FROM fellowships LIMIT 1),
  true
FROM auth.users au
WHERE au.email = 'pa@shepherd.app'
ON CONFLICT (id) DO UPDATE SET role = 'pa', full_name = 'Sister Grace Adeyemi', is_active = true;

-- Fellowship Head
INSERT INTO public.users (id, full_name, email, role, fellowship_id, is_active)
SELECT 
  au.id,
  'Pastor Daniel Okonkwo',
  'fellowshiphead@shepherd.app',
  'fellowship_head',
  (SELECT id FROM fellowships WHERE name ILIKE '%men%' LIMIT 1),
  true
FROM auth.users au
WHERE au.email = 'fellowshiphead@shepherd.app'
ON CONFLICT (id) DO UPDATE SET role = 'fellowship_head', full_name = 'Pastor Daniel Okonkwo', is_active = true;

-- Department Head
INSERT INTO public.users (id, full_name, email, role, fellowship_id, is_active)
SELECT 
  au.id,
  'Brother Samuel Taiwo',
  'depthead@shepherd.app',
  'department_head',
  (SELECT id FROM fellowships LIMIT 1),
  true
FROM auth.users au
WHERE au.email = 'depthead@shepherd.app'
ON CONFLICT (id) DO UPDATE SET role = 'department_head', full_name = 'Brother Samuel Taiwo', is_active = true;

-- Care Team
INSERT INTO public.users (id, full_name, email, role, fellowship_id, is_active)
SELECT 
  au.id,
  'Sister Faith Nwosu',
  'careteam@shepherd.app',
  'care_team',
  (SELECT id FROM fellowships LIMIT 1),
  true
FROM auth.users au
WHERE au.email = 'careteam@shepherd.app'
ON CONFLICT (id) DO UPDATE SET role = 'care_team', full_name = 'Sister Faith Nwosu', is_active = true;

-- Accounts
INSERT INTO public.users (id, full_name, email, role, fellowship_id, is_active)
SELECT 
  au.id,
  'Brother Philip Eze',
  'accounts@shepherd.app',
  'accounts',
  (SELECT id FROM fellowships LIMIT 1),
  true
FROM auth.users au
WHERE au.email = 'accounts@shepherd.app'
ON CONFLICT (id) DO UPDATE SET role = 'accounts', full_name = 'Brother Philip Eze', is_active = true;

-- Partnership
INSERT INTO public.users (id, full_name, email, role, fellowship_id, is_active)
SELECT 
  au.id,
  'Sister Joy Adeleke',
  'partnership@shepherd.app',
  'partnership',
  (SELECT id FROM fellowships LIMIT 1),
  true
FROM auth.users au
WHERE au.email = 'partnership@shepherd.app'
ON CONFLICT (id) DO UPDATE SET role = 'partnership', full_name = 'Sister Joy Adeleke', is_active = true;

-- Verify all users
SELECT u.id, u.full_name, u.email, u.role, u.is_active 
FROM public.users u 
ORDER BY u.role;
