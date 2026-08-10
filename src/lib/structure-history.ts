// ============================================================
// SHEP.HERD — Shared attendance-history implementation
// ============================================================
// Backs /api/cells/history, /api/department/history, and
// /api/fellowship/history. All three answer the same question — "bucketed
// present/absent/rate over the last N weeks/months/years for one structural
// unit" — with the same overall shape (self-scoped leader role, optional
// admin roles that must re-validate a client-supplied id against their own
// church before use, bucketBounds() for the calendar math). This module
// holds that shared shape; STRUCTURE_HISTORY_CONFIGS below (in each thin
// route file... actually here) captures the concrete, real differences
// between the three per-type instead of forcing them to match:
//   - which table holds the raw attendance rows (attendance_records vs
//     department_attendance), and how its date column is read
//   - how a leader's own unit id is resolved (a field already on the JWT,
//     vs a users-table lookup)
//   - which roles get admin (any-unit-in-church) access — fellowship's is a
//     strictly smaller set than cell/department's (no general_overseer, no
//     branch_pastor at all — pre-existing, not something this refactor
//     introduces or "fixes")
//   - whether the admin path further restricts branch_pastor to their own
//     branch_id — true for cell/department (multi-tenant audit fixes #3/#5),
//     false for fellowship (pre-existing; fellowship's admin roles don't
//     include branch_pastor at all, so this never mattered there — kept
//     as-is rather than newly tightened)
//   - cell alone has an intermediate role (fellowship_head, scoped to their
//     own fellowship's cells) with its own ownership check — preserved
//     exactly as it was, including that it does NOT filter by church_id
//     (a pre-existing detail the multi-tenant audit did not flag; UUID
//     collision across churches would be required for this to leak, same
//     category of "efficiency, not a leak" already documented for
//     /api/cells/all in MULTI_TENANT_AUDIT.md)
//
// Every 401/403/404/400 message and status code below is copied verbatim
// from the three original route files — nothing here is a new check or a
// relaxed one.

import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { bucketBounds, type Granularity } from '@/lib/history-buckets';
import type { AuthUser, Role } from '@/types';

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': KEY, 'Authorization': `Bearer ${KEY}` });

async function getUser(req: Request): Promise<AuthUser | null> {
  const m = req.headers.get('cookie')?.match(/shepherd_token=([^;]+)/);
  if (!m) return null;
  const p = await verifyToken(m[1]);
  return p ? payloadToAuthUser(p) : null;
}

type HistoryRow = { present_count: number; absent_count: number; date: string | null };

// The exact bucketing reducer that used to be copy-pasted three times
// (cell/fellowship byte-for-byte identical, department differing only in
// how it reads the row's date). Pure — no auth, no fetch.
function computeBuckets(rows: HistoryRow[], bounds: { start: Date; end: Date; label: string }[]) {
  return bounds.map(b => {
    const inBucket = rows.filter(r => {
      const d = r.date ? new Date(r.date) : null;
      return d && d >= b.start && d < b.end;
    });
    const present = inBucket.reduce((s, r) => s + (r.present_count || 0), 0);
    const absent = inBucket.reduce((s, r) => s + (r.absent_count || 0), 0);
    const total = present + absent;
    return { label: b.label, present, absent, rate: total > 0 ? Math.round((present / total) * 100) : 0 };
  });
}

export type StructureHistoryType = 'cell' | 'department' | 'fellowship';

