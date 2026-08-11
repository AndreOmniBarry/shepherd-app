export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { notifyUsers } from '@/lib/notify';

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
}

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const { requested_of, subject, message, proposed_time } = await req.json();
    if (!requested_of || !subject?.trim()) {
      return NextResponse.json({ data: null, error: { message: 'requested_of and subject are required' } }, { status: 400 });
    }

    // requested_of is a client-supplied user id — verify it actually
    // belongs to this caller's own church before creating the request or
    // notifying them, otherwise anyone could target a user id from another
    // church entirely (cross-tenant messaging/spam).
    const targetRes = await fetch(`${SURL}/rest/v1/users?id=eq.${requested_of}&church_id=eq.${user.church_id}&select=id&limit=1`, { headers: H() });
    const targetRows = await targetRes.json().catch(() => []);
    if (!Array.isArray(targetRows) || targetRows.length === 0) {
      return NextResponse.json({ data: null, error: { message: 'That person was not found in your church' } }, { status: 404 });
    }

    const insertRes = await fetch(`${SURL}/rest/v1/meeting_requests`, {
      method: 'POST',
      headers: { ...H(), 'Prefer': 'return=representation' },
      body: JSON.stringify({
        branch_id: user.branch_id || null,
        church_id: user.church_id || null,
        requested_by: user.id,
        requested_of,
        subject: subject.trim(),
        message: message?.trim() || null,
        proposed_time: proposed_time || null,
      }),
    });
    if (!insertRes.ok) {
      const err = await insertRes.text();
      console.error('[POST /api/meeting-requests] insert failed:', insertRes.status, err);
      return NextResponse.json({ data: null, error: { message: 'Failed to create meeting request' } }, { status: 502 });
    }
    const inserted = await insertRes.json();

    await notifyUsers([requested_of], {
      type: 'meeting_request',
      title: 'New meeting request',
      body: `${user.name || 'Someone'} requested a meeting: ${subject.trim()}`,
      link: '/church-center?tab=meetings',
    }, user.church_id);

    return NextResponse.json({ data: Array.isArray(inserted) ? inserted[0] : inserted, error: null }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/meeting-requests]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to create meeting request' } }, { status: 500 });
  }
}
