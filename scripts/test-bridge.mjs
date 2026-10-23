// Offline tests for src/lib/bridge.ts — no network, no database.
// Run: node scripts/test-bridge.mjs   (Node >= 22.18, which strips TS types natively)
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  BRIDGE_INGEST_PATH, BRIDGE_FLUSH_PATH, TEAM_ALLOWLIST, canonicalString, cleanText, signRequest, sha256Hex,
  verifyRequest, parseEnvelope, parseBridgeKeys, normalizeHost, parseTeamDepartmentMap, mapTeamsToDepartmentIds,
  loadBridgeConfig, isBridgeEnabled, loadFlushConfig, buildFlushRequest, notificationSafe,
} from '../src/lib/bridge.ts';

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (err) { failures.push(name); console.log(`  FAIL ${name}\n       ${err.message}`); }
}

const CHURCH = '11111111-1111-4111-8111-111111111111';
const BRANCH = '22222222-2222-4222-8222-222222222222';
const SECRET = crypto.randomBytes(32).toString('hex');
const SECRET2 = crypto.randomBytes(32).toString('hex');
const keys = parseBridgeKeys(JSON.stringify([
  { id: 'K1', secret: SECRET, church_id: CHURCH, branch_id: BRANCH },
  { id: 'K2', secret: SECRET2, church_id: CHURCH, branch_id: null },
]));
const HOST = 'shep.example.org';
const NOW = 1_800_000_000;

function envelope(type, data, extra = {}) {
  return JSON.stringify({
    v: 1, id: crypto.randomUUID(), type, occurredAt: '2026-10-21T09:00:00.000Z',
    consent: { version: '2026-10', at: '2026-10-21T08:59:00Z' }, data, ...extra,
  });
}

function signed(body, { keyId = 'K1', secret = SECRET, host = HOST, ts = String(NOW), path = BRIDGE_INGEST_PATH } = {}) {
  return { keyId, timestamp: ts, signature: signRequest({ secret, path, host, ts, keyId, body }) };
}

function verify(body, headers, overrides = {}) {
  return verifyRequest({ keys, expectedHost: HOST, path: BRIDGE_INGEST_PATH, body, nowSeconds: NOW, ...headers, ...overrides });
}

const body = envelope('member.join', { full_name: 'Ada Obi', phone: '+234 803 000 0000' });

console.log('sign / verify');
test('canonical string matches contract layout', () => {
  const c = canonicalString({ path: BRIDGE_INGEST_PATH, host: HOST, ts: '123', keyId: 'K1', bodySha256: sha256Hex('{}') });
  assert.equal(c, `v1\nPOST\n/api/bridge/ingest\n${HOST}\n123\nK1\n${crypto.createHash('sha256').update('{}').digest('hex')}`);
});
test('signature is v1=<hex HMAC-SHA256(secret, canonical)>', () => {
  const sig = signRequest({ secret: SECRET, path: BRIDGE_INGEST_PATH, host: HOST, ts: '123', keyId: 'K1', body: '{}' });
  const canonical = ['v1', 'POST', '/api/bridge/ingest', HOST, '123', 'K1', sha256Hex('{}')].join('\n');
  assert.equal(sig, `v1=${crypto.createHmac('sha256', SECRET).update(canonical).digest('hex')}`);
});
test('valid request verifies (string and byte bodies)', () => {
  const r = verify(body, signed(body));
  assert.equal(r.ok, true);
  assert.equal(r.key.id, 'K1');
  assert.equal(verify(Buffer.from(body), signed(body)).ok, true);
});
test('second key (rotation) verifies', () => {
  assert.equal(verify(body, signed(body, { keyId: 'K2', secret: SECRET2 })).ok, true);
});
test('uppercase hex signature accepted', () => {
  const h = signed(body);
  h.signature = 'v1=' + h.signature.slice(3).toUpperCase();
  assert.equal(verify(body, h).ok, true);
});