export interface StructureHistoryConfig {
  type: StructureHistoryType;
  /** Query-string param name for a client-supplied id, e.g. 'cell_id'. */
  idParam: string;
  /** e.g. 'Cell' — used only in the admin path's 404 message. */
  notFoundLabel: string;
  /** Role that owns exactly one unit of this type and can never be redirected to another by a client-supplied id. */
  selfRole: Role;
  /** Resolve that role's own unit id — from the JWT directly, or a DB lookup. */
  resolveSelfId: (user: AuthUser) => Promise<string | null>;
  /** 403 message + implicit status when selfRole has no unit assigned. Omit (like fellowship) to instead fall through to the generic "<idParam> is required" 400 below — matches each original route exactly. */
  selfMissingMessage?: string;
  /** An intermediate role that must supply an id and pass its own bespoke ownership check (only cell has one today: fellowship_head). */
  midRole?: {
    role: Role;
    check: (id: string, user: AuthUser) => Promise<boolean>;
  };
  /** Roles that may view any unit within their own church via a client-supplied id. */
  adminRoles: Role[];
  /** Table used to re-validate a client-supplied id belongs to the caller's own church (the IDOR check from multi-tenant audit fixes #3/#5/#7). */
  ownerTable: string;
  /** Whether the admin path also restricts branch_pastor to their own branch_id. */
  checkBranchForAdmin: boolean;
  /** Given the resolved unit id and the bucket window's start, fetch the raw rows to bucket. */
  fetchRows: (id: string, windowStart: Date) => Promise<HistoryRow[]>;
}

export async function getStructureHistory(req: Request, config: StructureHistoryConfig): Promise<NextResponse> {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const { searchParams } = new URL(req.url);
    let id = searchParams.get(config.idParam);
    const granularityParam = searchParams.get('granularity');
    const granularity: Granularity = granularityParam === 'year' ? 'year' : granularityParam === 'month' ? 'month' : 'week';
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));
    const BUCKETS = 12;

    if (user.role === config.selfRole) {
      const selfId = await config.resolveSelfId(user);
      if (!selfId) {
        if (config.selfMissingMessage) {
          return NextResponse.json({ data: null, error: { message: config.selfMissingMessage } }, { status: 403 });
        }
        // No dedicated "none assigned" message for this type (fellowship) —
        // fall through to the generic "<idParam> is required" check below,
        // matching the original route exactly.
      }
      id = selfId;
    } else if (config.midRole && user.role === config.midRole.role) {
      if (!id) return NextResponse.json({ data: null, error: { message: `${config.idParam} is required` } }, { status: 400 });
      const ok = await config.midRole.check(id, user);
      if (!ok) return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    } else if (config.adminRoles.includes(user.role)) {
      // Admin roles can view any unit's history, but only within their own
      // church — the id is client-supplied, so it must be re-validated
      // against the caller's own church before use (otherwise an admin in
      // one church could view another church's history by id).
      if (!id) return NextResponse.json({ data: null, error: { message: `${config.idParam} is required` } }, { status: 400 });
      const ownRes = await fetch(`${SURL}/rest/v1/${config.ownerTable}?id=eq.${id}&church_id=eq.${user.church_id}&select=id,branch_id`, { headers: H() });
      const ownRows = await ownRes.json();
      const own = Array.isArray(ownRows) ? ownRows[0] : null;
      if (!own) return NextResponse.json({ data: null, error: { message: `${config.notFoundLabel} not found` } }, { status: 404 });
      if (config.checkBranchForAdmin && user.role === 'branch_pastor' && own.branch_id !== user.branch_id) {
        return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
      }
    } else {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }
    if (!id) return NextResponse.json({ data: null, error: { message: `${config.idParam} is required` } }, { status: 400 });

    const bounds = bucketBounds(granularity, offset, BUCKETS);
    const windowStart = bounds[0].start;
    const windowEnd = bounds[bounds.length - 1].end;

    const rows = await config.fetchRows(id, windowStart);
    const buckets = computeBuckets(rows, bounds);

    return NextResponse.json({
      data: { buckets, window_start: windowStart.toISOString().split('T')[0], window_end: windowEnd.toISOString().split('T')[0] },
      error: null,
    });
  } catch (err) {
    console.error(`[GET /api/${config.type} history]`, err);
    return NextResponse.json({ data: null, error: { message: `Failed to load ${config.type} history` } }, { status: 500 });
  }
}

// ── Per-type configs ─────────────────────────────────────────

