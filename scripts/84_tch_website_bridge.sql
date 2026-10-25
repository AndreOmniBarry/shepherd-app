-- ============================================================
-- TCH website ⇄ SHEP.HRD bridge (wire contract v1)
-- Run in Supabase SQL editor. Idempotent — safe to re-run.
--
-- The Comforters House website POSTs signed sign-ups to
-- /api/bridge/ingest (see src/app/api/bridge/ingest/route.ts and
-- docs/TCH_WEBSITE_BRIDGE.md). The route verifies the HMAC, validates
-- the payload, then calls bridge_ingest() below — ONE transaction that
-- records the message in bridge_inbox (idempotency + consent record)
-- and writes the domain row. Everything here is service-role only.
--
-- Mapping choices (documented, not guessed):
--   * first_timers.phone is NOT NULL (see the comment in
--     src/app/api/events/checkin/route.ts) and several readers assume a
--     string. It is left NOT NULL; a website sign-up with only an email
--     stores phone = '' and the email in the new first_timers.email
--     column. Nothing else changes for existing rows or routes.
--   * prayer_requests uses 'open' as its "new" status (every reader and
--     the pastor's queue filter on status=open) — 'new' would hide the
--     request, so website prayer requests land as 'open'.
--   * There is no pending-membership-application concept that accepts a
--     non-member with no cell/recommender (member_additions requires
--     both), so member.join → first_timers, would_join='yes'.
--   * care_leads requires a members row, so care.salvation →
--     first_timers with salvation_decision = true.
-- ============================================================

BEGIN;

-- ── 1. audit_log gets a tenant column (system actors have no users row
--      to derive a church from) ─────────────────────────────────────────
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
CREATE INDEX IF NOT EXISTS idx_audit_log_church_created ON audit_log(church_id, created_at DESC);

-- ── 2. Provenance columns on every table the bridge writes to ─────────
ALTER TABLE first_timers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE first_timers ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE first_timers ADD COLUMN IF NOT EXISTS source_ref TEXT;
ALTER TABLE first_timers ADD COLUMN IF NOT EXISTS salvation_decision BOOLEAN;
CREATE UNIQUE INDEX IF NOT EXISTS first_timers_church_source_ref_uq
  ON first_timers(church_id, source_ref) WHERE source_ref IS NOT NULL;

ALTER TABLE prayer_requests ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE prayer_requests ADD COLUMN IF NOT EXISTS source_ref TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS prayer_requests_church_source_ref_uq
  ON prayer_requests(church_id, source_ref) WHERE source_ref IS NOT NULL;

-- ── 3. Volunteer interest from the website (no existing table fits) ───
CREATE TABLE IF NOT EXISTS web_volunteer_interest (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id       UUID NOT NULL REFERENCES churches(id),
  branch_id       UUID REFERENCES branches(id),
  full_name       TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  email           TEXT CHECK (email IS NULL OR char_length(email) <= 160),
  phone           TEXT CHECK (phone IS NULL OR char_length(phone) <= 32),
  teams           TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(teams) <= 10),
  team_idea       TEXT CHECK (team_idea IS NULL OR char_length(team_idea) <= 600),
  department_ids  UUID[] NOT NULL DEFAULT '{}',
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'placed', 'declined', 'archived')),
  source          TEXT,
  source_ref      TEXT,
  consent_version TEXT,
  consent_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS web_volunteer_interest_church_source_ref_uq
  ON web_volunteer_interest(church_id, source_ref) WHERE source_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_web_volunteer_interest_church_created
  ON web_volunteer_interest(church_id, created_at DESC);
ALTER TABLE web_volunteer_interest ENABLE ROW LEVEL SECURITY;

