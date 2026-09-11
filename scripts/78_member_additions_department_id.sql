-- ============================================================
-- member_additions -- two stacked schema bugs blocking every submission
-- Run in Supabase SQL editor
--
-- 1) department_id was never actually applied to production.
--    13_member_extra_columns.sql's own comment says it was meant to add
--    both created_member_id and department_id, but errored out partway
--    through on the live database; 16_cleanse_seed_data.sql later
--    re-added created_member_id idempotently as a recovery, but nobody
--    ever did the same for department_id. 69_delete_demo_departments.sql
--    independently rediscovered it missing (twice, per its own comment)
--    without fixing it either. /api/update/member-additions has always
--    assumed the column exists: it inserts one on every submission
--    (even as null), filters by it in the department_head review queue,
--    and checks it to decide who is L1 for a given record.
--
--    Net effect: PostgREST rejects the insert outright with PGRST204
--    "Could not find the 'department_id' column of 'member_additions'
--    in the schema cache" -- for EVERY submission through this
--    endpoint, any role, department-sourced or not, since the route
--    always sends the key. The route never checked res.ok on that
--    insert (fixed separately in application code), so it returned 201
--    with the PostgREST error object standing in for the created row --
--    the portal showed "submitted for approval... Church Admin will
--    review shortly" while nothing was ever written and the member
--    vanished.
--
-- 2) submitted_by's foreign key points at the wrong table.
--    fk_member_additions_submitted_by references members(id), but the
--    column is always populated with the logged-in user's own
--    users.id (see submitted_by: user.id in the route) -- never a
--    members.id. member_removals, which its own migration explicitly
--    says "mirrors member_additions", correctly leaves its equivalent
--    column (recommended_by) with no FK at all for exactly this reason.
--    None of this church's real cell_leader/fellowship_head/
--    department_head accounts have a row in members (leader accounts
--    aren't members -- see the identical observation in
--    /api/update/members/route.ts) -- so this FK, on its own, made it
--    impossible for ANY real leader account to ever successfully submit
--    a member addition, independent of bug (1) above.
--
-- Reproduced live end-to-end as real department_head and cell_leader
-- accounts: both got HTTP 201 with bug (1) alone; after fixing the
-- column and the app-side res.ok check, the same submissions then hit
-- bug (2), a 23503 foreign key violation on submitted_by, for every
-- single leader account in the database.
-- ============================================================

ALTER TABLE member_additions
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);

CREATE INDEX IF NOT EXISTS idx_member_additions_department_id ON member_additions(department_id);

ALTER TABLE member_additions DROP CONSTRAINT IF EXISTS fk_member_additions_submitted_by;
ALTER TABLE member_additions
  ADD CONSTRAINT fk_member_additions_submitted_by FOREIGN KEY (submitted_by) REFERENCES users(id);