export const CELL_HISTORY_CONFIG: StructureHistoryConfig = {
  type: 'cell',
  idParam: 'cell_id',
  notFoundLabel: 'Cell',
  selfRole: 'cell_leader',
  resolveSelfId: async (user) => user.cell_id ?? null,
  selfMissingMessage: 'No cell assigned',
  midRole: {
    role: 'fellowship_head',
    check: async (id, user) => {
      const ownRes = await fetch(`${SURL}/rest/v1/cells?id=eq.${id}&select=fellowship_id`, { headers: H() });
      const ownRows = await ownRes.json();
      const cellFellowshipId = Array.isArray(ownRows) ? ownRows[0]?.fellowship_id : null;
      return !!cellFellowshipId && cellFellowshipId === user.fellowship_id;
    },
  },
  adminRoles: ['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'],
  ownerTable: 'cells',
  checkBranchForAdmin: true,
  fetchRows: async (id, windowStart) => {
    const res = await fetch(
      `${SURL}/rest/v1/attendance_records?cell_id=eq.${id}&services.service_date=gte.${windowStart.toISOString().split('T')[0]}&select=present_count,absent_count,services(service_date)&order=submitted_at.asc`,
      { headers: H() }
    );
    const records = await res.json();
    const rows: { present_count: number; absent_count: number; services: { service_date: string } | null }[] = Array.isArray(records) ? records : [];
    return rows.map(r => ({ present_count: r.present_count, absent_count: r.absent_count, date: r.services?.service_date ?? null }));
  },
};

export const DEPARTMENT_HISTORY_CONFIG: StructureHistoryConfig = {
  type: 'department',
  idParam: 'department_id',
  notFoundLabel: 'Department',
  selfRole: 'department_head',
  resolveSelfId: async (user) => {
    const res = await fetch(`${SURL}/rest/v1/users?id=eq.${user.id}&select=department_id&limit=1`, { headers: H() });
    const rows = await res.json();
    return (Array.isArray(rows) ? rows[0]?.department_id : null) ?? null;
  },
  selfMissingMessage: 'No department assigned',
  adminRoles: ['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'],
  ownerTable: 'departments',
  checkBranchForAdmin: true,
  fetchRows: async (id, windowStart) => {
    const res = await fetch(
      `${SURL}/rest/v1/department_attendance?department_id=eq.${id}&submitted_at=gte.${windowStart.toISOString()}&select=present_count,absent_count,submitted_at&order=submitted_at.asc`,
      { headers: H() }
    );
    const records = await res.json();
    const rows: { present_count: number; absent_count: number; submitted_at: string }[] = Array.isArray(records) ? records : [];
    return rows.map(r => ({ present_count: r.present_count, absent_count: r.absent_count, date: r.submitted_at ?? null }));
  },
};

export const FELLOWSHIP_HISTORY_CONFIG: StructureHistoryConfig = {
  type: 'fellowship',
  idParam: 'fellowship_id',
  notFoundLabel: 'Fellowship',
  selfRole: 'fellowship_head',
  resolveSelfId: async (user) => user.fellowship_id ?? null,
  // No dedicated "none assigned" message in the original — it falls through
  // to the generic 400 "fellowship_id is required" instead of a 403.
  adminRoles: ['overseer', 'pa', 'lead_tech'],
  ownerTable: 'fellowships',
  // Fellowship's admin role list never included branch_pastor at all (unlike
  // cell/department), so a branch check never applied here — preserved,
  // not newly added.
  checkBranchForAdmin: false,
  fetchRows: async (id, windowStart) => {
    const cellsRes = await fetch(`${SURL}/rest/v1/cells?fellowship_id=eq.${id}&select=id`, { headers: H() });
    const cellRows: { id: string }[] = await cellsRes.json();
    const cellIds = (Array.isArray(cellRows) ? cellRows : []).map(c => c.id);
    if (cellIds.length === 0) return [];

    const res = await fetch(
      `${SURL}/rest/v1/attendance_records?cell_id=in.(${cellIds.join(',')})&services.service_date=gte.${windowStart.toISOString().split('T')[0]}&select=present_count,absent_count,services(service_date)&order=submitted_at.asc`,
      { headers: H() }
    );
    const records = await res.json();
    const rows: { present_count: number; absent_count: number; services: { service_date: string } | null }[] = Array.isArray(records) ? records : [];
    return rows.map(r => ({ present_count: r.present_count, absent_count: r.absent_count, date: r.services?.service_date ?? null }));
  },
};
