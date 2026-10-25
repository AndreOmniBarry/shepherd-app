// ============================================================
// SHEP.HERD — TCH website bridge (wire contract v1)
// Pure functions only: signing/verification, env parsing, payload
// validation/sanitisation and team→department mapping. No database or
// network access here (except callWebsiteFlush at the bottom, which only
// uses fetch), so scripts/test-bridge.mjs can exercise all of it
// offline. The route that uses this is src/app/api/bridge/ingest/route.ts;
// setup and rotation are in docs/TCH_WEBSITE_BRIDGE.md.
//
// Unlike src/lib/paystack.ts, signature comparison here is constant-time
// (crypto.timingSafeEqual on decoded bytes) and every failure is a
// boolean "no" — nothing is swallowed into a success.
// ============================================================
import crypto from 'crypto';

export const BRIDGE_INGEST_PATH = '/api/bridge/ingest';
export const BRIDGE_FLUSH_PATH = '/api/bridge/flush';
export const BRIDGE_MAX_BODY_BYTES = 16 * 1024;
export const BRIDGE_MAX_SKEW_SECONDS = 300;
export const BRIDGE_SOURCE = 'tch_website';

export const BRIDGE_TYPES = ['member.join', 'care.salvation', 'prayer.request', 'workforce.volunteer'] as const;
export type BridgeType = typeof BRIDGE_TYPES[number];

export const TEAM_ALLOWLIST = [
  'Ushering & Hospitality',
  'Media & Live Stream',
  'Worship & Music',
  "Children's Ministry",
  'Outreach & Missions',
  'Prayer Team',
  'Protocol & Security',
  'Sanitation & Facilities',
  'Follow-up & Counselling',
  'Administration',
] as const;
export type Team = typeof TEAM_ALLOWLIST[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;
const KEY_ID_RE = /^[A-Za-z0-9._-]{1,64}$/;
const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d{1,5})?$/;

export class BridgeConfigError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

// ── Keys / config ─────────────────────────────────────────────────────

export interface BridgeKey {
  id: string;
  secret: string;
  church_id: string;
  branch_id: string | null;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}

/** Parses BRIDGE_KEYS. Throws BridgeConfigError on anything malformed. */
export function parseBridgeKeys(raw: string | undefined): BridgeKey[] {
  if (!raw || !raw.trim()) throw new BridgeConfigError('keys_missing');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new BridgeConfigError('keys_not_json'); }
  if (!Array.isArray(parsed) || parsed.length === 0) throw new BridgeConfigError('keys_not_array');
  const seen = new Set<string>();
  return parsed.map((k: unknown) => {
    if (!isPlainObject(k)) throw new BridgeConfigError('key_not_object');
    for (const field of Object.keys(k)) {
      if (!['id', 'secret', 'church_id', 'branch_id'].includes(field)) throw new BridgeConfigError('key_unknown_field');
    }
    const { id, secret, church_id, branch_id } = k;
    if (typeof id !== 'string' || !KEY_ID_RE.test(id)) throw new BridgeConfigError('key_bad_id');
    if (seen.has(id)) throw new BridgeConfigError('key_duplicate_id');
    seen.add(id);
    if (typeof secret !== 'string' || secret.length < 32) throw new BridgeConfigError('key_weak_secret');
    if (typeof church_id !== 'string' || !UUID_RE.test(church_id)) throw new BridgeConfigError('key_bad_church');
    if (branch_id !== undefined && branch_id !== null && (typeof branch_id !== 'string' || !UUID_RE.test(branch_id))) {
      throw new BridgeConfigError('key_bad_branch');
    }
    return { id, secret, church_id: church_id.toLowerCase(), branch_id: typeof branch_id === 'string' ? branch_id.toLowerCase() : null };
  });
}

/** Lowercases and checks a bare host (optionally :port). Throws on anything else. */
export function normalizeHost(raw: string | undefined): string {
  const host = (raw || '').trim().toLowerCase();
  if (!host || !HOST_RE.test(host)) throw new BridgeConfigError('expected_host_invalid');
  return host;
}

