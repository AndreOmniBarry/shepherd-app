export const dynamic = 'force-dynamic';
// POST /api/auth/register
// Creates a Supabase Auth user + a users table row (is_active = false).
// Account requires admin approval in Supabase Studio before login works.

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { RegisterRequest } from '@/types';

export async function POST(req: Request) {
  try {
    const body = await req.json() as RegisterRequest;
    const { email, password, full_name, phone, cell_id } = body;

    // Validation
    if (!email || !password || !full_name || !cell_id) {
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

    const sb = createServerClient();

    // Check cell exists and is active
    const { data: cell, error: cellError } = await sb
      .from('cells')
      .select('id, name, fellowship_id, is_active')
      .eq('id', cell_id)
      .single();

    if (cellError || !cell || !cell.is_active) {
      return NextResponse.json(
        { data: null, error: { message: 'Invalid or inactive cell selected', code: 'INVALID_CELL' } },
        { status: 400 }
      );
    }

    // Check if email already registered
    const { data: existing } = await sb
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (existing) {
      return NextResponse.json(
        { data: null, error: { message: 'An account with this email already exists', code: 'EMAIL_TAKEN' } },
        { status: 409 }
      );
    }

    // Create Supabase Auth user
    const { data: authUser, error: authError } = await sb.auth.admin.createUser({
      email:         email.toLowerCase().trim(),
      password,
      email_confirm: true,   // skip email confirmation for church internal app
    });

    if (authError || !authUser.user) {
      return NextResponse.json(
        { data: null, error: { message: authError?.message || 'Registration failed', code: 'AUTH_ERROR' } },
        { status: 400 }
      );
    }

    // Create users table profile (is_active = false — pending admin approval)
    const { error: profileError } = await sb.from('users').insert({
      id:        authUser.user.id,
      email:     email.toLowerCase().trim(),
      full_name: full_name.trim(),
      phone:     phone?.trim() || null,
      role:      'cell_leader',
      cell_id,
      is_active: false,
    });

    if (profileError) {
      // Clean up auth user if profile insert fails
      await sb.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json(
        { data: null, error: { message: 'Registration failed. Please try again.', code: 'PROFILE_ERROR' } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        message: 'Registration successful. Your account is pending approval.',
        cell_name: cell.name,
      },
      error: null,
    }, { status: 201 });

  } catch (err) {
    console.error('[POST /api/auth/register]', err);
    return NextResponse.json(
      { data: null, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
