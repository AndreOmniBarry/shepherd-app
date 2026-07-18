// ============================================================
// SHEP.HERD — JWT Utilities
// Uses the 'jose' library — works in Node.js and Edge runtime.
// ============================================================

import { SignJWT, jwtVerify } from 'jose';
import type { JWTPayload, AuthUser, Role } from '@/types';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'shepherd-dev-secret-change-in-production-minimum-32-chars'
);

const JWT_EXPIRY = '24h';

// ── Sign a JWT for a verified user ───────────────────────────
export async function signToken(user: {
  id:           string;
  email:        string;
  role:         Role;
  cell_id:      string | null;
  fellowship_id: string | null;
  name:         string;
}): Promise<string> {
  return new SignJWT({
    sub:          user.id,
    email:        user.email,
    role:         user.role,
    cell_id:      user.cell_id,
    fellowship_id: user.fellowship_id,
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
    name:         (payload as Record<string, unknown>)['name'] as string ?? '',
  };
}

// ── Extract token from request headers ───────────────────────
export function extractToken(req: Request): string | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
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