export type TeamDepartmentMap = Record<Team, string>;

/**
 * BRIDGE_TEAM_DEPARTMENTS (optional): JSON object of allowlisted team →
 * exact SHEP department name for this church. Unmapped teams default to
 * a department named exactly like the team.
 */
export function parseTeamDepartmentMap(raw: string | undefined): TeamDepartmentMap {
  const map = Object.fromEntries(TEAM_ALLOWLIST.map(t => [t, t])) as TeamDepartmentMap;
  if (!raw || !raw.trim()) return map;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new BridgeConfigError('team_map_not_json'); }
  if (!isPlainObject(parsed)) throw new BridgeConfigError('team_map_not_object');
  for (const [team, dept] of Object.entries(parsed)) {
    if (!(TEAM_ALLOWLIST as readonly string[]).includes(team)) throw new BridgeConfigError('team_map_unknown_team');
    if (typeof dept !== 'string' || !dept.trim() || dept.length > 120) throw new BridgeConfigError('team_map_bad_department');
    map[team as Team] = dept.trim();
  }
  return map;
}

function parsePositiveInt(raw: string | undefined, fallback: number, code: string): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  if (!/^\d{1,7}$/.test(raw.trim())) throw new BridgeConfigError(code);
  const n = Number(raw.trim());
  if (n < 1) throw new BridgeConfigError(code);
  return n;
}

export interface BridgeConfig {
  keys: BridgeKey[];
  expectedHost: string;
  dailyCap: number;
  perMinute: number;
  teamMap: TeamDepartmentMap;
}

/** BRIDGE_ENABLED must be explicitly on — unset means off. */
export function isBridgeEnabled(env: Record<string, string | undefined>): boolean {
  return ['on', 'true', '1'].includes((env.BRIDGE_ENABLED || '').trim().toLowerCase());
}

export function loadBridgeConfig(env: Record<string, string | undefined>): BridgeConfig {
  return {
    keys: parseBridgeKeys(env.BRIDGE_KEYS),
    expectedHost: normalizeHost(env.BRIDGE_EXPECTED_HOST),
    dailyCap: parsePositiveInt(env.BRIDGE_DAILY_CAP, 200, 'daily_cap_invalid'),
    perMinute: parsePositiveInt(env.BRIDGE_RATE_PER_MINUTE, 30, 'rate_invalid'),
    teamMap: parseTeamDepartmentMap(env.BRIDGE_TEAM_DEPARTMENTS),
  };
}

// ── Signing / verification ────────────────────────────────────────────

export function sha256Hex(body: string | Uint8Array): string {
  return crypto.createHash('sha256').update(body).digest('hex');
}

export function canonicalString(p: { path: string; host: string; ts: string; keyId: string; bodySha256: string }): string {
  return ['v1', 'POST', p.path, p.host, p.ts, p.keyId, p.bodySha256].join('\n');
}

function hmac(secret: string, canonical: string): Buffer {
  return crypto.createHmac('sha256', secret).update(canonical, 'utf8').digest();
}

/** Returns the X-Bridge-Signature header value ("v1=<hex>"). The secret is used as its UTF-8 string bytes. */
export function signRequest(p: { secret: string; path: string; host: string; ts: string; keyId: string; body: string | Uint8Array }): string {
  const canonical = canonicalString({ path: p.path, host: p.host, ts: p.ts, keyId: p.keyId, bodySha256: sha256Hex(p.body) });
  return `v1=${hmac(p.secret, canonical).toString('hex')}`;
}

// Per-process random key for unknown keyIds — the HMAC is computed and
// compared anyway so an unknown key costs the same as a wrong signature.
const DUMMY_SECRET = crypto.randomBytes(32).toString('hex');
const ZERO_SIG = Buffer.alloc(32);

export type VerifyFailure = 'missing_headers' | 'bad_timestamp' | 'stale_timestamp' | 'bad_signature_format' | 'unknown_key' | 'bad_signature';
export type VerifyResult = { ok: true; key: BridgeKey } | { ok: false; reason: VerifyFailure };

