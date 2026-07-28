export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  const m = req.headers.get('cookie')?.match(/shepherd_token=([^;]+)/);
  if (!m) return null;
  const p = await verifyToken(m[1]);
  return p ? payloadToAuthUser(p) : null;
}

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || !['overseer', 'pa', 'lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }
    const { name } = await req.json();
    if (!name?.trim()) return NextResponse.json({ data: null, error: { message: 'Department name is required' } }, { status: 400 });

    const res = await fetch(`${SURL}/rest/v1/departments`, {
      method: 'POST', headers: { ...H(), Prefer: 'return=representation' },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json();
    const department = Array.isArray(data) ? data[0] : data;
    if (!department?.id) return NextResponse.json({ data: null, error: { message: 'Failed to create department' } }, { status: 500 });
    return NextResponse.json({ data: { department }, error: null }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/admin/departments/create]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to create department' } }, { status: 500 });
  }
}
