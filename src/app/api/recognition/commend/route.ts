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

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    if (!['overseer', 'pa', 'lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Not authorized' } }, { status: 403 });
    }

    const { leader_id, commendation, category } = await req.json();
    if (!leader_id || !commendation?.trim()) {
      return NextResponse.json({ data: null, error: { message: 'leader_id and commendation are required' } }, { status: 400 });
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        user_id: leader_id,
        type: 'commendation',
        read: false,
        title: '🏆 You have been commended!',
        body: commendation.trim(),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[POST /api/recognition/commend]', err);
      return NextResponse.json({ data: null, error: { message: 'Failed to send commendation' } }, { status: 502 });
    }

    return NextResponse.json({ data: { sent: true, category: category || null }, error: null }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/recognition/commend]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to send commendation' } }, { status: 500 });
  }
}