console.log('timestamp window');
test('ts exactly 300s old accepted', () => assert.equal(verify(body, signed(body, { ts: String(NOW - 300) })).ok, true));
test('ts 301s old rejected', () => assert.deepEqual(verify(body, signed(body, { ts: String(NOW - 301) })), { ok: false, reason: 'stale_timestamp' }));
test('ts 301s in future rejected', () => assert.deepEqual(verify(body, signed(body, { ts: String(NOW + 301) })), { ok: false, reason: 'stale_timestamp' }));
test('non-integer ts rejected', () => {
  for (const ts of [`${NOW}.0`, `-${NOW}`, ` ${NOW}`, '1e9', '', `${NOW}x`]) {
    const r = verify(body, signed(body, { ts }));
    assert.equal(r.ok, false, `ts ${JSON.stringify(ts)}`);
  }
});

console.log('keys / tampering / host');
test('unknown keyId → unknown_key (HMAC still computed)', () => {
  assert.deepEqual(verify(body, signed(body, { keyId: 'K9' })), { ok: false, reason: 'unknown_key' });
});
test('right key id, wrong secret rejected', () => {
  assert.deepEqual(verify(body, signed(body, { secret: SECRET2 })), { ok: false, reason: 'bad_signature' });
});
test('tampered body rejected', () => {
  const h = signed(body);
  assert.deepEqual(verify(body.replace('Ada', 'Eve'), h), { ok: false, reason: 'bad_signature' });
});
test('signature for flush path rejected on ingest', () => {
  assert.equal(verify(body, signed(body, { path: BRIDGE_FLUSH_PATH })).ok, false);
});
test('wrong host rejected (expected host comes from config, not request)', () => {
  assert.deepEqual(verify(body, signed(body, { host: 'evil.example.org' })), { ok: false, reason: 'bad_signature' });
  assert.deepEqual(verify(body, signed(body, { host: 'SHEP.example.org' })), { ok: false, reason: 'bad_signature' });
});
test('missing / malformed signature header rejected', () => {
  const h = signed(body);
  assert.equal(verify(body, { ...h, signature: null }).ok, false);
  assert.equal(verify(body, { ...h, signature: h.signature.slice(3) }).ok, false);
  assert.equal(verify(body, { ...h, signature: h.signature.slice(0, -2) }).ok, false);
  assert.equal(verify(body, { ...h, signature: 'v2=' + h.signature.slice(3) }).ok, false);
});

console.log('config parsing');
test('BRIDGE_KEYS rejects weak secret, bad uuid, extra fields, duplicates', () => {
  const ok = { id: 'K1', secret: SECRET, church_id: CHURCH, branch_id: null };
  assert.throws(() => parseBridgeKeys(JSON.stringify([{ ...ok, secret: 'short' }])), /key_weak_secret/);
  assert.throws(() => parseBridgeKeys(JSON.stringify([{ ...ok, church_id: 'x' }])), /key_bad_church/);
  assert.throws(() => parseBridgeKeys(JSON.stringify([{ ...ok, role: 'admin' }])), /key_unknown_field/);
  assert.throws(() => parseBridgeKeys(JSON.stringify([ok, ok])), /key_duplicate_id/);
  assert.throws(() => parseBridgeKeys(''), /keys_missing/);
  assert.throws(() => parseBridgeKeys('{'), /keys_not_json/);
});
test('expected host normalised and validated', () => {
  assert.equal(normalizeHost('SHEP.Example.org'), 'shep.example.org');
  assert.equal(normalizeHost('localhost:3000'), 'localhost:3000');
  assert.throws(() => normalizeHost('https://shep.example.org'));
  assert.throws(() => normalizeHost('shep.example.org/path'));
  assert.throws(() => normalizeHost(undefined));
});
test('BRIDGE_ENABLED must be explicitly on', () => {
  assert.equal(isBridgeEnabled({}), false);
  assert.equal(isBridgeEnabled({ BRIDGE_ENABLED: 'off' }), false);
  assert.equal(isBridgeEnabled({ BRIDGE_ENABLED: 'on' }), true);
});
test('loadBridgeConfig defaults and rejects bad cap', () => {
  const env = { BRIDGE_KEYS: JSON.stringify([{ id: 'K1', secret: SECRET, church_id: CHURCH, branch_id: null }]), BRIDGE_EXPECTED_HOST: HOST };
  const c = loadBridgeConfig(env);
  assert.equal(c.dailyCap, 200);
  assert.equal(c.perMinute, 30);
  assert.throws(() => loadBridgeConfig({ ...env, BRIDGE_DAILY_CAP: '-5' }), /daily_cap_invalid/);
});

