# TCH website ⇄ SHEP.HRD bridge

The Comforters House website (repo `AndreOmniBarry/TCH-Global`) sends four kinds of sign-up to SHEP.HRD over a signed HTTPS call (wire contract v1):

| Website form | `type` | Lands in SHEP as | Who is notified |
|---|---|---|---|
| Join the church | `member.join` | `first_timers` row (`how_they_came='website'`, `would_join='yes'`, `status='new'`), auto-assigned to the least-loaded care-team member | Overseers/PAs + the assignee |
| Salvation decision | `care.salvation` | `first_timers` row with `salvation_decision=true`, city in `address`, auto-assigned | Overseers/PAs + the assignee |
| Prayer request | `prayer.request` | `prayer_requests` row, always anonymous (`requester_name='Anonymous (website)'`, `status='open'`) | Prayer department head(s) + overseers/GO/PA/lead tech |
| Volunteer / workforce | `workforce.volunteer` | `web_volunteer_interest` row (teams, team idea, mapped department ids), shown under **Department portal → Volunteers** | Heads of the mapped departments (overseers/PAs if none map) |

Never bridged in v1: teens/youth, private questions, giving, testimonies, newsletter.

Notifications show only the person's name (truncated). They never include phone numbers, emails, notes or prayer text, and they always link to a fixed page.

## Code map

- `src/app/api/bridge/ingest/route.ts`: the endpoint (POST only).
- `src/lib/bridge.ts`: signature verification, env parsing, strict payload validation and cleaning, team → department mapping, and the flush caller.
- `src/middleware.ts`: `isBridgeIngest` exempts exactly `POST /api/bridge/ingest` from the login check. The HMAC is its only authentication.
- `scripts/84_tch_website_bridge.sql`: the schema, plus the single transactional `bridge_ingest()` function.
- `scripts/test-bridge.mjs`: offline tests (`node scripts/test-bridge.mjs`).
- `scripts/bridge-flush.mjs`: an optional external-scheduler caller for the website's `/api/bridge/flush`.

## One-time setup (owner)

### 1. Run the SQL

In the Supabase dashboard, open **SQL Editor**, paste the whole of `scripts/84_tch_website_bridge.sql`, and run it. It is idempotent, so running it again is safe. The final `SELECT` should show `bridge_ingest | t | f | f`: the function is security-definer, and neither anon nor authenticated can execute it.

### 2. Find the TCH church id (and, optionally, a branch)

```sql
SELECT id, name FROM churches;                               -- pick The Comforters House
SELECT id, name FROM branches WHERE church_id = '<church id>'; -- optional
```

If you set `branch_id`, it must belong to that church. SHEP checks this on the first request, and `bridge_ingest()` checks it again on every call. A mismatch disables ingest with a 500 rather than writing into the wrong place.

### 3. Generate secrets

```bash
openssl rand -hex 32   # ingest secret, K1 (shared with the website)
openssl rand -hex 32   # flush secret (DIFFERENT; only needed if you use flush)
```

The HMAC key is the secret string itself, used as UTF-8 bytes (the 64 hex characters). It is not the 32 decoded bytes. Both sides must do the same.

### 4. Set SHEP env vars (Vercel → Project → Settings → Environment Variables)

| Var | Value |
|---|---|
| `BRIDGE_ENABLED` | `on`. Any other value, or unset, makes ingest return 503. |
| `BRIDGE_KEYS` | `[{"id":"K1","secret":"<hex from step 3>","church_id":"<TCH church id>","branch_id":null}]` |
| `BRIDGE_EXPECTED_HOST` | The SHEP host the website signs for, lowercase, with no scheme or path, e.g. `shep-hrd.vercel.app`. Include a port only if it is non-default. This value is used in the signature; the request's `Host` header is never used. |
| `BRIDGE_DAILY_CAP` | Optional. Default `200`. Messages beyond this many in 24h are quarantined: still answered 202, but they create no row and send no notifications. |
| `BRIDGE_RATE_PER_MINUTE` | Optional. Default `30`. More than this many messages in 60s get a 429 with `Retry-After: 60`, and the website retries. |
| `BRIDGE_TEAM_DEPARTMENTS` | Optional JSON mapping each allowlisted team to the **exact** SHEP department name, e.g. `{"Worship & Music":"Music Department","Prayer Team":"Prayer Department"}`. Teams you leave out map to a department with exactly the team's name. Names are matched exactly, never fuzzily. The `Prayer Team` entry also decides who gets prayer-request notifications. |

