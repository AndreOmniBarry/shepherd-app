export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser, signToken } from '@/lib/auth';
import type { Role } from '@/types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  const m = req.headers.get('cookie')?.match(/shepherd_token=([^;]+)/);
  if (!m) return null;
  const p = await verifyToken(m[1]);
  return p ? payloadToAuthUser(p) : null;
}

const PORTAL_PATH: Record<string, string> = {
  cell_leader: '/cell', fellowship_head: '/fellowship', department_head: '/department',
  care_team: '/care', accounts: '/accounts', partnership: '/partnership',
};

// Fixed demo-account ids (not tied to any real leader) so every portal's
// server-side "look up my department_id/cell_id/fellowship_id from the users
// table" pattern works out of the box, without needing anyone's password.
// Reused/overwritten on every call rather than piling up rows.
const DEMO_ID: Record<string, string> = {
  cell_leader:      '00000000-0000-0000-0000-0000000000d1',
  fellowship_head:  '00000000-0000-0000-0000-0000000000d2',
  department_head:  '00000000-0000-0000-0000-0000000000d3',
  care_team:        '00000000-0000-0000-0000-0000000000d4',
  accounts:         '00000000-0000-0000-0000-0000000000d5',
  partnership:      '00000000-0000-0000-0000-0000000000d6',
};

// Lets overseer/pa/lead_tech preview any scoped portal exactly as that role
// would see it, using a real existing cell/fellowship/department for genuine
// data — without needing that person's actual login. For demoing progress to
// a mentor/stakeholder without pestering leaders for their passwords.
export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || !['overseer', 'pa', 'lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Only the pastor or church admin can preview other portals' } }, { status: 403 });
    }

    const { role, ref_id, ref_name } = await req.json() as { role: Role; ref_id?: string; ref_name?: string };
    const demoId = DEMO_ID[role];
    if (!demoId) return NextResponse.json({ data: null, error: { message: 'Cannot preview this role' } }, { status: 400 });

    const label = `DEMO — ${role.replace('_', ' ')}${ref_name ? ` (${ref_name})` : ''}`;
    const row: Record<string, unknown> = {
      id: demoId, full_name: label, email: `demo.${role}@shepherd.app`, role, is_active: true,
      cell_id: role === 'cell_leader' ? (ref_id || null) : null,
      fellowship_id: role === 'fellowship_head' ? (ref_id || null) : null,
      department_id: role === 'department_head' ? (ref_id || null) : null,
    };
    await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: 'POST', headers: { ...hdrs(), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(row),
    });

    const demoToken = await signToken({
      id: demoId, email: row.email as string, role,
      cell_id: (row.cell_id as string) || null, fellowship_id: (row.fellowship_id as string) || null,
      name: label,
    });

    const res = NextResponse.json({ data: { path: PORTAL_PATH[role] || '/dashboard', label }, error: null });

    // Stash the admin's real token so "exit preview" can restore it — only if
    // we're not already mid-preview (don't overwrite it when switching demo
    // roles back-to-back).
    const cookieHeader = req.headers.get('cookie') || '';
    if (!/shepherd_admin_token=/.test(cookieHeader)) {
      const realToken = cookieHeader.match(/shepherd_token=([^;]+)/)?.[1];
      if (realToken) {
        res.cookies.set('shepherd_admin_token', realToken, {
          httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7200, path: '/',
        });
      }
    }
    res.cookies.set('shepherd_token', demoToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7200, path: '/',
    });

    return res;
  } catch (err) {
    console.error('[POST /api/admin/impersonate]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to start preview' } }, { status: 500 });
  }
}
