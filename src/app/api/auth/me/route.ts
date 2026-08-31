import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const match = cookie.match(/shepherd_token=([^;]+)/);
    const token = match?.[1];

    if (!token) {
      return NextResponse.json({ data: null, error: { message: 'Not authenticated' } }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ data: null, error: { message: 'Invalid token' } }, { status: 401 });
    }

    const user = payloadToAuthUser(payload);

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // Fetch full profile to get real full_name
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=id,email,full_name,role,cell_id,department_id&limit=1`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    );
    const profiles = await profileRes.json();
    const profile = Array.isArray(profiles) ? profiles[0] : null;

    let cellName = null;
    if (profile?.cell_id) {
      const cellRes = await fetch(
        `${SUPABASE_URL}/rest/v1/cells?id=eq.${profile.cell_id}&select=name&limit=1`,
        { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
      );
      const cells = await cellRes.json();
      cellName = cells?.[0]?.name || null;
    }

    // Was never fetched here at all — department_head accounts always fell
    // back to a generic name client-side, silently breaking anything that
    // keys off the real department name (e.g. the Protocol/Ushering Events tab).
    let departmentName = null;
    if (profile?.department_id) {
      const deptRes = await fetch(
        `${SUPABASE_URL}/rest/v1/departments?id=eq.${profile.department_id}&select=name&limit=1`,
        { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
      );
      const depts = await deptRes.json();
      departmentName = depts?.[0]?.name || null;
    }

    const fullName = profile?.full_name || user.name || user.email?.split('@')[0] || 'Pastor';

    // For the in-app "It's your birthday!" banner — every login account
    // may be linked to its own membership record (users.member_id) that
    // actually carries date_of_birth; the users table itself has no
    // birthdate column. Never blocks login if the lookup fails.
    let isBirthdayToday = false;
    if (user.member_id) {
      try {
        const memberRes = await fetch(
          `${SUPABASE_URL}/rest/v1/members?id=eq.${user.member_id}&select=date_of_birth&limit=1`,
          { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
        );
        const memberRows = await memberRes.json();
        const dob: string | null = memberRows?.[0]?.date_of_birth || null;
        if (dob) {
          const [, bmStr, bdStr] = dob.split('-');
          const today = new Date();
          isBirthdayToday = parseInt(bmStr, 10) - 1 === today.getMonth() && parseInt(bdStr, 10) === today.getDate();
        }
      } catch { /* default to false — never blocks login */ }
    }

    let currency = 'NGN';
    try {
      const configRes = await fetch(
        `${SUPABASE_URL}/rest/v1/church_config?church_id=eq.${user.church_id}&order=created_at.asc&limit=1&select=currency`,
        { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
      );
      const configs = await configRes.json();
      currency = (Array.isArray(configs) && configs[0]?.currency) || 'NGN';
    } catch { /* default to NGN if config lookup fails — never blocks login */ }

    return NextResponse.json({
      data: { ...user, name: fullName, cell_name: cellName, department_name: departmentName, currency, is_birthday_today: isBirthdayToday },
      error: null,
    });
  } catch (err) {
    console.error('[GET /api/auth/me]', err);
    return NextResponse.json({ data: null, error: { message: 'Internal error' } }, { status: 500 });
  }
}
