export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { listMentionGroups } from '@/lib/mention-groups';

async function getUser(req: Request) {
  return getAuthUser(req);
}

// Suggestion list only, for composer autocomplete (chat + church feed).
// Purely advisory — the actual notification fan-out re-resolves every
// @tag from scratch, server-side, at message/post send time, so this
// endpoint returning a stale or even tampered list can never widen who
// gets notified.
export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const groups = await listMentionGroups({ id: user.id, role: user.role, church_id: user.church_id, branch_id: user.branch_id });
  return NextResponse.json({ data: { groups }, error: null });
}
