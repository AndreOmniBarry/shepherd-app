-- ══════════════════════════════════════════════════════════════════
-- READ-ONLY DIAGNOSTIC — run this and paste back the full output.
-- Do not run anything else from this file; it makes no changes.
--
-- Looking for leftover demo/seed rows still visible in production:
-- the old hardcoded dashboard demo data used placeholder names like
-- "Bro. Chukwudi Eze" and "Bro. Moses Eze" and placeholder cell names
-- like "Dominion Cell" / "Glory House Cell". If any of these got
-- inserted into the real database at some point (rather than only
-- ever existing in app code), they'd still be showing up on real
-- portals today.
-- ══════════════════════════════════════════════════════════════════

-- 1) Any user accounts whose name still carries the "Bro./Sis." demo
--    naming convention (real data entry for this church does not use
--    this prefix, so any match here is very likely leftover seed data).
SELECT id, full_name, email, role, is_active, cell_id, fellowship_id, department_id
FROM users
WHERE full_name ILIKE 'Bro. %' OR full_name ILIKE 'Sis. %'
ORDER BY full_name;

-- 2) Same check against the members table (not just login accounts).
SELECT id, full_name, phone, membership_status, cell_id
FROM members
WHERE full_name ILIKE 'Bro. %' OR full_name ILIKE 'Sis. %'
ORDER BY full_name;

-- 3) Any cells whose name matches the old hardcoded demo cell list.
--    (Some of these — e.g. "Covenant Cell" — were legitimately repurposed
--    earlier this project and renamed, so a name match here does NOT
--    automatically mean "delete it" — just flags candidates to review.)
SELECT id, name, fellowship_id, is_active,
       (SELECT count(*) FROM members m WHERE m.cell_id = cells.id) AS member_count
FROM cells
WHERE name IN (
  'Achievers Cell','Anchor Cell','Breakthrough Cell','Burning Bush Cell','Champions Cell',
  'Cornerstone Cell','Covenant Cell','Dayspring Cell','Dominion Cell','Eagles Cell',
  'Elevation Cell','Emmanuel Cell','Fortress Cell','Fountain of Life Cell','Glory House Cell',
  'Graceland Cell','Harvest Cell','Jubilee Cell','Kingdom Builders Cell','Lighthouse Cell',
  'Living Waters Cell','Manifold Blessings Cell','New Dawn Cell','Overflow Cell','Peace Cell',
  'Power House Cell','Promised Land Cell','Restoration Cell','Rock of Ages Cell','Shalom Cell',
  'Solid Rock Cell','Tabernacle Cell','Trumpet Cell','Victory Cell','Zion Cell'
)
ORDER BY name;

-- 4) Any departments whose name/leader looks like leftover seed data.
SELECT d.id, d.name,
       (SELECT count(*) FROM department_members dm WHERE dm.department_id = d.id) AS member_count,
       (SELECT full_name FROM users u WHERE u.department_id = d.id AND u.role = 'department_head' AND u.is_active = true LIMIT 1) AS head_name
FROM departments d
ORDER BY d.name;
