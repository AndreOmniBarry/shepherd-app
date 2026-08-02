import { NextResponse } from 'next/server';
import { signToken } from '@/lib/auth';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body as { email: string; password: string };

    if (!email || !password) {
      return NextResponse.json(
        { data: null, error: { message: 'Email and password are required', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const normalizedEmail = email.toLowerCase().trim();
    const hdrs = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

    // Step 1: Look up the profile FIRST (by email, before touching Supabase
    // Auth) so a locked-out account is rejected without even attempting a
    // password check — this is what makes the lockout actually throttle a
    // brute-force script instead of just tracking it after the fact.
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(normalizedEmail)}&select=id,email,full_name,role,cell_id,fellowship_id,member_id,branch_id,church_id,is_active,failed_login_attempts,locked_until&limit=1`,
      { headers: hdrs }
    );
    const profiles = await profileRes.json();
    const userProfile = Array.isArray(profiles) ? profiles[0] : null;

    if (userProfile?.locked_until && new Date(userProfile.locked_until).getTime() > Date.now()) {
      const minutesLeft = Math.ceil((new Date(userProfile.locked_until).getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { data: null, error: { message: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`, code: 'ACCOUNT_LOCKED' } },
        { status: 423 }
      );
    }

    // Step 2: Sign in via Supabase Auth REST API directly
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ email: normalizedEmail, password }),
    });

    const authData = await authRes.json();

    if (!authRes.ok || authData.error) {
      // Track the failure against the profile we already found — a
      // fixed 15-minute lock kicks in on the 5th consecutive miss.
      if (userProfile) {
        const attempts = (userProfile.failed_login_attempts || 0) + 1;
        const patch: Record<string, unknown> = { failed_login_attempts: attempts };
        if (attempts >= MAX_ATTEMPTS) patch.locked_until = new Date(Date.now() + LOCKOUT_MS).toISOString();
        fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userProfile.id}`, { method: 'PATCH', headers: hdrs, body: JSON.stringify(patch) }).catch(() => {});
      }
      return NextResponse.json(
        { data: null, error: { message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' } },
        { status: 401 }
      );
    }

    if (!userProfile) {
      return NextResponse.json(
        { data: null, error: { message: 'User profile not found. Contact your administrator.', code: 'PROFILE_NOT_FOUND' } },
        { status: 404 }
      );
    }

    if (!userProfile.is_active) {
      return NextResponse.json(
        { data: null, error: { message: 'Account pending approval.', code: 'ACCOUNT_INACTIVE' } },
        { status: 403 }
      );
    }

    // Successful sign-in — clear any accumulated failure count/lock.
    if (userProfile.failed_login_attempts || userProfile.locked_until) {
      fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userProfile.id}`, { method: 'PATCH', headers: hdrs, body: JSON.stringify({ failed_login_attempts: 0, locked_until: null }) }).catch(() => {});
    }

    const token = await signToken({
      id:           userProfile.id,
      email:        userProfile.email,
      role:         userProfile.role,
      cell_id:      userProfile.cell_id,
      fellowship_id: userProfile.fellowship_id || null,
      member_id:    userProfile.member_id || null,
      branch_id:    userProfile.branch_id || null,
      church_id:    userProfile.church_id || null,
      name:         userProfile.full_name,
    });

    // The token itself is never returned in the response body — only set
    // as an httpOnly cookie. Nothing in the frontend reads it from here;
    // echoing the raw JWT into JSON would just hand a copy to anything
    // that can read the response (or an XSS bug) that could then replay
    // it via an Authorization header for the token's full lifetime,
    // sidestepping the shorter-lived cookie and the app-lock entirely.
    const res = NextResponse.json({
      data: { user: { id: userProfile.id, email: userProfile.email, role: userProfile.role, cell_id: userProfile.cell_id, fellowship_id: userProfile.fellowship_id || null, member_id: userProfile.member_id || null, branch_id: userProfile.branch_id || null, church_id: userProfile.church_id || null, name: userProfile.full_name } },
      error: null,
    });

    res.cookies.set('shepherd_token', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   7200, // 2 hours
      path:     '/',
    });

    return res;

  } catch (err) {
    console.error('[POST /api/auth/login]', err);
    return NextResponse.json(
      { data: null, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
