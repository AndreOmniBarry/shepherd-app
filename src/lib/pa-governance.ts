// ============================================================
// SHEP.HERD — PA financial-access gate
// Founder decision: PA is naturally pastoral-facing and freely sees
// membership, attendance, structure, events, workforce scheduling, and
// pastoral care notes by default. The one category gated behind an
// explicit grant is financial/giving records — a pa account is blocked
// from those routes until an overseer/general_overseer flips
// finance_access_granted on for them (PATCH /api/admin/users, action:
// 'set_finance_access').
//
// Single boolean, single category — deliberately not a generic
// multi-category permission system. Every non-pa role is unaffected by
// this check: it only ever narrows what 'pa' itself can reach.
// ============================================================
import { NextResponse } from 'next/server';
import type { AuthUser } from '@/types';

// True for every non-pa role (this gate only ever restricts pa) and for
// a pa account with the flag explicitly set. Missing/false/undefined —
// including on a JWT signed before this field existed — means no access,
// never a silent unlock.
export function hasFinanceAccess(user: AuthUser): boolean {
  if (user.role !== 'pa') return true;
  return !!user.finance_access_granted;
}

// Exported so frontend callers can render the exact same copy when a
// finance-gated route comes back with FINANCE_ACCESS_REQUIRED, instead of
// silently rendering an empty list that's indistinguishable from "nothing
// here yet".
export const FINANCE_GATE_MESSAGE = 'Financial records aren\'t part of your access yet — ask your General Overseer to grant it from Team & Access.';

// Returns a 403 NextResponse to return immediately if this pa account
// hasn't been granted finance access, or null if the caller should
// proceed. Call right after the route's existing role-allowlist check.
export function requireFinanceAccess(user: AuthUser): NextResponse | null {
  if (hasFinanceAccess(user)) return null;
  return NextResponse.json(
    { data: null, error: { message: FINANCE_GATE_MESSAGE, code: 'FINANCE_ACCESS_REQUIRED' } },
    { status: 403 }
  );
}
