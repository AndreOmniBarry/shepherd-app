-- ============================================================
-- Moshe (Ask AI Agents) -- real, database-enforced tenant isolation
-- Run in Supabase SQL editor
--
-- The existing tenant boundary for /api/ai/query's generated SQL was a
-- single application-code check: does the query text literally contain
-- the caller's own church_id substring? Confirmed exploitable two ways:
--   1. A query like `WHERE church_id != '<my own church_id>'` contains
--      the string but returns every OTHER church's rows -- the check
--      only looks for presence, never verifies the filter actually
--      constrains anything.
--   2. church_config (church names, plan_tier, subscription/billing
--      status for every customer) was never in the guarded table list
--      at all, so no check applied to it whatsoever.
--   Both reproduced live against the real database and confirmed to
--   return real cross-church data.
-- execute_safe_query itself (the function every query actually runs
-- through) had zero independent tenant check of its own -- the entire
-- boundary was that one bypassable string match in application code.
--
-- This replaces it with the standard, correct pattern for letting
-- semi-trusted/LLM-generated SQL run against a live multi-tenant
-- database: a dedicated, unprivileged role with real RLS policies, and
-- the caller's real (server-verified, never client- or LLM-supplied)
-- church_id/branch_id passed in as explicit function parameters and
-- enforced by Postgres itself -- not by inspecting the query text.
-- ============================================================

-- 1) A dedicated role for Moshe's queries. Deliberately NOT the service
--    role (which bypasses RLS entirely) and NOT a superuser -- RLS only
--    has teeth against a role that can't bypass it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'moshe_query_role') THEN
    CREATE ROLE moshe_query_role NOLOGIN NOBYPASSRLS;
  END IF;
END $$;

-- `ALTER FUNCTION ... OWNER TO moshe_query_role` below requires the role
-- running this script to already be a member of moshe_query_role (Postgres
-- refuses to hand ownership to a role you can't SET ROLE into) -- CREATE
-- ROLE alone doesn't grant that. A true superuser bypasses this check
-- entirely, which is why this passed in a plain local Postgres instance
-- but fails against Supabase's own `postgres` role, which is deliberately
-- not a full superuser. Granting membership to whichever role is actually
-- running this script (not hardcoding "postgres") fixes it regardless of
-- what that role is called.
GRANT moshe_query_role TO CURRENT_USER;

-- 2) Helpers reading the scope for the current query from session-local
--    settings set inside execute_safe_query below -- never from anything
--    embedded in the AI-generated query text itself.
CREATE OR REPLACE FUNCTION app_current_church_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.current_church_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_current_branch_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.current_branch_id', true), '')::uuid
$$;

-- 3) RLS: tables with their own church_id column get a straight equality
--    policy. expense_requisitions and income_records are additionally
--    branch-locked when a branch is set -- preserving the app's existing
--    business rule (general_overseer/lead_tech see the whole church;
--    overseer/branch_pastor are locked to their own branch for financial
--    data specifically) but now enforced by Postgres, not string-matching.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['branches','cells','fellowships','services','income_types','members','departments']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS moshe_church_scope ON %I', t);
    EXECUTE format(
      'CREATE POLICY moshe_church_scope ON %I FOR SELECT TO moshe_query_role USING (church_id = app_current_church_id())',
      t
    );
  END LOOP;
END $$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['expense_requisitions','income_records']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS moshe_church_branch_scope ON %I', t);
    EXECUTE format(
      'CREATE POLICY moshe_church_branch_scope ON %I FOR SELECT TO moshe_query_role USING (church_id = app_current_church_id() AND (app_current_branch_id() IS NULL OR branch_id = app_current_branch_id()))',
      t
    );
  END LOOP;
END $$;

-- 4) Tables with no church_id column of their own: policy via a subquery
--    against the parent table that does carry one.
ALTER TABLE giving_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS moshe_church_scope ON giving_records;
CREATE POLICY moshe_church_scope ON giving_records FOR SELECT TO moshe_query_role
  USING (fellowship_id IN (SELECT id FROM fellowships WHERE church_id = app_current_church_id()));

ALTER TABLE department_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS moshe_church_scope ON department_members;
CREATE POLICY moshe_church_scope ON department_members FOR SELECT TO moshe_query_role
  USING (department_id IN (SELECT id FROM departments WHERE church_id = app_current_church_id()));

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS moshe_church_scope ON attendance_records;
CREATE POLICY moshe_church_scope ON attendance_records FOR SELECT TO moshe_query_role
  USING (cell_id IN (SELECT id FROM cells WHERE church_id = app_current_church_id()));

-- 5) Grant SELECT on exactly Moshe's documented schema (see BASE_RULES's
--    ## SCHEMA section in src/app/api/ai/query/route.ts) to the
--    restricted role -- nothing else. A query reaching for any other
--    table (church_config included -- this is what closes that leak)
--    fails with a permission error, caught and returned gracefully by
--    execute_safe_query's own exception handler.
GRANT SELECT ON
  branches, cells, fellowships, services, income_records, income_types,
  giving_records, members, departments, department_members,
  expense_requisitions, attendance_records
TO moshe_query_role;

-- 6) execute_safe_query now takes the caller's real church_id (and,
--    for the roles that need it, branch_id) as explicit parameters --
--    never trusted from the query text -- and runs as moshe_query_role
--    regardless of who calls it, via SECURITY DEFINER + ownership.
--    p_branch_id stays NULL for roles with unrestricted branch reach
--    (general_overseer, lead_tech) -- the app passes it only for
--    overseer/branch_pastor, matching the existing business rule; pa is
--    still blocked from financial tables entirely at the application
--    layer before this function is ever called, unchanged.
DROP FUNCTION IF EXISTS execute_safe_query(text);

CREATE OR REPLACE FUNCTION execute_safe_query(query_text text, p_church_id uuid, p_branch_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '5s'
SET search_path TO 'public'
AS $function$
declare
  result jsonb;
begin
  if p_church_id is null then
    return jsonb_build_object('error', 'A church_id is required to run this query.');
  end if;

  perform set_config('app.current_church_id', p_church_id::text, true);
  perform set_config('app.current_branch_id', coalesce(p_branch_id::text, ''), true);

  if query_text !~* '^\s*(select|with)\s' then
    raise exception 'Only SELECT queries are permitted';
  end if;
  if query_text ~* '\y(insert|update|delete|drop|truncate|alter|create|grant|revoke)\y' then
    raise exception 'Prohibited keyword detected';
  end if;

  execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s) t', query_text) into result;
  return result;
exception when others then
  return jsonb_build_object('error', sqlerrm);
end;
$function$;

ALTER FUNCTION execute_safe_query(text, uuid, uuid) OWNER TO moshe_query_role;
REVOKE ALL ON FUNCTION execute_safe_query(text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION execute_safe_query(text, uuid, uuid) TO service_role;
