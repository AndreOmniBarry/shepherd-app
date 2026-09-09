// POST /api/auth/signup
//
// The founding-admin signup at the end of the /setup onboarding wizard.
// Distinct from /api/auth/register (an invited member joining a cell of
// a church that already exists) — this route has no church yet. It
// creates a Supabase Auth user + a users table row (role 'overseer',
// church_id null, is_active TRUE immediately — there's no one else to
// approve the founder of a church that doesn't exist yet), then signs and
// sets the session cookie the same way /api/auth/login does, so the very
// next request (PATCH /api/settings/church-config, which /setup already
// calls on completion) is authenticated and bootstraps the church for
// this user. See src/app/api/settings/church-config/route.ts's
// bootstrapChurch() for that side.
//
// Before this route existed, the only way to get a users row with
// church_id = null (the precondition bootstrapChurch checks for) was to
// insert one by hand in Supabase Studio — so /setup's final submit
// unconditionally 401'd for every real new visitor. This is the missing
// front door.

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { signToken } from '@/lib/auth';
import type { SignupRequest } from '@/types';

export async function POST(req: Request) {
  try {
    const body = await req.json() as SignupRequest;
    const { email, password, full_name } = body;

    if (!email || !password || !full_name) {
      return NextResponse.json(
        { data: null, error: { message: 'All fields are required', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { data: null, error: { message: 'Password must be at least 8 characters', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const sb = createServerClient();

    // Same existing-email check as /api/auth/register — this is checked
    // again inside auth.admin.createUser below too, but that error message
    // is Supabase's generic one; checking our own table first gives the
    // same friendly EMAIL_TAKEN result register already uses.
    const { data: existing } = await sb
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .single();

    if (existing) {
      return NextResponse.json(
        { data: null, error: { message: 'An account with this email already exists. Log in instead.', code: 'EMAIL_TAKEN' } },
        { status: 409 }
      );
    }

    const { data: authUser, error: authError } = await sb.auth.admin.createUser({
      email:         normalizedEmail,
      password,
      email_confirm: true, // skip email confirmation — same as /api/auth/register
    });

    if (authError || !authUser.user) {
      return NextResponse.json(
        { data: null, error: { message: authError?.message || 'Signup failed', code: 'AUTH_ERROR' } },
        { status: 400 }
      );
    }

    // is_active: true (not false, unlike register's cell_leader path) —
    // there is no admin to approve this account. It IS the admin, and its
    // 30-day trial starts the moment /setup's PATCH bootstraps the church
    // right after this.
    const { error: profileError } = await sb.from('users').insert({
      id:        authUser.user.id,
      email:     normalizedEmail,
      full_name: full_name.trim(),
      role:      'overseer',
      church_id: null,
      is_active: true,
    });

    if (profileError) {
      // Clean up the auth user if the profile insert fails — same pattern
      // as /api/auth/register — so a half-created account can't block the
      // same email from signing up again.
      await sb.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json(
        { data: null, error: { message: 'Signup failed. Please try again.', code: 'PROFILE_ERROR' } },
        { status: 500 }
      );
    }

    const token = await signToken({
      id:           authUser.user.id,
      email:        normalizedEmail,
      role:         'overseer',
      cell_id:      null,
      fellowship_id: null,
      member_id:    null,
      branch_id:    null,
      church_id:    null,
      finance_access_granted: false,
      name:         full_name.trim(),
    });

    // Same non-body, httpOnly-cookie-only pattern as /api/auth/login — see
    // that route's comment for why the token itself is never echoed back.
    const res = NextResponse.json({
      data: { user: { id: authUser.user.id, email: normalizedEmail, role: 'overseer', church_id: null, name: full_name.trim() } },
      error: null,
    }, { status: 201 });

    res.cookies.set('shepherd_token', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   7200, // 2 hours — matches /api/auth/login
      path:     '/',
    });

    return res;

  } catch (err) {
    console.error('[POST /api/auth/signup]', err);
    return NextResponse.json(
      { data: null, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
