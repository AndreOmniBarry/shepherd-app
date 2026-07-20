export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { signToken } from '@/lib/auth';

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

    // Step 1: Sign in via Supabase Auth REST API directly
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
      return NextResponse.json(
        { data: null, error: { message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' } },
        { status: 401 }
      );
    }

    // Step 2: Fetch user profile via REST directly
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(normalizedEmail)}&select=id,email,full_name,role,cell_id,fellowship_id,is_active&limit=1`,
      {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const profiles = await profileRes.json();
    const userProfile = Array.isArray(profiles) ? profiles[0] : null;

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

    const token = await signToken({
      id:           userProfile.id,
      email:        userProfile.email,
      role:         userProfile.role,
      cell_id:      userProfile.cell_id,
      fellowship_id: userProfile.fellowship_id || null,
      name:         userProfile.full_name,
    });

    const res = NextResponse.json({
      data: { token, user: { id: userProfile.id, email: userProfile.email, role: userProfile.role, cell_id: userProfile.cell_id, fellowship_id: userProfile.fellowship_id || null, name: userProfile.full_name } },
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
