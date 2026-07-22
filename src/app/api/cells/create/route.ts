export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/shepherd_token=([^;]+)/);
  const token = m?.[1];
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return payloadToAuthUser(payload);
}

// Pastor/PA/lead_tech/fellowship_head creating a new cell — structural, no approval
// chain needed (unlike adding a person to the congregation roster).
export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || !['overseer', 'pa', 'lead_tech', 'fellowship_head'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Not authorized to create a cell' } }, { status: 403 });
    }

    const body = await req.json();
    const { name, fellowship_id: bodyFellowshipId, target_size } = body;
    if (!name?.trim()) return NextResponse.json({ data: null, error: { message: 'Cell name is required' } }, { status: 400 });

    // Fellowship heads can only create cells within their own fellowship
    let fellowship_id = bodyFellowshipId || null;
    if (user.role === 'fellowship_head') {
      fellowship_id = user.fellowship_id;
      if (!fellowship_id) return NextResponse.json({ data: null, error: { message: 'No fellowship assigned to your account' } }, { status: 400 });
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/cells`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=representation' },
      body: JSON.stringify({
        name: name.trim(),
        fellowship_id: fellowship_id || null,
        target_size: target_size ? parseInt(target_size) : null,
        is_active: true,
      }),
    });
    const data = await res.json();
    const cell = Array.isArray(data) ? data[0] : data;
    if (!res.ok || !cell?.id) {
      console.error('[POST /api/cells/create]', data);
      return NextResponse.json({ data: null, error: { message: 'Failed to create cell' } }, { status: 500 });
    }
    return NextResponse.json({ data: { cell }, error: null }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/cells/create]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to create cell' } }, { status: 500 });
  }
}
