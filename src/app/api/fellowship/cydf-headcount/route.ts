import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

const CYDF_FELLOWSHIP_ID = 'cb72d6c2-a206-45b9-895c-a26d705d2367';

function calcSLA(submittedAt: Date): string {
  const day = submittedAt.getDay();
  const hour = submittedAt.getHours();
  if (day === 0) return 'A+';
  if (day === 1 && hour < 6) return 'A';
  if (day === 1) return 'B';
  if (day === 2) return 'C';
  if (day === 3) return 'D';
  if (day === 4 || day === 5) return 'F';
  return 'F-';
}

async function getUser(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/shepherd_token=([^;]+)/);
  const token = m?.[1];
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return payloadToAuthUser(payload);
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    // Get last 8 weeks of CYDF headcounts
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 56);

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/cydf_headcount?fellowship_id=eq.${CYDF_FELLOWSHIP_ID}&submitted_at=gte.${cutoff.toISOString()}&order=submitted_at.desc&limit=12&select=id,children_count,teenagers_count,submitted_at,sla_grade,notes,services(service_date)`,
      { headers: hdrs() }
    );
    const data = await res.json();

    // Get upcoming services
    const today = new Date().toISOString().split('T')[0];
    const servicesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/services?service_date=lte.${today}&service_number=eq.1&order=service_date.desc&limit=8&select=id,service_date`,
      { headers: hdrs() }
    );
    const services = await servicesRes.json();

    return NextResponse.json({
      data: {
        history: Array.isArray(data) ? data : [],
        services: Array.isArray(services) ? services : [],
      },
      error: null,
    });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to load' } }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const body = await req.json();
    const { service_id, children_count, teenagers_count, notes } = body;

    if (!service_id) return NextResponse.json({ data: null, error: { message: 'Service is required' } }, { status: 400 });

    const submittedAt = new Date();
    const sla_grade = calcSLA(submittedAt);

    const res = await fetch(`${SUPABASE_URL}/rest/v1/cydf_headcount`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        service_id,
        fellowship_id: CYDF_FELLOWSHIP_ID,
        children_count: parseInt(children_count) || 0,
        teenagers_count: parseInt(teenagers_count) || 0,
        submitted_by: user.id,
        sla_grade,
        notes: notes || null,
        submitted_at: submittedAt.toISOString(),
      }),
    });
    const data = await res.json();

    // Notify pastor and PA
    await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=minimal' },
      body: JSON.stringify([{
        user_id: user.id,
        type: 'attendance',
        title: 'CYDF attendance submitted',
        body: `Children: ${children_count || 0} · Teenagers: ${teenagers_count || 0} · SLA: ${sla_grade}`,
        read: false,
      }]),
    });

    return NextResponse.json({ data: Array.isArray(data) ? data[0] : data, error: null }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to submit' } }, { status: 500 });
  }
}
