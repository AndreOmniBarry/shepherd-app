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

// Accept/decline (by the recipient) or cancel (by the requester). Whoever
// isn't acting gets notified of the outcome.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const { status } = await req.json();
    if (!['accepted', 'declined', 'cancelled'].includes(status)) {
      return NextResponse.json({ data: null, error: { message: 'status must be accepted, declined, or cancelled' } }, { status: 400 });
    }

    const existingRes = await fetch(`${SURL}/rest/v1/meeting_requests?id=eq.${id}&select=id,requested_by,requested_of,subject,status`, { headers: H() });
    const existing = await existingRes.json();
    const row = Array.isArray(existing) ? existing[0] : null;
    if (!row) return NextResponse.json({ data: null, error: { message: 'Meeting request not found' } }, { status: 404 });

    const isRecipient = row.requested_of === user.id;
    const isRequester = row.requested_by === user.id;
    if (status === 'cancelled' && !isRequester) {
      return NextResponse.json({ data: null, error: { message: 'Only the requester can cancel' } }, { status: 403 });
    }
    if ((status === 'accepted' || status === 'declined') && !isRecipient) {
      return NextResponse.json({ data: null, error: { message: 'Only the recipient can accept or decline' } }, { status: 403 });
    }

    const updateRes = await fetch(`${SURL}/rest/v1/meeting_requests?id=eq.${id}`, {
      method: 'PATCH', headers: { ...H(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status, responded_at: new Date().toISOString() }),
    });
    if (!updateRes.ok) return NextResponse.json({ data: null, error: { message: 'Failed to update meeting request' } }, { status: 502 });

    const notifyUserId = status === 'cancelled' ? row.requested_of : row.requested_by;
    const statusLabel = status === 'accepted' ? 'accepted' : status === 'declined' ? 'declined' : 'cancelled';
    await fetch(`${SURL}/rest/v1/notifications`, {
      method: 'POST', headers: { ...H(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        user_id: notifyUserId, type: 'meeting_request', read: false,
        title: `Meeting request ${statusLabel}`, body: `"${row.subject}" was ${statusLabel} by ${user.name || 'the other party'}.`,
        link: '/church-center?tab=meetings',
      }),
    }).catch(() => {});

    return NextResponse.json({ data: { updated: true }, error: null });
  } catch (err) {
    console.error('[PATCH /api/meeting-requests/[id]]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to update meeting request' } }, { status: 500 });
  }
}