-- ── 4. Inbox: idempotency ledger + consent record, one row per message ─
CREATE TABLE IF NOT EXISTS bridge_inbox (
  church_id       UUID NOT NULL REFERENCES churches(id),
  msg_id          UUID NOT NULL,
  type            TEXT NOT NULL,
  body_hash       TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('processing', 'processed', 'failed', 'quarantined')),
  payload         JSONB,
  result_table    TEXT,
  result_id       UUID,
  consent_version TEXT,
  consent_at      TIMESTAMPTZ,
  receipt         UUID NOT NULL DEFAULT gen_random_uuid(),
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ,
  error_code      TEXT,
  PRIMARY KEY (church_id, msg_id)
);
CREATE INDEX IF NOT EXISTS idx_bridge_inbox_church_received ON bridge_inbox(church_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_bridge_inbox_result ON bridge_inbox(result_table, result_id);
-- RLS on with NO policies: anon/authenticated can never read or write;
-- only the service role (which bypasses RLS) can.
ALTER TABLE bridge_inbox ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON bridge_inbox, web_volunteer_interest FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON bridge_inbox, web_volunteer_interest TO service_role;

-- ── 5. The one ingest function ────────────────────────────────────────
-- Returns jsonb:
--   {status:'accepted', receipt, result_table, result_id, created, quarantined, possible_duplicate, assigned_to, department_ids}
--   {status:'duplicate', receipt, ...}   — same msg already processed/quarantined with the same body hash
--   {status:'conflict'}                  — same msg id, different body hash (or type)
--   {status:'invalid', error_code}       — data failed the in-database checks (route → 422)
--   {status:'failed', error_code}        — domain write failed; inbox row marked failed, a retry reprocesses it
-- Every domain INSERT is built from explicit whitelisted keys of p_data;
-- nothing in p_data can choose a column, a table, a status or a church.
CREATE OR REPLACE FUNCTION bridge_ingest(
  p_church          UUID,
  p_branch          UUID,
  p_msg             UUID,
  p_type            TEXT,
  p_hash            TEXT,
  p_consent_version TEXT,
  p_consent_at      TIMESTAMPTZ,
  p_data            JSONB,
  p_assignee        UUID,
  p_quarantine      BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_allowlist CONSTANT TEXT[] := ARRAY[
    'Ushering & Hospitality', 'Media & Live Stream', 'Worship & Music', 'Children''s Ministry',
    'Outreach & Missions', 'Prayer Team', 'Protocol & Security', 'Sanitation & Facilities',
    'Follow-up & Counselling', 'Administration'
  ];
  v_row      bridge_inbox%ROWTYPE;
  v_ref      TEXT := 'tch:' || p_msg::text;
  v_table    TEXT;
  v_id       UUID;
  v_created  BOOLEAN := false;
  v_dup      BOOLEAN := false;
  v_assignee UUID;
  v_name     TEXT;
  v_email    TEXT;
  v_phone    TEXT;
  v_note     TEXT;
  v_city     TEXT;
  v_request  TEXT;
  v_idea     TEXT;
  v_teams    TEXT[] := '{}';
  v_depts    UUID[] := '{}';
  v_notes    TEXT;
  v_salv     BOOLEAN;
BEGIN
  -- Arguments the route itself controls — a failure here is a server bug
  -- or misconfiguration, so it raises (route → 500) rather than recording.
  IF p_church IS NULL OR p_msg IS NULL OR p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$'
     OR p_type IS NULL OR p_type NOT IN ('member.join', 'care.salvation', 'prayer.request', 'workforce.volunteer')
     OR p_data IS NULL OR jsonb_typeof(p_data) <> 'object' OR p_quarantine IS NULL THEN
    RAISE EXCEPTION 'bridge_bad_args';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM churches WHERE id = p_church) THEN
    RAISE EXCEPTION 'bridge_unknown_church';
  END IF;
  IF p_branch IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches WHERE id = p_branch AND church_id = p_church) THEN
    RAISE EXCEPTION 'bridge_branch_mismatch';
  END IF;

  -- Claim the message. A concurrent duplicate blocks here on the primary
  -- key until the first transaction commits, then falls into the SELECT
  -- ... FOR UPDATE path and sees the committed outcome.
  INSERT INTO bridge_inbox (church_id, msg_id, type, body_hash, status, payload, consent_version, consent_at)
  VALUES (p_church, p_msg, p_type, p_hash, 'processing', p_data, p_consent_version, p_consent_at)
  ON CONFLICT (church_id, msg_id) DO NOTHING
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    SELECT * INTO v_row FROM bridge_inbox WHERE church_id = p_church AND msg_id = p_msg FOR UPDATE;
    IF v_row.body_hash <> p_hash OR v_row.type <> p_type THEN
      RETURN jsonb_build_object('status', 'conflict');
    END IF;
    IF v_row.status IN ('processed', 'quarantined') THEN
      RETURN jsonb_build_object('status', 'duplicate', 'receipt', v_row.receipt,
        'result_table', v_row.result_table, 'result_id', v_row.result_id, 'created', false);
    END IF;
    -- 'failed' (or a stale 'processing') with the same hash: retry it.
    UPDATE bridge_inbox
       SET status = 'processing', payload = p_data, error_code = NULL,
           consent_version = p_consent_version, consent_at = p_consent_at
     WHERE church_id = p_church AND msg_id = p_msg;
  END IF;

  -- Daily cap hit: hold the message for manual review. No domain row, no
  -- notifications; payload is kept so an admin can release it.
  IF p_quarantine THEN
    UPDATE bridge_inbox SET status = 'quarantined', processed_at = now(), error_code = 'daily_cap'
     WHERE church_id = p_church AND msg_id = p_msg;
    INSERT INTO audit_log (actor_id, actor_role, action, target_type, target_id, detail, church_id)
    VALUES (NULL, 'system', 'bridge_quarantine', 'bridge_inbox', p_msg::text,
            jsonb_build_object('msg_id', p_msg, 'type', p_type, 'source', 'tch_website'), p_church);
    RETURN jsonb_build_object('status', 'accepted', 'receipt', v_row.receipt, 'result_table', NULL,
      'result_id', NULL, 'created', false, 'quarantined', true);
  END IF;

  BEGIN
    -- Whitelisted extraction. Lengths re-checked here as defence in depth
    -- (the route already enforces the contract's limits).
    v_name    := nullif(btrim(p_data->>'full_name'), '');
    v_email   := nullif(lower(btrim(p_data->>'email')), '');
    v_phone   := nullif(btrim(p_data->>'phone'), '');
    v_note    := nullif(btrim(p_data->>'note'), '');
    v_city    := nullif(btrim(p_data->>'city'), '');
    v_request := nullif(btrim(p_data->>'request'), '');
    v_idea    := nullif(btrim(p_data->>'team_idea'), '');

    IF (v_email IS NOT NULL AND char_length(v_email) > 160)
       OR (v_phone IS NOT NULL AND char_length(v_phone) > 32)
       OR (v_note IS NOT NULL AND char_length(v_note) > 1000)
       OR (v_city IS NOT NULL AND char_length(v_city) > 80)
       OR (v_idea IS NOT NULL AND char_length(v_idea) > 600) THEN
      RAISE EXCEPTION 'bridge_invalid' USING ERRCODE = '22023';
    END IF;
    IF p_type <> 'prayer.request' THEN
      IF v_name IS NULL OR char_length(v_name) NOT BETWEEN 2 AND 120 OR (v_email IS NULL AND v_phone IS NULL) THEN
        RAISE EXCEPTION 'bridge_invalid' USING ERRCODE = '22023';
      END IF;
    END IF;

    IF p_type IN ('member.join', 'care.salvation') THEN
      v_salv := (p_type = 'care.salvation');
      -- Assignee must be an active user of THIS church; anything else is dropped.
      SELECT id INTO v_assignee FROM users
       WHERE id = p_assignee AND church_id = p_church AND is_active = true;

      SELECT EXISTS (
        SELECT 1 FROM first_timers
         WHERE church_id = p_church AND source = 'tch_website'
           AND coalesce(salvation_decision, false) = v_salv
           AND created_at > now() - interval '24 hours'
           AND ((v_email IS NOT NULL AND lower(email) = v_email)
             OR (v_phone IS NOT NULL AND phone = v_phone))
      ) INTO v_dup;

      v_notes := concat_ws(E'\n',
        CASE WHEN v_dup THEN '[Possible duplicate: same contact submitted on the website in the last 24h]' END,
        CASE WHEN v_salv THEN '[Website: salvation decision]' ELSE '[Website: asked to join the church]' END,
        CASE WHEN v_email IS NOT NULL THEN 'Email: ' || v_email END,
        v_note);

      INSERT INTO first_timers (full_name, phone, email, address, how_they_came, would_join, notes,
                                service_date, assigned_to, status, branch_id, church_id,
                                source, source_ref, salvation_decision)
      VALUES (v_name, coalesce(v_phone, ''), v_email,
              CASE WHEN v_salv THEN v_city END,
              'website', CASE WHEN v_salv THEN NULL ELSE 'yes' END, v_notes,
              current_date, v_assignee, 'new', p_branch, p_church,
              'tch_website', v_ref, v_salv)
      ON CONFLICT (church_id, source_ref) WHERE source_ref IS NOT NULL DO NOTHING
      RETURNING id INTO v_id;
      v_created := FOUND;
      IF NOT v_created THEN
        SELECT id INTO v_id FROM first_timers WHERE church_id = p_church AND source_ref = v_ref;
      END IF;
      v_table := 'first_timers';

    ELSIF p_type = 'prayer.request' THEN
      IF v_request IS NULL OR char_length(v_request) NOT BETWEEN 3 AND 4000 THEN
        RAISE EXCEPTION 'bridge_invalid' USING ERRCODE = '22023';
      END IF;
      INSERT INTO prayer_requests (request, requester_name, category, is_anonymous, status,
                                   submitted_by, church_id, source, source_ref)
      VALUES (v_request, 'Anonymous (website)', 'general', true, 'open',
              NULL, p_church, 'tch_website', v_ref)
      ON CONFLICT (church_id, source_ref) WHERE source_ref IS NOT NULL DO NOTHING
      RETURNING id INTO v_id;
      v_created := FOUND;
      IF NOT v_created THEN
        SELECT id INTO v_id FROM prayer_requests WHERE church_id = p_church AND source_ref = v_ref;
      END IF;
      v_table := 'prayer_requests';

    ELSE -- workforce.volunteer
      IF p_data ? 'teams' THEN
        IF jsonb_typeof(p_data->'teams') <> 'array' OR jsonb_array_length(p_data->'teams') > 10 THEN
          RAISE EXCEPTION 'bridge_invalid' USING ERRCODE = '22023';
        END IF;
        SELECT coalesce(array_agg(DISTINCT t), '{}') INTO v_teams
          FROM jsonb_array_elements_text(p_data->'teams') AS t;
        IF NOT (v_teams <@ c_allowlist) THEN
          RAISE EXCEPTION 'bridge_invalid' USING ERRCODE = '22023';
        END IF;
      END IF;
      IF cardinality(v_teams) = 0 AND v_idea IS NULL THEN
        RAISE EXCEPTION 'bridge_invalid' USING ERRCODE = '22023';
      END IF;
      -- Department ids come from the server-side team mapping; keep only
      -- ones that really belong to this church.
      IF jsonb_typeof(p_data->'department_ids') = 'array' THEN
        SELECT coalesce(array_agg(d.id), '{}') INTO v_depts
          FROM departments d
         WHERE d.church_id = p_church
           AND d.id::text IN (SELECT jsonb_array_elements_text(p_data->'department_ids'));
      END IF;

      SELECT EXISTS (
        SELECT 1 FROM web_volunteer_interest
         WHERE church_id = p_church AND source = 'tch_website'
           AND created_at > now() - interval '24 hours'
           AND ((v_email IS NOT NULL AND lower(email) = v_email)
             OR (v_phone IS NOT NULL AND phone = v_phone))
      ) INTO v_dup;

      INSERT INTO web_volunteer_interest (church_id, branch_id, full_name, email, phone, teams, team_idea,
                                          department_ids, notes, status, source, source_ref,
                                          consent_version, consent_at)
      VALUES (p_church, p_branch, v_name, v_email, v_phone, v_teams, v_idea,
              v_depts,
              CASE WHEN v_dup THEN '[Possible duplicate: same contact submitted on the website in the last 24h]' END,
              'new', 'tch_website', v_ref, p_consent_version, p_consent_at)
      ON CONFLICT (church_id, source_ref) WHERE source_ref IS NOT NULL DO NOTHING
      RETURNING id INTO v_id;
      v_created := FOUND;
      IF NOT v_created THEN
        SELECT id, department_ids INTO v_id, v_depts FROM web_volunteer_interest
         WHERE church_id = p_church AND source_ref = v_ref;
      END IF;
      v_table := 'web_volunteer_interest';
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- The sub-block's writes are rolled back to its savepoint; the inbox
    -- row survives as 'failed' (payload kept for diagnosis) so a retry
    -- with the same body hash reprocesses it. Only the SQLSTATE is stored.
    UPDATE bridge_inbox SET status = 'failed', error_code = SQLSTATE, processed_at = now()
     WHERE church_id = p_church AND msg_id = p_msg;
    RETURN jsonb_build_object('status', CASE WHEN SQLSTATE = '22023' THEN 'invalid' ELSE 'failed' END,
                              'error_code', SQLSTATE);
  END;

  UPDATE bridge_inbox
     SET status = 'processed', payload = NULL, result_table = v_table, result_id = v_id,
         processed_at = now(), error_code = NULL
   WHERE church_id = p_church AND msg_id = p_msg;

  INSERT INTO audit_log (actor_id, actor_role, action, target_type, target_id, detail, church_id)
  VALUES (NULL, 'system', 'bridge_ingest', v_table, v_id::text,
          jsonb_build_object('msg_id', p_msg, 'type', p_type, 'source', 'tch_website',
                             'created', v_created, 'possible_duplicate', v_dup),
          p_church);

  RETURN jsonb_build_object(
    'status', 'accepted', 'receipt', v_row.receipt, 'result_table', v_table, 'result_id', v_id,
    'created', v_created, 'quarantined', false, 'possible_duplicate', v_dup,
    'assigned_to', v_assignee, 'department_ids', to_jsonb(v_depts));
END;
$$;

REVOKE ALL ON FUNCTION bridge_ingest(UUID, UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB, UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION bridge_ingest(UUID, UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB, UUID, BOOLEAN) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION bridge_ingest(UUID, UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB, UUID, BOOLEAN) TO service_role;

COMMIT;

-- Verify (should list the function with prosecdef = true, and no
-- EXECUTE for anon/authenticated):
SELECT p.proname, p.prosecdef,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_exec
FROM pg_proc p WHERE p.proname = 'bridge_ingest';
