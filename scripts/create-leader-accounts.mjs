#!/usr/bin/env node
// One-time script: creates Supabase Auth + public.users accounts for every
// leader in scripts/leaders_for_accounts.json (generated from the Grace Dome
// Excel export by scripts/generate_import.py).
//
// MUST run AFTER scripts/12_import_grace_dome_data.sql has been executed in
// the Supabase SQL editor (fellowships/cells/departments must already exist
// so this script can look up their ids by name).
//
// Usage:
//   node scripts/create-leader-accounts.mjs            (create-only; leaves
//                                                        existing accounts'
//                                                        passwords untouched)
//   node scripts/create-leader-accounts.mjs --reset     (also resets the
//                                                        password for accounts
//                                                        that already existed,
//                                                        so the output CSV has
//                                                        a real temp password
//                                                        for every leader —
//                                                        safe pre-launch,
//                                                        before anyone has
//                                                        logged in and changed
//                                                        their own password)
//
// Reads SUPABASE credentials from .env.local in the project root.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const RESET = process.argv.includes('--reset');

function loadEnvLocal() {
  const envPath = path.join(root, '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('.env.local not found at project root — cannot read Supabase credentials.');
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  const env = {};
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = loadEnvLocal();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY || SUPABASE_URL.includes('your-supabase-url')) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing or still placeholders in .env.local');
  process.exit(1);
}

const hdrs = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function rest(pathAndQuery) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, { headers: hdrs() });
  return res.json();
}

// Default temp password shape: "Shep" + 6 random base36 chars + "!" + 2 digits
// e.g. Shep4k9d2q!57 — long enough to be safe, easy to read/type off a screenshot.
function genPassword() {
  return 'Shep' + Math.random().toString(36).slice(2, 8) + '!' + Math.floor(Math.random() * 90 + 10);
}

async function findRefId(kind, name) {
  if (!kind || !name) return null;
  const table = kind === 'fellowship' ? 'fellowships' : kind === 'cell' ? 'cells' : 'departments';
  const data = await rest(`${table}?name=eq.${encodeURIComponent(name)}&select=id&limit=1`);
  return Array.isArray(data) && data[0] ? data[0].id : null;
}

// Admin & Overseer roles get their own CSV section, listed first, overseer on top.
const ADMIN_ROLE_ORDER = ['overseer', 'pa', 'lead_tech', 'accounts', 'partnership'];
const GENERAL_ROLE_ORDER = ['fellowship_head', 'department_head', 'cell_leader'];
function roleRank(role) {
  const i = ADMIN_ROLE_ORDER.indexOf(role);
  if (i !== -1) return i;
  const j = GENERAL_ROLE_ORDER.indexOf(role);
  return j !== -1 ? 100 + j : 200;
}

async function main() {
  const leadersRaw = JSON.parse(fs.readFileSync(path.join(root, 'scripts/leaders_for_accounts.json'), 'utf8'));

  // Dedupe by email — same person can appear in multiple sheets (e.g. a Tech
  // who is also a Cell Leader). First occurrence wins; report the rest.
  const seen = new Map();
  const skipped = [];
  for (const l of leadersRaw) {
    if (seen.has(l.email)) skipped.push(l);
    else seen.set(l.email, l);
  }
  const leaders = [...seen.values()];

  // Supabase's admin "list users" endpoint does NOT reliably support an
  // ?email= filter — passing one silently returns an arbitrary page of ALL
  // users instead of a filtered match. Build one authoritative email→id map
  // up front by paging through every user, instead of trusting that filter
  // per-leader (which was quietly resetting/re-profiling the wrong account).
  const emailToId = new Map();
  for (let page = 1; ; page++) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers: hdrs() });
    const data = await res.json();
    const pageUsers = data?.users || [];
    for (const u of pageUsers) if (u.email) emailToId.set(u.email.toLowerCase(), u.id);
    if (pageUsers.length < 1000) break;
  }

  const results = [];
  for (const l of leaders) {
    const password = genPassword();

    let userId = emailToId.get(l.email.toLowerCase());
    let created = false;
    let passwordSet = false;

    if (!userId) {
      const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST', headers: hdrs(),
        body: JSON.stringify({ email: l.email, password, email_confirm: true, user_metadata: { full_name: l.name, role: l.role } }),
      });
      const authData = await authRes.json();
      if (!authRes.ok || !authData.id) {
        results.push({ ...l, status: 'FAILED', error: authData.msg || JSON.stringify(authData) });
        continue;
      }
      userId = authData.id;
      created = true;
      passwordSet = true;
    } else if (RESET) {
      const resetRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT', headers: hdrs(), body: JSON.stringify({ password }),
      });
      passwordSet = resetRes.ok;
    }

    const refId = await findRefId(l.ref_kind, l.ref_name);
    const row = {
      id: userId, full_name: l.name, email: l.email, role: l.role, is_active: true,
      fellowship_id: l.ref_kind === 'fellowship' ? refId : null,
      cell_id: l.ref_kind === 'cell' ? refId : null,
      department_id: l.ref_kind === 'department' ? refId : null,
    };
    await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: 'POST',
      headers: { ...hdrs(), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(row),
    });

    const status = created ? 'CREATED' : (passwordSet ? 'EXISTED (password reset)' : 'EXISTED (role updated)');
    results.push({ ...l, status, password: passwordSet ? password : '(unchanged — run with --reset to issue a new one)', refId });
  }

  // Group: Admin & Overseer first, then Ministry Leaders — each sorted by
  // role hierarchy, then alphabetically by name within the same role.
  const sorted = [...results].sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.name.localeCompare(b.name));
  const admin = sorted.filter(r => ADMIN_ROLE_ORDER.includes(r.role));
  const general = sorted.filter(r => !ADMIN_ROLE_ORDER.includes(r.role));

  const csvRow = r => [r.name, r.email, r.role, r.ref_name || '', r.password || '', r.status]
    .map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',');

  const lines = ['name,email,role,linked_to,temp_password,status'];
  lines.push('"=== ADMIN & OVERSEER ==="');
  admin.forEach(r => lines.push(csvRow(r)));
  lines.push('');
  lines.push('"=== MINISTRY LEADERS ==="');
  general.forEach(r => lines.push(csvRow(r)));

  const outPath = path.join(root, 'scripts/leader_accounts_output.csv');
  fs.writeFileSync(outPath, lines.join('\n'));

  console.log(`\nDone. ${results.filter(r => r.status === 'CREATED').length} created, ${results.filter(r => r.status.startsWith('EXISTED')).length} already existed, ${results.filter(r => r.status === 'FAILED').length} failed.`);
  if (!RESET) console.log('(Existing accounts kept their current password — re-run with --reset to also issue new temp passwords for them.)');
  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length} duplicate email(s) (same person listed under multiple roles — kept their first-listed role):`);
    skipped.forEach(s => console.log(`  - ${s.name} <${s.email}> also listed as ${s.role}`));
  }
  console.log(`\nFull results with temporary passwords written to: scripts/leader_accounts_output.csv`);
  console.log('Send each person their email + temp password securely (not over an open channel) and have them change it on first login.');
}

main().catch(err => { console.error(err); process.exit(1); });
