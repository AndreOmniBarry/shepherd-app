// ============================================================
// SHEP.HERD — JWT Utilities
// Uses the 'jose' library — works in Node.js and Edge runtime.
// ============================================================

import { SignJWT, jwtVerify } from 'jose';
import type { JWTPayload, AuthUser, Role } from '@/types';
import { getJwtSecret } from '@/lib/jwt-secret';

const JWT_SECRET = getJwtSecret();

const JWT_EXPIRY = '24h';

// ── Sign a JWT for a verified user ───────────────────────────
export async function signToken(user: {
  id:           string;
  email:        string;
  role:         Role;
  cell_id:      string | null;
  fellowship_id: string | null;
  member_id?:   string | null;
  branch_id?:   string | null;
  church_id?:   string | null;
  name:         string;
}): Promise<string> {
  return new SignJWT({
    sub:          user.id,
    email:        user.email,
    role:         user.role,
    cell_id:      user.cell_id,
    fellowship_id: user.fellowship_id,
    member_id:    user.member_id ?? null,
    branch_id:    user.branch_id ?? null,
    church_id:    user.church_id ?? null,
    name:         user.name,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET);
}

// ── Verify and decode a JWT ───────────────────────────────────
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

// ── Extract AuthUser from a verified payload ─────────────────
export function payloadToAuthUser(payload: JWTPayload): AuthUser {
  return {
    id:           payload.sub,
    email:        payload.email,
    role:         payload.role,
    cell_id:      payload.cell_id,
    fellowship_id: payload.fellowship_id ?? null,
    member_id:    payload.member_id ?? null,
    branch_id:    payload.branch_id ?? null,
    church_id:    (payload as Record<string, unknown>)['church_id'] as string | null ?? null,
    name:         (payload as Record<string, unknown>)['name'] as string ?? '',
  };
}

// ── Extract token from request ────────────────────────────────
// Precedence matches the ~85 hand-rolled per-route `getUser(req)`
// implementations this replaces: the `shepherd_token` cookie set by
// /api/auth/login is checked first (that's what the browser session
// flow actually relies on), falling back to an `Authorization: Bearer`
// header only when no cookie is present. Every real-world variant of
// the hand-rolled logic uses this same cookie-first precedence — none
// were found that prefer the header or reject the cookie.
export function extractToken(req: Request): string | null {
  const cookie = req.headers.get('cookie') || '';
  const cookieMatch = cookie.match(/shepherd_token=([^;]+)/);
  if (cookieMatch?.[1]) return cookieMatch[1];

  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);

  return null;
}

// ── Non-throwing auth lookup ──────────────────────────────────
// Returns AuthUser, or null if there is no valid token. This is the
// drop-in replacement for the per-route hand-rolled `getUser(req)`
// functions — it never throws, so every route's own
// `if (!user) return NextResponse.json(...)` handling (custom
// messages/status codes) is preserved unchanged at the call site.
export async function getAuthUser(req: Request): Promise<AuthUser | null> {
  const token = extractToken(req);
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return payloadToAuthUser(payload);
}

// ── Full auth check for API routes ───────────────────────────
// Returns AuthUser or throws a 401 Response.
export async function requireAuth(req: Request): Promise<AuthUser> {
  const token = extractToken(req);
  if (!token) {
    throw new Response(
      JSON.stringify({ data: null, error: { message: 'Missing authorization token', code: 'UNAUTHORIZED' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const payload = await verifyToken(token);
  if (!payload) {
    throw new Response(
      JSON.stringify({ data: null, error: { message: 'Invalid or expired token', code: 'UNAUTHORIZED' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return payloadToAuthUser(payload);
}

// ── Overseer-only guard ───────────────────────────────────────
export async function requireOverseer(req: Request): Promise<AuthUser> {
  const user = await requireAuth(req);
  if (user.role !== 'overseer') {
    throw new Response(
      JSON.stringify({ data: null, error: { message: 'Overseer access required', code: 'FORBIDDEN' } }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return user;
}