export function verifyRequest(p: {
  keys: BridgeKey[];
  expectedHost: string;
  path: string;
  keyId: string | null;
  timestamp: string | null;
  signature: string | null;
  body: Uint8Array | string;
  nowSeconds?: number;
}): VerifyResult {
  const now = p.nowSeconds ?? Math.floor(Date.now() / 1000);
  const keyId = p.keyId ?? '';
  const ts = p.timestamp ?? '';
  const sigHeader = p.signature ?? '';

  const key = KEY_ID_RE.test(keyId) ? p.keys.find(k => k.id === keyId) : undefined;
  const tsWellFormed = /^\d{1,12}$/.test(ts);
  const tsFresh = tsWellFormed && Math.abs(now - Number(ts)) <= BRIDGE_MAX_SKEW_SECONDS;
  const sigMatch = /^v1=([0-9a-fA-F]{64})$/.exec(sigHeader);
  const provided = sigMatch ? Buffer.from(sigMatch[1], 'hex') : ZERO_SIG;

  // Always do the full HMAC + constant-time compare, whatever else failed.
  const canonical = canonicalString({ path: p.path, host: p.expectedHost, ts, keyId, bodySha256: sha256Hex(p.body) });
  const expected = hmac(key ? key.secret : DUMMY_SECRET, canonical);
  const sigEqual = provided.length === expected.length && crypto.timingSafeEqual(provided, expected);

  if (!p.keyId || !p.timestamp || !p.signature) return { ok: false, reason: 'missing_headers' };
  if (!tsWellFormed) return { ok: false, reason: 'bad_timestamp' };
  if (!sigMatch) return { ok: false, reason: 'bad_signature_format' };
  if (!key) return { ok: false, reason: 'unknown_key' };
  if (!tsFresh) return { ok: false, reason: 'stale_timestamp' };
  if (!sigEqual) return { ok: false, reason: 'bad_signature' };
  return { ok: true, key };
}

// ── Payload validation / sanitisation ─────────────────────────────────

// C0/C1 controls (minus \n, handled separately), zero-width and bidi
// override/isolate characters.
const CONTROL_RE = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

export function cleanText(v: string, multiline: boolean): string {
  let s = v.normalize('NFC').replace(/\r\n?/g, '\n').replace(CONTROL_RE, '');
  if (multiline) s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  else s = s.replace(/\n/g, '');
  return s.trim();
}

export interface MemberJoinData { full_name: string; email: string | null; phone: string | null; note: string | null }
export interface CareSalvationData extends MemberJoinData { city: string | null }
export interface PrayerRequestData { request: string }
export interface VolunteerData { full_name: string; email: string | null; phone: string | null; teams: Team[]; team_idea: string | null }

export type BridgeEnvelope =
  | { type: 'member.join'; data: MemberJoinData } & EnvelopeMeta
  | { type: 'care.salvation'; data: CareSalvationData } & EnvelopeMeta
  | { type: 'prayer.request'; data: PrayerRequestData } & EnvelopeMeta
  | { type: 'workforce.volunteer'; data: VolunteerData } & EnvelopeMeta;

interface EnvelopeMeta { id: string; occurredAt: string; consent: { version: string; at: string } }

export type ParseResult = { ok: true; value: BridgeEnvelope } | { ok: false; status: 400 | 422; code: string };

class Invalid extends Error {
  code: string;
  constructor(code: string) { super(code); this.code = code; }
}

function onlyKeys(obj: Record<string, unknown>, allowed: readonly string[]) {
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) throw new Invalid('unknown_key');
}

function text(obj: Record<string, unknown>, key: string, o: { min?: number; max: number; multiline?: boolean; optional?: boolean }): string | null {
  const v = obj[key];
  if (v === undefined || v === null) {
    if (o.optional) return null;
    throw new Invalid(`missing_${key}`);
  }
  if (typeof v !== 'string') throw new Invalid(`invalid_${key}`);
  const s = cleanText(v, !!o.multiline);
  if (s === '') {
    if (o.optional) return null;
    throw new Invalid(`missing_${key}`);
  }
  if (s.length > o.max || s.length < (o.min ?? 1)) throw new Invalid(`invalid_${key}`);
  return s;
}

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
const PHONE_RE = /^[0-9+()\-. /]+$/;

