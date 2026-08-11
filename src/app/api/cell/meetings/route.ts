export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { computeSlaGrade } from '@/lib/sla';

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
}

// Cell leader's own weekly meeting log — separate from Sunday/midweek
// service attendance. GET scopes to the caller's own cell; admins get
// nothing from this route (see /api/cells/all for the cross-cell view).
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || user.role !== 'cell_leader' || !user.cell_id) {
      return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 403 });
    }
    const res = await fetch(`${SURL}/rest/v1/cell_meetings?cell_id=eq.${user.cell_id}&order=meeting_date.desc&limit=52&select=id,meeting_date,meeting_time,location,attendance_count,visitor_count,topic,minutes,sla_grade,created_at`, { headers: H() });
    const meetings = await res.json();
    return NextResponse.json({ data: { meetings: Array.isArray(meetings) ? meetings : [] }, error: null });
  } catch (err) {
    console.error('[GET /api/cell/meetings]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load meetings' } }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || user.role !== 'cell_leader' || !user.cell_id) {
      return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 403 });
    }
    const body = await req.json();
    const { meeting_date, meeting_time, location, attendance_count, visitor_count, topic, minutes } = body;
    if (!meeting_date) return NextResponse.json({ data: null, error: { message: 'meeting_date is required' } }, { status: 400 });

    const createdAt = new Date().toISOString();
    const sla_grade = computeSlaGrade(meeting_date, createdAt);

    const res = await fetch(`${SURL}/rest/v1/cell_meetings`, {
      method: 'POST', headers: { ...H(), Prefer: 'return=representation' },
      body: JSON.stringify({
        cell_id: user.cell_id, meeting_date, meeting_time: meeting_time || null, location: location || null,
        attendance_count: Number(attendance_count) || 0, visitor_count: Number(visitor_count) || 0,
        topic: topic || null, minutes: minutes || null, submitted_by: user.id, sla_grade, created_at: createdAt,
      }),
    });
    const data = await res.json();
    const created = Array.isArray(data) ? data[0] : data;
    if (!created?.id) return NextResponse.json({ data: null, error: { message: 'Failed to save meeting' } }, { status: 500 });

    return NextResponse.json({ data: created, error: null }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/cell/meetings]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to save meeting' } }, { status: 500 });
  }
}
