-- ============================================================
-- execute_safe_query -- RPC function referenced by the AI agent, never defined anywhere
-- Run in Supabase SQL editor
--
-- src/app/api/ai/query/route.ts (Moshe, the "Ask AI Agents" natural-
-- language database assistant) is entirely built around calling this
-- one Postgres function via POST /rest/v1/rpc/execute_safe_query with
-- { query_text: <SQL the model generated> } -- it is the ONLY way the
-- assistant ever actually retrieves data. No script anywhere in this
-- repo ever created it, and it does not exist in the database.
--
-- Net effect: every single data question ever asked of Moshe hits
-- PostgREST's "function not found" response, executeSQL() reports that
-- back as an error, and the model tells the user "I was unable to
-- retrieve that data. Please try again." -- for every query, always.
-- The natural-language database-querying capability this whole feature
-- exists for has never worked.
--
-- The app already validates the query client-side (SELECT/WITH only,
-- no dangerous keywords, church_id/branch_id/financial-table scoping --
-- see executeSQL() and the guardrails around it) before ever sending it
-- here. This function re-enforces the same SELECT-only / no-dangerous-
-- keyword rule server-side too, as defense in depth: never trust that a
-- client-side check is the only thing standing between a generated
-- query and a mutating statement, since RPC endpoints can be called
-- directly and other callers may be added later.
--
-- Wraps the given query as a subquery and returns each row as a JSON
-- object (RETURNS SETOF json) -- PostgREST passes a json-returning
-- function's rows straight through as a JSON array in the response
-- body, which is exactly the shape executeSQL() already expects
-- (Array.isArray(data) ? data : []).
-- ============================================================

CREATE OR REPLACE FUNCTION execute_safe_query(query_text text)
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trimmed text := btrim(query_text);
  upper_sql text := upper(trimmed);
BEGIN
  IF upper_sql !~ '^\s*(SELECT|WITH)\M' THEN
    RAISE EXCEPTION 'Only SELECT/WITH queries are permitted';
  END IF;
  IF upper_sql ~ '\y(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE)\y' THEN
    RAISE EXCEPTION 'Prohibited keyword detected';
  END IF;

  RETURN QUERY EXECUTE format('SELECT row_to_json(t) FROM (%s) t', trimmed);
END;
$$;

REVOKE ALL ON FUNCTION execute_safe_query(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION execute_safe_query(text) TO service_role;
