export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import {
  BRIDGE_INGEST_PATH, BRIDGE_MAX_BODY_BYTES, BridgeConfigError, isBridgeEnabled, loadBridgeConfig,
  mapTeamsToDepartmentIds, notificationSafe, parseEnvelope, sha256Hex, verifyRequest,
} from '@/lib/bridge';
import type { BridgeConfig, BridgeEnvelope, BridgeKey } from '@/lib/bridge';
import { assignToLeastLoadedCareTeamMember } from '@/lib/care-assignment';
import { notifyUsers } from '@/lib/notify';
import { EXCLUDE_DEMO_IDS } from '@/lib/demo-accounts';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

// Signed sign-ups from The Comforters House website (wire contract v1,
// docs/TCH_WEBSITE_BRIDGE.md). No shepherd_token cookie — the HMAC check
// in src/lib/bridge.ts is the only auth, so src/middleware.ts exempts
// exactly POST /api/bridge/ingest (isBridgeIngest) and nothing else.
//
// Logging rule: never log the body, names, contact details or prayer
// text — message id, type, status and error codes only.

const json = (status: number, body: Record<string, unknown>, extra?: Record<string, string>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...extra } });

// Config is parsed once per process; key→branch ownership is checked
// against the database once per key (successes cached, failures retried).
let cachedConfig: BridgeConfig | null = null;
const verifiedKeys = new Set<string>();

function getConfig(): BridgeConfig {
  if (!cachedConfig) cachedConfig = loadBridgeConfig(process.env);
  return cachedConfig;
}

async function keyScopeIsValid(key: BridgeKey): Promise<boolean> {
  const cacheKey = `${key.id}:${key.church_id}:${key.branch_id ?? ''}`;
  if (verifiedKeys.has(cacheKey)) return true;
  const url = key.branch_id
    ? `${SUPABASE_URL}/rest/v1/branches?id=eq.${key.branch_id}&church_id=eq.${key.church_id}&select=id&limit=1`
    : `${SUPABASE_URL}/rest/v1/churches?id=eq.${key.church_id}&select=id&limit=1`;
  const res = await fetch(url, { headers: hdrs() });
  const rows = await res.json().catch(() => null);
  const ok = res.ok && Array.isArray(rows) && rows.length === 1;
  if (ok) verifiedKeys.add(cacheKey);
  return ok;
}

// Reads at most maxBytes; null means "too large".
async function readBodyLimited(req: Request, maxBytes: number): Promise<Uint8Array | null> {
  const declared = req.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) return null;
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.byteLength; }
  return out;
}

async function countInbox(churchId: string, sinceIso: string): Promise<number> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/bridge_inbox?church_id=eq.${churchId}&received_at=gte.${encodeURIComponent(sinceIso)}&select=msg_id`,
    { method: 'HEAD', headers: { ...hdrs(), Prefer: 'count=exact', Range: '0-0' } }
  );
  const range = res.headers.get('content-range') || '';
  const total = Number(range.split('/')[1]);
  if (!res.ok && res.status !== 416) throw new Error(`inbox_count_${res.status}`);
  if (!Number.isFinite(total)) throw new Error('inbox_count_unparsed');
  return total;
}

async function userIds(query: string): Promise<string[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users?${query}${EXCLUDE_DEMO_IDS}&select=id`, { headers: hdrs() });
  const rows = await res.json().catch(() => null);
  return Array.isArray(rows) ? rows.map((u: { id: string }) => u.id) : [];
}

const overseers = (churchId: string, roles = 'overseer,pa') =>
  userIds(`role=in.(${roles})&is_active=eq.true&church_id=eq.${churchId}`);

async function departmentHeads(churchId: string, departmentIds: string[]): Promise<string[]> {
  if (departmentIds.length === 0) return [];
  return userIds(`role=eq.department_head&is_active=eq.true&church_id=eq.${churchId}&department_id=in.(${departmentIds.join(',')})`);
}