console.log('schema validation');
const expect422 = (raw, code) => {
  const r = parseEnvelope(raw);
  assert.equal(r.ok, false);
  assert.equal(r.status, 422);
  if (code) assert.equal(r.code, code);
};
test('valid member.join parses', () => {
  const r = parseEnvelope(body);
  assert.equal(r.ok, true);
  assert.equal(r.value.data.full_name, 'Ada Obi');
  assert.equal(r.value.data.email, null);
});
test('malformed JSON → 400', () => assert.deepEqual(parseEnvelope('{'), { ok: false, status: 400, code: 'invalid_json' }));
test('unknown top-level key → 422', () => expect422(envelope('member.join', { full_name: 'Ada', phone: '08030000000' }, { extra: 1 }), 'unknown_key'));
test('__proto__ key → 422', () => expect422(body.replace('{"v":1', '{"__proto__":{"x":1},"v":1'), 'unknown_key'));
test('unknown data key → 422', () => expect422(envelope('member.join', { full_name: 'Ada', phone: '08030000000', role: 'overseer' }), 'unknown_key'));
test('unknown consent key → 422', () => expect422(envelope('member.join', { full_name: 'Ada', phone: '08030000000' }, { consent: { version: '2026-10', at: '2026-10-21T08:59:00Z', x: 1 } }), 'unknown_key'));
test('v must be 1', () => expect422(envelope('member.join', { full_name: 'Ada', phone: '08030000000' }, { v: 2 }), 'unsupported_version'));
test('id must be uuid v4', () => expect422(envelope('member.join', { full_name: 'Ada', phone: '08030000000' }, { id: '11111111-1111-1111-1111-111111111111' }), 'invalid_id'));
test('never-bridged types rejected', () => {
  for (const t of ['youth.join', 'giving', 'testimony', 'newsletter', 'private.question']) expect422(envelope(t, {}), 'unknown_type');
});
test('email or phone required', () => expect422(envelope('member.join', { full_name: 'Ada Obi' }), 'missing_contact'));
test('length caps enforced', () => {
  expect422(envelope('member.join', { full_name: 'A', phone: '08030000000' }), 'invalid_full_name');
  expect422(envelope('member.join', { full_name: 'x'.repeat(121), phone: '08030000000' }), 'invalid_full_name');
  expect422(envelope('member.join', { full_name: 'Ada', phone: '08030000000', note: 'x'.repeat(1001) }), 'invalid_note');
  expect422(envelope('prayer.request', { request: 'x'.repeat(4001) }), 'invalid_request');
  expect422(envelope('care.salvation', { full_name: 'Ada', email: 'a@b.co', city: 'x'.repeat(81) }), 'invalid_city');
});
test('non-string field rejected', () => expect422(envelope('member.join', { full_name: ['Ada'], phone: '08030000000' }), 'invalid_full_name'));
test('bad email / phone rejected', () => {
  expect422(envelope('member.join', { full_name: 'Ada', email: 'not-an-email' }), 'invalid_email');
  expect422(envelope('member.join', { full_name: 'Ada', phone: '<script>' }), 'invalid_phone');
});
test('prayer.request: only request allowed (always anonymous)', () => {
  assert.equal(parseEnvelope(envelope('prayer.request', { request: 'Pray for my family\nplease' })).ok, true);
  expect422(envelope('prayer.request', { request: 'Pray', full_name: 'Ada' }), 'unknown_key');
});
test('sanitisation strips control chars; newlines only in multiline fields', () => {
  const r = parseEnvelope(envelope('care.salvation', { full_name: ' Ada\u0000\u202E Obi\n ', email: 'ADA@Example.COM', note: 'line1\r\nline2\u0007\n\n\n\nline3' }));
  assert.equal(r.ok, true);
  assert.equal(r.value.data.full_name, 'Ada Obi');
  assert.equal(r.value.data.email, 'ada@example.com');
  assert.equal(r.value.data.note, 'line1\nline2\n\nline3');
  assert.equal(cleanText('a\tb\nc', false), 'abc');
});