Redeploy after changing env vars. Config is parsed once per server instance.

### 5. Give the website its side

The website's own guide is `docs/shep-bridge/SETUP.md` in `AndreOmniBarry/TCH-Global`. These values must match exactly:

| SHEP.HRD (this app) | TCH website | Must be |
|---|---|---|
| `BRIDGE_KEYS[].id` | `SHEP_BRIDGE_KEY_ID` | the same key id, e.g. `K1` |
| `BRIDGE_KEYS[].secret` | `SHEP_BRIDGE_SECRET` | the same 64-character secret |
| `BRIDGE_EXPECTED_HOST` | host part of `SHEP_BRIDGE_URL` | the same host, e.g. `justshephrd.com` |
| `BRIDGE_FLUSH_KEY_ID` / `BRIDGE_FLUSH_SECRET` | `BRIDGE_FLUSH_KEYS` = `F1:<secret>` | the same flush id and secret (optional) |

**Use the address that does not redirect.** The website does not follow
redirects, so if `justshephrd.com` redirects to `www.justshephrd.com` (or the
other way round), every delivery fails and is retried for 24h. Set
`SHEP_BRIDGE_URL` and `BRIDGE_EXPECTED_HOST` to the host the app finally lands
on. Check by opening `https://<host>/login` in a browser and looking at the
address bar.

The website waits 3.5s for an answer. SHEP.HRD runs its lookups in parallel
to stay well inside that. A slow answer is still safe: the retry gets
`duplicate`, and nothing is created twice.


The website needs the same `K1` id and secret, plus the SHEP base URL. Its ingest URL is `https://<BRIDGE_EXPECTED_HOST>/api/bridge/ingest`.

## Rotating keys (K1 → K2)

1. Generate K2 with `openssl rand -hex 32`. Add it to SHEP **alongside** K1: `BRIDGE_KEYS=[{K1…},{"id":"K2",…}]`. Redeploy.
2. Switch the website to K2.
3. After 48h (so retried K1-signed messages have drained), remove K1 from `BRIDGE_KEYS` and redeploy.

If a secret leaks, skip the 48h wait and remove the key immediately. The website will get 401s and alert until it has the new key.

## Kill switch

Set `BRIDGE_ENABLED=off` and redeploy. Ingest then answers 503 to everything, and the website keeps messages in its outbox and retries later. Set it back to `on` to resume.

## Reading `bridge_inbox` (SQL Editor)

```sql
-- Last 50 messages (payload is NULL once processed)
SELECT received_at, type, status, error_code, result_table, result_id, consent_version, consent_at
FROM bridge_inbox WHERE church_id = '<church id>' ORDER BY received_at DESC LIMIT 50;

-- Anything needing attention
SELECT msg_id, type, status, error_code, received_at
FROM bridge_inbox WHERE status IN ('failed', 'quarantined', 'processing') ORDER BY received_at DESC;
```

The four statuses:

- `processed`: the domain row was written and the payload has been cleared.
- `failed`: the domain write failed. The SQLSTATE is in `error_code` (`22023` = data failed the in-database checks), and the payload is kept for diagnosis. The website's retry of the same message (same body hash) processes it again automatically.
- `quarantined`: the message was over `BRIDGE_DAILY_CAP`. No row was created and the payload is kept. Review it. If it is genuine, delete the inbox row and the website's next retry or flush will re-send it. Otherwise delete the row to discard it.

Volunteers appear in the app under **Department portal → Volunteers**.
Department heads see sign-ups mapped to their department; overseers, PAs, GO,
branch pastors and lead tech see all of them. Each can be marked Contacted,
Placed, Declined or Archived. The raw rows are in `web_volunteer_interest`.

## Flush (optional): telling the website to retry its outbox

The website exposes `POST /api/bridge/flush`. It is signed exactly like ingest, with path `/api/bridge/flush`, host = the website's host and body `{}`, but uses a **different** secret. It answers `{"pending":n,"delivered":n,"dead":n}`.

Set these where the scheduler runs:

```
BRIDGE_FLUSH_URL=https://<website host>/api/bridge/flush
BRIDGE_FLUSH_KEY_ID=F1
BRIDGE_FLUSH_SECRET=<second openssl rand -hex 32, shared with the website>
```

and run `node scripts/bridge-flush.mjs` (Node ≥ 22.18). It prints counts only and exits 1 on failure. Example GitHub Actions job, every 15 minutes:

```yaml
on: { schedule: [{ cron: '*/15 * * * *' }] }
jobs:
  flush:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: node scripts/bridge-flush.mjs
        env:
          BRIDGE_FLUSH_URL: ${{ secrets.BRIDGE_FLUSH_URL }}
          BRIDGE_FLUSH_KEY_ID: ${{ secrets.BRIDGE_FLUSH_KEY_ID }}
          BRIDGE_FLUSH_SECRET: ${{ secrets.BRIDGE_FLUSH_SECRET }}
```

Do **not** add this as a sub-daily Vercel cron: the Hobby plan only allows daily crons. In app code, `callWebsiteFlush(loadFlushConfig(process.env))` from `src/lib/bridge.ts` does the same thing.

## Response codes (what the website sees)

| Code | Body | Meaning / website action |
|---|---|---|
| 202 | `{"status":"accepted","receipt":"<uuid>"}` | Stored (or quarantined). Done. |
| 200 | `{"status":"duplicate"}` | Already processed with the identical body. Done. |
| 409 | `{"error":"conflict"}` | Same message id, different body. Dead-letter. |
| 400 / 422 | `{"error":"<code>"}` | Malformed or schema-invalid, e.g. an unknown key. Dead-letter. |
| 401 | `{"error":"unauthorized"}` | Bad or unknown key, signature, timestamp or host. Alert. |
| 413 | `{"error":"payload_too_large"}` | Body over 16 KB. Dead-letter. |
| 429 | `{"error":"rate_limited"}` + `Retry-After` | Retry later. |
| 503 | `{"error":"bridge_disabled"}` | Kill switch, or config invalid. Retry later. |
| 500 | `{"error":"processing_failed"}` | Retry. |

## Data protection (NDPA 2023)

- **Lawful basis and consent.** Every message carries the website's consent version and timestamp. `bridge_inbox.consent_version` / `consent_at` keep that record per message, linked to the created row by `result_table` + `result_id`. `web_volunteer_interest` also stores the consent version and timestamp on the row itself.
- **Minimisation.** Only the fields in the contract are accepted, and any unknown key is rejected with a 422. Prayer requests carry no identity. Processed inbox rows keep no payload, only a SHA-256 of the body. Server logs record message id, type, status and error code, never content.
- **Access.** `bridge_inbox` and `web_volunteer_interest` have RLS enabled with no policies, so they are reachable only with the service role. `bridge_ingest()` can be executed only by the service role.
- **Retention.** Review quarantined and failed rows regularly. Their payload still holds personal data until it is processed or deleted. A suggested monthly clean-up:

  ```sql
  UPDATE bridge_inbox SET payload = NULL WHERE status IN ('failed','quarantined') AND received_at < now() - interval '30 days';
  ```

- **Erasure request (right to erasure).** Run this in the SQL Editor, replacing the placeholders:

  ```sql
  BEGIN;
  -- what will be removed
  SELECT 'first_timers' t, id FROM first_timers
   WHERE church_id = '<church id>' AND source = 'tch_website'
     AND (lower(email) = lower('<email>') OR phone = '<phone>')
  UNION ALL
  SELECT 'web_volunteer_interest', id FROM web_volunteer_interest
   WHERE church_id = '<church id>' AND (lower(email) = lower('<email>') OR phone = '<phone>');

  DELETE FROM bridge_inbox WHERE church_id = '<church id>' AND result_id IN (
    SELECT id FROM first_timers WHERE church_id = '<church id>' AND source = 'tch_website'
      AND (lower(email) = lower('<email>') OR phone = '<phone>')
    UNION ALL
    SELECT id FROM web_volunteer_interest WHERE church_id = '<church id>'
      AND (lower(email) = lower('<email>') OR phone = '<phone>'));
  DELETE FROM first_timers WHERE church_id = '<church id>' AND source = 'tch_website'
    AND (lower(email) = lower('<email>') OR phone = '<phone>');
  DELETE FROM web_volunteer_interest WHERE church_id = '<church id>'
    AND (lower(email) = lower('<email>') OR phone = '<phone>');
  -- also clear any unprocessed payloads that mention them
  UPDATE bridge_inbox SET payload = NULL
   WHERE church_id = '<church id>' AND payload IS NOT NULL
     AND (lower(payload->>'email') = lower('<email>') OR payload->>'phone' = '<phone>');
  COMMIT;
  ```

  Prayer requests are anonymous and cannot be linked to a person. `audit_log` rows hold only ids, so no personal data remains there. If the person also became a member, handle that through the normal member-removal flow. The website must erase its own copy separately.
