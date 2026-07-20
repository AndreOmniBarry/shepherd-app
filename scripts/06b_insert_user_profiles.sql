-- ============================================================
-- SHEP.HERD — Insert profiles for new auth users
-- Run in Supabase SQL editor
-- ============================================================

-- PA
INSERT INTO public.users (id, full_name, email, role, fellowship_id, is_active)
VALUES (
  'b0b7187a-66ad-4fc0-b834-7858d4b3b282',
  'Sister Grace Adeyemi',
  'pa@shepherd.app',
  'pa',
  (SELECT id FROM fellowships ORDER BY created_at ASC LIMIT 1),
  true
)
ON CONFLICT (id) DO UPDATE SET 
  role = 'pa', 
  full_name = 'Sister Grace Adeyemi',
  is_active = true;

-- Fellowship Head
INSERT INTO public.users (id, full_name, email, role, fellowship_id, is_active)
VALUES (
  'bab5a346-be82-418d-b71c-c221f3ac5856',
  'Pastor Daniel Okonkwo',
  'fellowshiphead@shepherd.app',
  'fellowship_head',
  (SELECT id FROM fellowships WHERE name ILIKE '%men%' LIMIT 1),
  true
)
ON CONFLICT (id) DO UPDATE SET 
  role = 'fellowship_head', 
  full_name = 'Pastor Daniel Okonkwo',
  is_active = true;

-- Department Head
INSERT INTO public.users (id, full_name, email, role, fellowship_id, is_active)
VALUES (
  '97c38abe-27e0-406b-b076-6346accb0b21',
  'Brother Samuel Taiwo',
  'depthead@shepherd.app',
  'department_head',
  (SELECT id FROM fellowships ORDER BY created_at ASC LIMIT 1),
  true
)
ON CONFLICT (id) DO UPDATE SET 
  role = 'department_head', 
  full_name = 'Brother Samuel Taiwo',
  is_active = true;

-- Care Team
INSERT INTO public.users (id, full_name, email, role, fellowship_id, is_active)
VALUES (
  '47a24e24-5906-4879-b724-cf142a0d6588',
  'Sister Faith Nwosu',
  'careteam@shepherd.app',
  'care_team',
  (SELECT id FROM fellowships ORDER BY created_at ASC LIMIT 1),
  true
)
ON CONFLICT (id) DO UPDATE SET 
  role = 'care_team', 
  full_name = 'Sister Faith Nwosu',
  is_active = true;

-- Verify
SELECT id, full_name, email, role, is_active FROM public.users ORDER BY role;
