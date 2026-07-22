#!/usr/bin/env node
// One-time script: creates Supabase Auth + public.users accounts for every
// leader in scripts/leaders_for_accounts.json (generated from the Grace Dome
// Excel export by scripts/generate_import.py).
//
// MUST run AFTER scripts/12_import_grace_dome_data.sql has been executed in
// the Supabase SQL editor (fellowships/cells/departments must already exist
// so this script can look up their ids by name).
//
// Usage:  node scripts/create-leader-accounts.mjs
// Reads SUPABASE credentials from .env.local in the project root.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

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

function genPassword() {
  return 'Shep' + Math.random().toString(36).slice(2, 8) + '!' + Math.floor(Math.random() * 90 + 10);
}

async function findRefId(kind, name) {
  if (!kind || !name) return null;
  const table = kind === 'fellowship' ? 'fellowships' : kind === 'cell' ? 'cells' : 'departments';
  const data = await rest(`${table}?name=eq.${encodeURIComponent(name)}&select=id&limit=1`);
  return Array.isArray(data) && data[0] ? data[0].id : null;
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

  const results = [];
  for (const l of leaders) {
    const password = genPassword();

    // Does an auth user with this email already exist?
    const existingUsersRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(l.email)}`, { headers: hdrs() });
    const existingUsers = await existingUsersRes.json();
    let userId = existingUsers?.users?.[0]?.id;
    let created = false;

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

    results.push({ ...l, status: created ? 'CREATED' : 'EXISTED (role updated)', password: created ? password : '(unchanged — account pre-existed)', refId });
  }

  const lines = ['name,email,role,linked_to,temp_password,status'];
  for (const r of results) {
    lines.push([r.name, r.email, r.role, r.ref_name || '', r.password || '', r.status].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
  }
  const outPath = path.join(root, 'scripts/leader_accounts_output.csv');
  fs.writeFileSync(outPath, lines.join('\n'));

  console.log(`\nDone. ${results.filter(r => r.status === 'CREATED').length} created, ${results.filter(r => r.status.startsWith('EXISTED')).length} already existed, ${results.filter(r => r.status === 'FAILED').length} failed.`);
  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length} duplicate email(s) (same person listed under multiple roles — kept their first-listed role):`);
    skipped.forEach(s => console.log(`  - ${s.name} <${s.email}> also listed as ${s.role}`));
  }
  console.log(`\nFull results with temporary passwords written to: scripts/leader_accounts_output.csv`);
  console.log('Send each person their email + temp password securely (not over an open channel) and have them change it on first login.');
}

main().catch(err => { console.error(err); process.exit(1); });
