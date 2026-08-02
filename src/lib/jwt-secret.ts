// ============================================================
// SHEP.HERD — shared JWT signing-secret resolver
// Both lib/auth.ts (Node routes) and middleware.ts (Edge) need the exact
// same key or tokens signed by one would fail verification in the other.
// Previously each file independently fell back to a hardcoded dev string
// if JWT_SECRET was unset — meaning a missing env var in production would
// silently accept a secret that's now sitting in plain text in this
// codebase, letting anyone forge a valid token for any user/role. Failing
// loudly in production is safer than accepting a known-forgeable default.
// ============================================================

export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is not set — refusing to start in production with an insecure default signing key.');
    }
    return new TextEncoder().encode('shepherd-dev-secret-change-in-production-minimum-32-chars');
  }
  return new TextEncoder().encode(secret);
}
