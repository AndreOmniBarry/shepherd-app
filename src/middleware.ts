// ============================================================
// SHEP.HERD — Middleware v2
// Role-based routing for all portals
// Roles:
//   overseer        → /dashboard
//   pa              → /dashboard (same view as overseer)
//   lead_tech       → /dashboard (same view as overseer)
//   fellowship_head → /fellowship
//   department_head → /department
//   cell_leader     → /cell
//   care_team       → /care
// ============================================================
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'shepherd-dev-secret-change-in-production-minimum-32-chars'
);

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/setup',
  '/api/auth/login',
  '/api/auth/register',
  '/api/register',
  '/api/invites',
  '/api/settings/church-config',
  '/api/subscription',
  '/_next',
  '/favicon.ico',
  '/manifest.json',
  '/billing-calculator.html',

  '/accounts',
  '/partnership',
  '/sw.js',
  '/workbox-',
  '/icons/',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p));
}

// Map role to its home portal
function rolePortal(role: string): string {
  switch (role) {
    case 'overseer':
    case 'pa':
    case 'lead_tech':
      return '/dashboard';
    case 'fellowship_head':
      return '/fellowship';
    case 'department_head':
      return '/department';
    case 'cell_leader':
      return '/cell';
    case 'accounts':
      return '/accounts';
    case 'partnership':
      return '/partnership';
    case 'care_team':
      return '/care';
    default:
      return '/cell';
  }
}

// Portal prefixes each role is allowed to access
function allowedPrefixes(role: string): string[] {
  switch (role) {
    case 'overseer':
    case 'pa':
    case 'lead_tech':
      // Full access — can view all portals for troubleshooting
      return ['/dashboard', '/fellowship', '/department', '/cell', '/care', '/update', '/admin', '/api'];
    case 'fellowship_head':
      return ['/fellowship', '/update', '/api'];
    case 'department_head':
      return ['/department', '/update', '/api'];
    case 'cell_leader':
      return ['/cell', '/update', '/api'];
    case 'accounts':
      return ['/accounts', '/update', '/api'];
    case 'partnership':
      return ['/partnership', '/update', '/api'];
    case 'care_team':
      return ['/care', '/update', '/api'];
    default:
      return ['/cell', '/update', '/api'];
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const tokenFromCookie = req.cookies.get('shepherd_token')?.value;
  const tokenFromHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
  const token = tokenFromCookie || tokenFromHeader;

  // No token
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { data: null, error: { message: 'Authentication required', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify token
  let payload: { role?: string; cell_id?: string; sub?: string };
  try {
    const { payload: p } = await jwtVerify(token, JWT_SECRET);
    payload = p as typeof payload;
  } catch {
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
  const portal = rolePortal(role || '');
  const allowed = allowedPrefixes(role || '');

  // Root redirect → role portal
  if (pathname === '/') {
    const dest = req.nextUrl.clone();
    dest.pathname = portal;
    return NextResponse.redirect(dest);
  }

  // Enforce role boundaries for page routes (not API)
  if (!pathname.startsWith('/api/')) {
    const hasAccess = allowed.some(prefix => pathname.startsWith(prefix));
    if (!hasAccess) {
      const dest = req.nextUrl.clone();
      dest.pathname = portal;
      return NextResponse.redirect(dest);
    }
  }

  // Forward user context to API routes
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-user-id',      payload.sub || '');
  requestHeaders.set('x-user-role',    role || '');
  requestHeaders.set('x-user-cell-id', cell_id || '');
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