function contact(obj: Record<string, unknown>) {
  const emailRaw = text(obj, 'email', { max: 160, optional: true });
  const email = emailRaw ? emailRaw.toLowerCase() : null;
  if (email && !EMAIL_RE.test(email)) throw new Invalid('invalid_email');
  const phone = text(obj, 'phone', { max: 32, optional: true });
  if (phone) {
    const digits = phone.replace(/\D/g, '').length;
    if (!PHONE_RE.test(phone) || digits < 6 || digits > 20) throw new Invalid('invalid_phone');
  }
  if (!email && !phone) throw new Invalid('missing_contact');
  return { email, phone };
}

function isoDate(v: unknown, code: string): string {
  if (typeof v !== 'string' || !ISO_RE.test(v) || Number.isNaN(Date.parse(v))) throw new Invalid(code);
  return v;
}

function parseData(type: BridgeType, raw: unknown): BridgeEnvelope['data'] {
  if (!isPlainObject(raw)) throw new Invalid('invalid_data');
  switch (type) {
    case 'member.join': {
      onlyKeys(raw, ['full_name', 'email', 'phone', 'note']);
      const full_name = text(raw, 'full_name', { min: 2, max: 120 })!;
      const { email, phone } = contact(raw);
      return { full_name, email, phone, note: text(raw, 'note', { max: 1000, multiline: true, optional: true }) };
    }
    case 'care.salvation': {
      onlyKeys(raw, ['full_name', 'email', 'phone', 'city', 'note']);
      const full_name = text(raw, 'full_name', { min: 2, max: 120 })!;
      const { email, phone } = contact(raw);
      return {
        full_name, email, phone,
        city: text(raw, 'city', { max: 80, optional: true }),
        note: text(raw, 'note', { max: 1000, multiline: true, optional: true }),
      };
    }
    case 'prayer.request': {
      onlyKeys(raw, ['request']);
      return { request: text(raw, 'request', { min: 3, max: 4000, multiline: true })! };
    }
    case 'workforce.volunteer': {
      onlyKeys(raw, ['full_name', 'email', 'phone', 'teams', 'team_idea']);
      const full_name = text(raw, 'full_name', { min: 2, max: 120 })!;
      const { email, phone } = contact(raw);
      let teams: Team[] = [];
      if (raw.teams !== undefined && raw.teams !== null) {
        if (!Array.isArray(raw.teams) || raw.teams.length > 10) throw new Invalid('invalid_teams');
        const set = new Set<Team>();
        for (const t of raw.teams) {
          if (typeof t !== 'string') throw new Invalid('invalid_teams');
          const name = cleanText(t, false);
          if (!(TEAM_ALLOWLIST as readonly string[]).includes(name)) throw new Invalid('invalid_teams');
          set.add(name as Team);
        }
        teams = Array.from(set);
      }
      const team_idea = text(raw, 'team_idea', { max: 600, multiline: true, optional: true });
      if (teams.length === 0 && !team_idea) throw new Invalid('missing_teams');
      return { full_name, email, phone, teams, team_idea };
    }
  }
}