async function churchDepartments(churchId: string): Promise<{ id: string; name: string }[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/departments?church_id=eq.${churchId}&select=id,name`, { headers: hdrs() });
  const rows = await res.json().catch(() => null);
  return Array.isArray(rows) ? rows : [];
}

// Notification copy: plain text, truncated name only — never phone,
// email, notes or prayer text — and constant links.
async function notify(env: BridgeEnvelope, churchId: string, cfg: BridgeConfig, result: { assigned_to?: string | null; department_ids?: string[] }) {
  switch (env.type) {
    case 'member.join':
    case 'care.salvation': {
      const recipients = await overseers(churchId);
      if (result.assigned_to) recipients.push(result.assigned_to);
      const name = notificationSafe(env.data.full_name, 60);
      await notifyUsers(recipients, env.type === 'member.join'
        ? { type: 'pipeline', title: 'New website sign-up', body: `${name} asked to join via the website. Open Care to follow up.`, link: '/care' }
        : { type: 'pastoral', title: 'Salvation decision (website)', body: `${name} shared a salvation decision on the website. Open Care to follow up.`, link: '/care' },
        churchId);
      return;
    }
    case 'prayer.request': {
      const [departments, admins] = await Promise.all([
        churchDepartments(churchId),
        overseers(churchId, 'overseer,general_overseer,pa,lead_tech'),
      ]);
      const prayerDeptIds = mapTeamsToDepartmentIds(['Prayer Team'], cfg.teamMap, departments);
      const recipients = [...(await departmentHeads(churchId, prayerDeptIds)), ...admins];
      await notifyUsers(recipients, {
        type: 'pastoral', title: 'New prayer request (website)',
        body: 'An anonymous prayer request was submitted on the website.', link: '/dashboard?page=prayer',
      }, churchId);
      return;
    }
    case 'workforce.volunteer': {
      let recipients = await departmentHeads(churchId, result.department_ids || []);
      if (recipients.length === 0) recipients = await overseers(churchId);
      const n = env.data.teams.length;
      await notifyUsers(recipients, {
        type: 'pipeline', title: 'New volunteer interest (website)',
        body: `${notificationSafe(env.data.full_name, 60)} wants to serve${n ? ` (${n} team${n === 1 ? '' : 's'})` : ''}. See Volunteers in the department portal.`,
        link: '/department?tab=volunteers',
      }, churchId);
      return;
    }
  }
}

export async function POST(req: Request) {
  if (!isBridgeEnabled(process.env)) return json(503, { error: 'bridge_disabled' });

  let cfg: BridgeConfig;
  try {
    cfg = getConfig();
  } catch (err) {
    console.error('[bridge] config invalid:', err instanceof BridgeConfigError ? err.code : 'unknown');
    return json(503, { error: 'bridge_disabled' });
  }

  const raw = await readBodyLimited(req, BRIDGE_MAX_BODY_BYTES);
  if (raw === null) return json(413, { error: 'payload_too_large' });

  const auth = verifyRequest({
    keys: cfg.keys,
    expectedHost: cfg.expectedHost,
    path: BRIDGE_INGEST_PATH,
    keyId: req.headers.get('x-bridge-key'),
    timestamp: req.headers.get('x-bridge-timestamp'),
    signature: req.headers.get('x-bridge-signature'),
    body: raw,
  });
  if (!auth.ok) {
    console.warn('[bridge] unauthorized:', auth.reason);
    return json(401, { error: 'unauthorized' });
  }
  const key = auth.key;

  const contentType = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json') return json(400, { error: 'bad_content_type' });

  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
  } catch {
    return json(400, { error: 'invalid_encoding' });
  }
  const parsed = parseEnvelope(text);
  if (!parsed.ok) {
    console.warn('[bridge] rejected:', parsed.code);
    return json(parsed.status, { error: parsed.code });
  }
  const env = parsed.value;
  const log = (status: string, code?: string) => console.info('[bridge]', JSON.stringify({ id: env.id, type: env.type, status, ...(code ? { code } : {}) }));

  try {
    // The website waits at most 3.5s for an answer, so every lookup that
    // doesn't depend on another runs in parallel. (A timeout is still safe:
    // the retry is answered 'duplicate' — just wasted work.)
    const now = Date.now();
    const needsAssignee = env.type === 'member.join' || env.type === 'care.salvation';
    const [scopeOk, lastMinute, lastDay, careAssignee, departments] = await Promise.all([
      keyScopeIsValid(key),
      countInbox(key.church_id, new Date(now - 60_000).toISOString()),
      countInbox(key.church_id, new Date(now - 86_400_000).toISOString()),
      needsAssignee ? assignToLeastLoadedCareTeamMember(SUPABASE_URL, hdrs(), key.church_id) : Promise.resolve(null),
      env.type === 'workforce.volunteer' ? churchDepartments(key.church_id) : Promise.resolve([]),
    ]);
    if (!scopeOk) {
      console.error('[bridge] key scope invalid (branch not in church) for key', key.id);
      log('failed', 'key_scope');
      return json(500, { error: 'processing_failed' });
    }
    if (lastMinute >= cfg.perMinute) {
      log('rate_limited');
      return json(429, { error: 'rate_limited' }, { 'Retry-After': '60' });
    }
    const quarantine = lastDay >= cfg.dailyCap;

    const assignee: string | null = quarantine ? null : careAssignee;
    const data: Record<string, unknown> = { ...env.data };
    if (!quarantine && env.type === 'workforce.volunteer') {
      data.department_ids = mapTeamsToDepartmentIds(env.data.teams, cfg.teamMap, departments);
    }

    const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/bridge_ingest`, {
      method: 'POST',
      headers: hdrs(),
      body: JSON.stringify({
        p_church: key.church_id,
        p_branch: key.branch_id,
        p_msg: env.id,
        p_type: env.type,
        p_hash: sha256Hex(raw),
        p_consent_version: env.consent.version,
        p_consent_at: env.consent.at,
        p_data: data,
        p_assignee: assignee,
        p_quarantine: quarantine,
      }),
    });
    if (!rpc.ok) {
      log('failed', `rpc_${rpc.status}`);
      return json(500, { error: 'processing_failed' });
    }
    const result = await rpc.json() as {
      status?: string; receipt?: string; created?: boolean; quarantined?: boolean;
      assigned_to?: string | null; department_ids?: string[]; error_code?: string;
    };

    switch (result.status) {
      case 'accepted':
        log(result.quarantined ? 'quarantined' : 'accepted');
        if (result.created === true && !result.quarantined) {
          // The row is committed — a notification failure must not turn
          // into a 500 (the website would just retry into a duplicate).
          await notify(env, key.church_id, cfg, result).catch(() => console.error('[bridge] notify failed', env.id));
        }
        return json(202, { status: 'accepted', receipt: result.receipt });
      case 'duplicate':
        log('duplicate');
        return json(200, { status: 'duplicate' });
      case 'conflict':
        log('conflict');
        return json(409, { error: 'conflict' });
      case 'invalid':
        log('invalid', result.error_code);
        return json(422, { error: 'invalid_data' });
      default:
        log('failed', result.error_code || 'unknown');
        return json(500, { error: 'processing_failed' });
    }
  } catch (err) {
    // Only our own fixed codes are logged verbatim; other messages (e.g.
    // a JSON parse error) can echo response text.
    const code = err instanceof Error && /^inbox_count_\w+$/.test(err.message) ? err.message : 'exception';
    log('failed', code);
    return json(500, { error: 'processing_failed' });
  }
}
