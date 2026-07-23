import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { assignToLeastLoadedCareTeamMember } from '@/lib/care-assignment';

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
    `${SUPABASE_URL}/rest/v1/users?role=in.(overseer,pa)&select=id`,
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
    const all = searchParams.get('all') === 'true';

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);

    // Overseer/PA can see all; care team sees recent
    const isAdmin = ['overseer', 'pa', 'lead_tech'].includes(user.role);
    const select = 'id,full_name,phone,address,occupation,date_of_birth,how_they_came,would_join,volunteer_interest,prayer_point,service_date,status,notes,assigned_to,cell_id,completed_member_class,outcome,sla_grade,created_at';
    let url = `${SUPABASE_URL}/rest/v1/first_timers?order=created_at.desc&limit=200&select=${select}`;
    if (!isAdmin || !all) {
      url += `&service_date=gte.${cutoff.toISOString().split('T')[0]}`;
    }
    if (!isAdmin) {
      url += `&assigned_to=eq.${user.id}`;
    }

    const res = await fetch(url, { headers: hdrs() });
    const data = await res.json();
    return NextResponse.json({ data: { first_timers: Array.isArray(data) ? data : [] }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to load first timers' } }, { status: 500 });
  }
}

// Full first-timer card — mirrors the physical card used in service: name,
// address, occupation, DOB, how they were invited, whether they'd join,
// volunteer interest, prayer point. Auto-assigned to whichever care team
// member currently has the lightest load, not whoever is typing it in — one
// person can log a stack of cards after a service without dumping all the
// follow-up on themselves.
export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const body = await req.json();
    const { full_name, phone, address, occupation, date_of_birth, how_they_came, would_join, volunteer_interest, prayer_point, notes, service_date, cell_id } = body;

    if (!full_name || !phone) {
      return NextResponse.json({ data: null, error: { message: 'Name and phone are required' } }, { status: 400 });
    }

    const assignedTo = (await assignToLeastLoadedCareTeamMember(SUPABASE_URL, hdrs())) || user.id;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/first_timers`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=representation' },
      body: JSON.stringify({
        full_name, phone,
        address: address || null,
        occupation: occupation || null,
        date_of_birth: date_of_birth || null,
        how_they_came: how_they_came || 'walk_in',
        would_join: would_join || null,
        volunteer_interest: volunteer_interest || null,
        prayer_point: prayer_point || null,
        notes: notes || null,
        service_date: service_date || new Date().toISOString().split('T')[0],
        cell_id: cell_id || null,
        assigned_to: assignedTo,
        status: 'new',
      }),
    });
    const data = await res.json();
    const created = Array.isArray(data) ? data[0] : data;

    // Notify overseers/PAs about new first timer - best effort
    try {
      const overseerIds = await getOverseerIds();
      if (overseerIds.length > 0) {
        await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
          method: 'POST',
          headers: { ...hdrs(), 'Prefer': 'return=minimal' },
          body: JSON.stringify(overseerIds.map(uid => ({
            user_id: uid,
            type: 'pipeline',
            title: 'New first timer logged',
            body: `${full_name} (${phone}) — logged by care team`,
            read: false,
          }))),
        });
      }
    } catch (e) { console.error('First timer notify error (non-fatal):', e); }

    // Prayer point — route to the Prayer department head + admins in
    // near-real-time (same notification pipeline everything else uses).
    if (prayer_point?.trim()) {
      try {
        const prayerDeptRes = await fetch(`${SUPABASE_URL}/rest/v1/departments?name=ilike.*prayer*&select=id&limit=1`, { headers: hdrs() });
        const prayerDept = (await prayerDeptRes.json())?.[0];
        const recipients: string[] = [];
        if (prayerDept?.id) {
          const headsRes = await fetch(`${SUPABASE_URL}/rest/v1/users?department_id=eq.${prayerDept.id}&role=eq.department_head&select=id`, { headers: hdrs() });
          const heads = await headsRes.json();
          if (Array.isArray(heads)) recipients.push(...heads.map((u: { id: string }) => u.id));
        }
        const adminRes = await fetch(`${SUPABASE_URL}/rest/v1/users?role=in.(overseer,pa,lead_tech)&select=id`, { headers: hdrs() });
        const adminData = await adminRes.json();
        if (Array.isArray(adminData)) recipients.push(...adminData.map((u: { id: string }) => u.id));

        const unique = [...new Set(recipients)];
        if (unique.length > 0) {
          await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
            method: 'POST', headers: { ...hdrs(), Prefer: 'return=minimal' },
            body: JSON.stringify(unique.map(uid => ({
              user_id: uid, type: 'pastoral', read: false,
              title: `Prayer point — ${full_name}`,
              body: prayer_point.trim(),
              link: '/care',
            }))),
          });
        }
      } catch (e) { console.error('Prayer point routing error (non-fatal):', e); }
    }

    return NextResponse.json({ data: created, error: null }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to add first timer' } }, { status: 500 });
  }
}
