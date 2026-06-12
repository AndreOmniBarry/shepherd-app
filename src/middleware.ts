// ============================================================
// SHEP.HERD — Middleware
// Runs on every request before the page or API route loads.
// Handles:
//   - JWT verification
//   - Role-based routing (cell_leader → /cell, overseer → /dashboard)
//   - Unauthenticated redirect to /login
//   - API route auth guard (returns 401 JSON, not redirect)
// ============================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'shepherd-dev-secret-change-in-production-minimum-32-chars'
);

// Routes that don't need auth
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/api/auth/login',
  '/api/auth/register',
  '/_next',
  '/favicon.ico',
  '/manifest.json',
  '/sw.js',
  '/workbox-',
  '/icons/',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow public paths through
  if (isPublic(pathname)) return NextResponse.next();

  // Get token from cookie (web) or Authorization header (API)
  const tokenFromCookie = req.cookies.get('shepherd_token')?.value;
  const tokenFromHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
  const token = tokenFromCookie || tokenFromHeader;

  // ── No token ─────────────────────────────────────────────
  if (!token) {
    // API routes return 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { data: null, error: { message: 'Authentication required', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    // Pages redirect to login
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Verify token ─────────────────────────────────────────
  let payload: { role?: string; cell_id?: string; sub?: string };
  try {
    const { payload: p } = await jwtVerify(token, JWT_SECRET);
    payload = p as typeof payload;
  } catch {
    // Invalid or expired — clear cookie and redirect
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { data: null, error: { message: 'Token expired or invalid', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete('shepherd_token');
    return res;
  }

  const { role, cell_id } = payload;

  // ── Role-based route enforcement ─────────────────────────
  // Cell leaders must stay within /cell/*
  if (role === 'cell_leader' && pathname.startsWith('/dashboard')) {
    const cellUrl = req.nextUrl.clone();
    cellUrl.pathname = '/cell';
    return NextResponse.redirect(cellUrl);
  }

  // Overseer must stay within /dashboard/*
  if (role === 'overseer' && pathname.startsWith('/cell')) {
    const dashUrl = req.nextUrl.clone();
    dashUrl.pathname = '/dashboard';
    return NextResponse.redirect(dashUrl);
  }

  // Root redirect: logged-in users hit / → their portal
  if (pathname === '/') {
    const dest = req.nextUrl.clone();
    dest.pathname = role === 'overseer' ? '/dashboard' : '/cell';
    return NextResponse.redirect(dest);
  }

  // ── Forward user context in headers for API routes ───────
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-user-id',      payload.sub    || '');
  requestHeaders.set('x-user-role',    role            || '');
  requestHeaders.set('x-user-cell-id', cell_id         || '');

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    // Match all routes except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