/** Parses and strictly validates the request body (already authenticated). */
export function parseEnvelope(rawBody: string): ParseResult {
  let body: unknown;
  try { body = JSON.parse(rawBody); } catch { return { ok: false, status: 400, code: 'invalid_json' }; }
  try {
    if (!isPlainObject(body)) throw new Invalid('invalid_body');
    onlyKeys(body, ['v', 'id', 'type', 'occurredAt', 'consent', 'data']);
    if (body.v !== 1) throw new Invalid('unsupported_version');
    if (typeof body.id !== 'string' || !UUID_V4_RE.test(body.id)) throw new Invalid('invalid_id');
    if (typeof body.type !== 'string' || !(BRIDGE_TYPES as readonly string[]).includes(body.type)) throw new Invalid('unknown_type');
    const occurredAt = isoDate(body.occurredAt, 'invalid_occurred_at');
    if (!isPlainObject(body.consent)) throw new Invalid('missing_consent');
    onlyKeys(body.consent, ['version', 'at']);
    const version = body.consent.version;
    if (typeof version !== 'string' || !/^[A-Za-z0-9._-]{1,32}$/.test(version)) throw new Invalid('invalid_consent');
    const consentAt = isoDate(body.consent.at, 'invalid_consent');
    const type = body.type as BridgeType;
    const data = parseData(type, body.data);
    return {
      ok: true,
      value: { id: body.id.toLowerCase(), type, occurredAt, consent: { version, at: consentAt }, data } as BridgeEnvelope,
    };
  } catch (err) {
    if (err instanceof Invalid) return { ok: false, status: 422, code: err.code };
    return { ok: false, status: 400, code: 'invalid_body' };
  }
}

// ── Team → department mapping ─────────────────────────────────────────

/**
 * Exact-name match of each team's mapped department name against the
 * church's own departments list (already fetched, church-scoped). Never
 * builds a query or a pattern from the submitted text.
 */
export function mapTeamsToDepartmentIds(teams: Team[], map: TeamDepartmentMap, departments: { id: string; name: string }[]): string[] {
  const wanted = new Set(teams.map(t => map[t]));
  const ids = departments.filter(d => typeof d.name === 'string' && wanted.has(d.name)).map(d => d.id);
  return Array.from(new Set(ids));
}

/** Plain, length-capped string for notification bodies. */
export function notificationSafe(s: string, max: number): string {
  const clean = cleanText(s, false);
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

// ── Flush caller (SHEP/scheduler → website, contract §2) ──────────────

export interface FlushConfig { url: URL; keyId: string; secret: string }

/** Returns null when BRIDGE_FLUSH_* is not configured; throws on malformed config. */
export function loadFlushConfig(env: Record<string, string | undefined>): FlushConfig | null {
  const { BRIDGE_FLUSH_URL: rawUrl, BRIDGE_FLUSH_KEY_ID: keyId, BRIDGE_FLUSH_SECRET: secret } = env;
  if (!rawUrl && !keyId && !secret) return null;
  if (!rawUrl || !keyId || !secret) throw new BridgeConfigError('flush_incomplete');
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new BridgeConfigError('flush_bad_url'); }
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new BridgeConfigError('flush_not_https');
  if (url.pathname !== BRIDGE_FLUSH_PATH || url.search || url.hash) throw new BridgeConfigError('flush_bad_path');
  if (!KEY_ID_RE.test(keyId)) throw new BridgeConfigError('flush_bad_key_id');
  if (secret.length < 32) throw new BridgeConfigError('flush_weak_secret');
  return { url, keyId, secret };
}

export function buildFlushRequest(cfg: FlushConfig, nowSeconds = Math.floor(Date.now() / 1000)) {
  const body = '{}';
  const ts = String(nowSeconds);
  // URL.host is already lowercase and omits the scheme's default port.
  const host = cfg.url.host;
  return {
    url: cfg.url.toString(),
    body,
    headers: {
      'Content-Type': 'application/json',
      'X-Bridge-Key': cfg.keyId,
      'X-Bridge-Timestamp': ts,
      'X-Bridge-Signature': signRequest({ secret: cfg.secret, path: BRIDGE_FLUSH_PATH, host, ts, keyId: cfg.keyId, body }),
    },
  };
}

export type FlushResult = { ok: true; pending: number; delivered: number; dead: number } | { ok: false; status: number };

export async function callWebsiteFlush(cfg: FlushConfig): Promise<FlushResult> {
  const req = buildFlushRequest(cfg);
  const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body, signal: AbortSignal.timeout(15000) });
  if (!res.ok) return { ok: false, status: res.status };
  const json: unknown = await res.json().catch(() => null);
  const n = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0);
  if (!isPlainObject(json)) return { ok: false, status: res.status };
  return { ok: true, pending: n(json.pending), delivered: n(json.delivered), dead: n(json.dead) };
}
