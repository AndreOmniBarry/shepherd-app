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

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'open';
    // Only select columns that definitely exist in the original table
    let url = `${SURL}/rest/v1/prayer_requests?order=created_at.desc&limit=100&select=id,request,requester_name,status,created_at`;
    if (status !== 'all') url += `&status=eq.${status}`;
    const res = await fetch(url, { headers: H() });
    const requests = await res.json();
    return NextResponse.json({ data: { requests: Array.isArray(requests) ? requests : [] }, error: null });
  } catch { return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const { request, requester_name } = await req.json();
    if (!request?.trim()) return NextResponse.json({ data: null, error: { message: 'Prayer request text required' } }, { status: 400 });

    // Mirror income_records pattern exactly - no CHECK constraints
    const prRes = await fetch(`${SURL}/rest/v1/prayer_requests`, {
      method: 'POST',
      headers: { ...H(), 'Prefer': 'return=representation' },
      body: JSON.stringify({
        request: request.trim(),
        requester_name: requester_name || user.name || 'Anonymous',
        status: 'open',
      }),
    });
    const prData = await prRes.json();
    const prayerReq = Array.isArray(prData) ? prData[0] : prData;

    // Notify pastor and PA regardless of insert result
    for (const role of ['overseer', 'pa']) {
      const usersRes = await fetch(`${SURL}/rest/v1/users?role=eq.${role}&select=id`, { headers: H() });
      const roleUsers = await usersRes.json();
      if (Array.isArray(roleUsers) && roleUsers.length > 0) {
        await fetch(`${SURL}/rest/v1/notifications`, {
          method: 'POST',
          headers: { ...H(), 'Prefer': 'return=minimal' },
          body: JSON.stringify(roleUsers.map((u: { id: string }) => ({
            user_id: u.id,
            type: 'prayer',
            read: false,
            title: 'New prayer request',
            body: `${requester_name || user.name || 'A member'}: "${request.trim().slice(0, 100)}"`,
          }))),
        }).catch(() => {});
      }
    }

    return NextResponse.json({ data: { prayer_request: prayerReq }, error: null }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ data: null, error: { message: 'Failed to submit' } }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const { id, status } = await req.json();
    await fetch(`${SURL}/rest/v1/prayer_requests?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...H(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status }),
    });
    return NextResponse.json({ data: { updated: true }, error: null });
  } catch { return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 }); }
}
