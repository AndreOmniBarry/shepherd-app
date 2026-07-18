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

async function getOverseerIds(): Promise<string[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/users?role=in.(overseer,pa,lead_tech)&select=id`,
    { headers: hdrs() }
  );
  const data = await res.json();
  return Array.isArray(data) ? data.map((u: Record<string,string>) => u.id) : [];
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'open';

    let url = `${SUPABASE_URL}/rest/v1/prayer_requests?order=created_at.desc&limit=50&select=id,request,requester_name,category,status,is_anonymous,submitted_by,submitted_by_role,created_at`;
    if (status !== 'all') url += `&status=eq.${status}`;

    // Non-overseer roles only see their own submissions
    if (!['overseer', 'pa', 'lead_tech'].includes(user.role)) {
      url += `&submitted_by=eq.${user.id}`;
    }

    const res = await fetch(url, { headers: hdrs() });
    const data = await res.json();
    return NextResponse.json({ data: { requests: Array.isArray(data) ? data : [] }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to load prayer requests' } }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const body = await req.json();
    const { request, requester_name, category, is_anonymous } = body;

    if (!request) return NextResponse.json({ data: null, error: { message: 'Prayer request text is required' } }, { status: 400 });

    const res = await fetch(`${SUPABASE_URL}/rest/v1/prayer_requests`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=representation' },
      body: JSON.stringify({
        request,
        requester_name: is_anonymous ? 'Anonymous' : (requester_name || user.name || 'Unknown'),
        category: category || 'general',
        is_anonymous: is_anonymous || false,
        status: 'open',
        submitted_by: user.id,
      }),
    });
    const data = await res.json();

    // Notify all overseers/PAs - best effort, don't break main flow
    try {
      const overseerIds = await getOverseerIds();
      if (overseerIds.length > 0) {
        await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
          method: 'POST',
          headers: { ...hdrs(), 'Prefer': 'return=minimal' },
          body: JSON.stringify(overseerIds.map(uid => ({
            user_id: uid,
            type: 'pastoral',
            title: 'New prayer request',
            body: `${is_anonymous ? 'Anonymous' : requester_name || user.name || 'A member'} — ${request.slice(0, 80)}${request.length > 80 ? '...' : ''}`,
            read: false,
          }))),
        });
      }
    } catch (notifyErr) {
      console.error('Prayer notify error (non-fatal):', notifyErr);
    }

    return NextResponse.json({ data: Array.isArray(data) ? data[0] : data, error: null }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to submit prayer request' } }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    if (!['overseer', 'pa', 'lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Not authorized' } }, { status: 403 });
    }

    const body = await req.json();
    const { id, status } = body;

    await fetch(`${SUPABASE_URL}/rest/v1/prayer_requests?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...hdrs(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
    });

    return NextResponse.json({ data: { updated: true }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to update' } }, { status: 500 });
  }
}
