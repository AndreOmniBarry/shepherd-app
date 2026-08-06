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
import { DEMO_USER_IDS } from '@/lib/demo-accounts';
import { rolePortal } from '@/lib/role-portal';
import { getJwtSecret } from '@/lib/jwt-secret';

const JWT_SECRET = getJwtSecret();

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/setup',
  '/docs',
  '/events/',
  '/api/auth/login',
  '/api/auth/register',
  '/api/register',
  '/api/invites',
  '/api/settings/church-config',
  '/api/subscription',
  '/api/events/public',
  // Called by an external scheduler with no shepherd_token cookie at all —
  // gated by CRON_SECRET inside the route itself instead, same model as
  // isPublicEventRegistration below.
  '/api/admin/health-check',
  // Paystack calls this directly — no shepherd_token cookie to check. Auth
  // is the HMAC signature verified inside the route itself
  // (src/lib/paystack.ts verifyPaystackSignature); never remove this
  // without that check staying in place.
  '/api/webhooks/paystack',
  '/_next',
  '/favicon.ico',
  '/manifest.json',
  '/billing-calculator.html',
  '/sw.js',
  '/workbox-',
  '/icons/',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p));
}

// The public event landing page only ever submits registrations (POST) to
// this one route anonymously — GET (registrant list) and PATCH (attendance)
// still require an authenticated admin, so this can't just be a blanket
// PUBLIC_PATHS entry.
function isPublicEventRegistration(pathname: string, method: string): boolean {
  return pathname === '/api/events/register' && method === 'POST';
}

// Portal prefixes each role is allowed to access
function allowedPrefixes(role: string): string[] {
  switch (role) {
    case 'overseer':
    case 'general_overseer':
    case 'pa':
    case 'lead_tech':
      // Full access — can view all portals for troubleshooting
      return ['/dashboard', '/fellowship', '/department', '/cell', '/care', '/workforce', '/update', '/admin', '/api'];
    case 'branch_pastor':
      // Same portal set as overseer, minus admin — every view is scoped
      // server-side to the pastor's own branch_id.
      return ['/dashboard', '/fellowship', '/department', '/cell', '/care', '/workforce', '/update', '/api'];
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
    case 'workforce':
      return ['/workforce', '/api'];
    default:
      return ['/cell', '/update', '/api'];
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname) || isPublicEventRegistration(pathname, req.method)) return NextResponse.next();

  const tokenFromCookie = req.cookies.get('shepherd_token')?.value;
  const tokenFromHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
  const token = tokenFromCookie || tokenFromHeader;

  // No token
  if (!token) {
    // The marketing homepage is the one page that serves a real audience
    // logged out — everyone else (churches mid-trial, staff) already has a
    // token and gets redirected to their portal below instead.
    if (pathname === '/') return NextResponse.next();
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

  // Preview/impersonation sessions (fixed demo ids) are look-only — block any
  // request that isn't a plain read, except the one route that exits preview.
  const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (payload.sub && DEMO_USER_IDS.has(payload.sub) && isWrite && pathname !== '/api/admin/exit-impersonation') {
    return NextResponse.json(
      { data: null, error: { message: 'Preview mode is read-only — exit preview to make changes.', code: 'PREVIEW_READ_ONLY' } },
      { status: 403 }
    );
  }

  // The marketing landing page stays reachable even with a valid session —
  // typing the root URL should show it, not bounce straight to the portal.
  // Login (src/app/login/page.tsx) already sends users to their portal
  // explicitly on success, so this never affects the normal sign-in flow.
  if (pathname === '/') return NextResponse.next();

  const { role, cell_id } = payload;
  const portal = rolePortal(role || '');
  // /calendar and /church-center are shared across every role — everyone
  // should be able to see upcoming/past church programs and their own
  // recognition/meetings/assignments regardless of their own portal. This
  // was the actual reason Church Center (and My Assignments before it)
  // "did nothing" when clicked — middleware bounced every role straight
  // back to their own portal since neither path was ever in the allow list.
  const allowed = [...allowedPrefixes(role || ''), '/calendar', '/church-center', '/church-feed', '/chat'];

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