console.log('volunteer teams / mapping');
test('teams must come from allowlist', () => {
  assert.equal(parseEnvelope(envelope('workforce.volunteer', { full_name: 'Ada', phone: '08030000000', teams: ['Prayer Team', "Children's Ministry"] })).ok, true);
  expect422(envelope('workforce.volunteer', { full_name: 'Ada', phone: '08030000000', teams: ['prayer team'] }), 'invalid_teams');
  expect422(envelope('workforce.volunteer', { full_name: 'Ada', phone: '08030000000', teams: ['Prayer%'] }), 'invalid_teams');
  expect422(envelope('workforce.volunteer', { full_name: 'Ada', phone: '08030000000', teams: new Array(11).fill('Prayer Team') }), 'invalid_teams');
});
test('teams or team_idea required', () => {
  expect422(envelope('workforce.volunteer', { full_name: 'Ada', phone: '08030000000', teams: [] }), 'missing_teams');
  assert.equal(parseEnvelope(envelope('workforce.volunteer', { full_name: 'Ada', phone: '08030000000', team_idea: 'A sign-language team' })).ok, true);
});
test('allowlist has the 10 contract teams', () => assert.equal(TEAM_ALLOWLIST.length, 10));
test('team → department by exact name only', () => {
  const map = parseTeamDepartmentMap(JSON.stringify({ 'Worship & Music': 'Music Department', 'Prayer Team': 'Prayer Department' }));
  const depts = [
    { id: 'd1', name: 'Music Department' },
    { id: 'd2', name: 'Prayer Department' },
    { id: 'd3', name: 'music department' },
    { id: 'd4', name: 'Media & Live Stream' },
    { id: 'd5', name: 'Prayer Department Annex' },
  ];
  assert.deepEqual(mapTeamsToDepartmentIds(['Worship & Music', 'Prayer Team'], map, depts), ['d1', 'd2']);
  assert.deepEqual(mapTeamsToDepartmentIds(['Media & Live Stream'], map, depts), ['d4']); // default: identical name
  assert.deepEqual(mapTeamsToDepartmentIds(['Administration'], map, depts), []);
  assert.throws(() => parseTeamDepartmentMap(JSON.stringify({ 'Choir': 'Music' })), /team_map_unknown_team/);
});

console.log('flush caller');
test('flush request signed per §2 with host from URL', () => {
  const cfg = loadFlushConfig({ BRIDGE_FLUSH_URL: 'https://TCH.Example.org/api/bridge/flush', BRIDGE_FLUSH_KEY_ID: 'F1', BRIDGE_FLUSH_SECRET: SECRET2 });
  const req = buildFlushRequest(cfg, NOW);
  assert.equal(req.body, '{}');
  assert.equal(req.headers['X-Bridge-Timestamp'], String(NOW));
  const expected = signRequest({ secret: SECRET2, path: BRIDGE_FLUSH_PATH, host: 'tch.example.org', ts: String(NOW), keyId: 'F1', body: '{}' });
  assert.equal(req.headers['X-Bridge-Signature'], expected);
  assert.equal(loadFlushConfig({}), null);
  assert.throws(() => loadFlushConfig({ BRIDGE_FLUSH_URL: 'http://tch.example.org/api/bridge/flush', BRIDGE_FLUSH_KEY_ID: 'F1', BRIDGE_FLUSH_SECRET: SECRET2 }), /flush_not_https/);
  assert.throws(() => loadFlushConfig({ BRIDGE_FLUSH_URL: 'https://tch.example.org/other', BRIDGE_FLUSH_KEY_ID: 'F1', BRIDGE_FLUSH_SECRET: SECRET2 }), /flush_bad_path/);
  assert.equal(buildFlushRequest(loadFlushConfig({ BRIDGE_FLUSH_URL: 'https://tch.example.org:8443/api/bridge/flush', BRIDGE_FLUSH_KEY_ID: 'F1', BRIDGE_FLUSH_SECRET: SECRET2 }), NOW).headers['X-Bridge-Signature'],
    signRequest({ secret: SECRET2, path: BRIDGE_FLUSH_PATH, host: 'tch.example.org:8443', ts: String(NOW), keyId: 'F1', body: '{}' }));
});
test('notification text is single-line and truncated', () => {
  assert.equal(notificationSafe('Ada\nObi', 60), 'AdaObi');
  assert.equal(notificationSafe('x'.repeat(100), 10).length, 10);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
