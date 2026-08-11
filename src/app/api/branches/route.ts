export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { requireWithinPlanLimit } from '@/lib/plan-gate';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}` });

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function getUser(req: Request) {
  return getAuthUser(req);
}

function cleanDayServiceCounts(input: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (input && typeof input === 'object') {
    for (const [day, count] of Object.entries(input as Record<string, unknown>)) {
      if (DAY_NAMES.includes(day)) out[day] = Math.max(1, Math.min(10, Number(count) || 1));
    }
  }
  return out;
}

export async function GET(req: Request) {
  const user = await getUser(req);
  // Branch names/schedules aren't sensitive — any authenticated role can
  // read this (a cell leader needs their own branch's service days and
  // per-day service counts to submit attendance correctly).
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const res = await fetch(`${S}/rest/v1/branches?order=is_headquarters.desc,name.asc&select=id,name,is_headquarters,service_days,day_service_counts&church_id=eq.${user.church_id}`, { headers: H() });
  const data = await res.json();
  return NextResponse.json({ data: { branches: Array.isArray(data) ? data : [] }, error: null });
}

// Updates one branch's own service schedule — which weekdays it runs
// regular services on, and how many services it runs on EACH of those
// days (a branch commonly runs several Sunday services but only one
// midweek service, so this is per-day, not one flat number). A
// branch_pastor can only ever touch their own branch; overseer/
// general_overseer/lead_tech can target any branch by id.
export async function PATCH(req: Request) {
  const user = await getUser(req);
  if (!user || !['overseer', 'general_overseer', 'branch_pastor', 'lead_tech'].includes(user.role)) {
    return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
  }
  const { id, service_days, day_service_counts } = await req.json() as { id?: string; service_days?: string[]; day_service_counts?: Record<string, number> };
  const branchId = user.role === 'branch_pastor' ? user.branch_id : id;
  if (!branchId) return NextResponse.json({ data: null, error: { message: 'branch id is required' } }, { status: 400 });
  if (!service_days?.length) return NextResponse.json({ data: null, error: { message: 'At least one service day is required' } }, { status: 400 });

  const counts = cleanDayServiceCounts(day_service_counts);
  for (const d of service_days) if (!(d in counts)) counts[d] = 1;

  const res = await fetch(`${S}/rest/v1/branches?id=eq.${branchId}&church_id=eq.${user.church_id}`, {
    method: 'PATCH',
    headers: { ...H(), 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify({ service_days, day_service_counts: counts }),
  });
  if (!res.ok) return NextResponse.json({ data: null, error: { message: 'Failed to update branch schedule' } }, { status: 502 });
  const updated = await res.json();
  return NextResponse.json({ data: Array.isArray(updated) ? updated[0] : updated, error: null });
}

// Creates one or more branches — from the onboarding wizard (name-only,
// schedule defaults to the church-wide config) or from the Settings "+
// Create Branch" button (full schedule supplied up front). Either way the
// branch is fully active the moment it's created — no separate
// "activation" step. The first branch created becomes headquarters, but
// only if no headquarters branch exists yet (safe to call repeatedly —
// names are unique, already-created branches are just skipped).
export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user || !['overseer', 'general_overseer', 'pa', 'lead_tech'].includes(user.role)) {
    return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
  }
  const body = await req.json() as { names?: string[]; branches?: { name: string; service_days?: string[]; day_service_counts?: Record<string, number> }[] };

  let entries: { name: string; service_days: string[]; day_service_counts: Record<string, number> }[] = [];
  if (body.branches?.length) {
    entries = body.branches
      .map(b => ({ name: b.name?.trim() || '', service_days: b.service_days?.length ? b.service_days : ['Sunday'], day_service_counts: {} as Record<string, number> }))
      .filter(b => b.name);
    entries.forEach(e => {
      const counts = cleanDayServiceCounts(body.branches!.find(b => b.name.trim() === e.name)?.day_service_counts);
      for (const d of e.service_days) if (!(d in counts)) counts[d] = 1;
      e.day_service_counts = counts;
    });
  } else {
    entries = (body.names || []).map(n => n.trim()).filter(Boolean).map(name => ({ name, service_days: ['Sunday'], day_service_counts: { Sunday: 1 } }));
  }
  if (entries.length === 0) return NextResponse.json({ data: null, error: { message: 'At least one branch name is required' } }, { status: 400 });

  // Bulk-create aware: pass how many new branches this request would add,
  // not just 1, so a single call can't jump straight past the cap.
  const limitBlocked = await requireWithinPlanLimit(user.church_id, 'branches', user.id, entries.length);
  if (limitBlocked) return limitBlocked;

  const existingRes = await fetch(`${S}/rest/v1/branches?select=id,name,is_headquarters&church_id=eq.${user.church_id}`, { headers: H() });
  const existing = await existingRes.json();
  const existingRows = Array.isArray(existing) ? existing : [];
  const hasHeadquarters = existingRows.some((b: { is_headquarters: boolean }) => b.is_headquarters);

  const rows = entries.map((e, i) => ({
    name: e.name,
    is_headquarters: !hasHeadquarters && i === 0,
    service_days: e.service_days,
    day_service_counts: e.day_service_counts,
    church_id: user.church_id || null,
  }));

  // Uniqueness is scoped per church (see scripts/52_branches_church_scoped_unique_name.sql —
  // the constraint used to be global on `name` alone, which meant two
  // churches both naming a branch "Main Campus" would silently collide;
  // it's now a composite (church_id, name) constraint).
  const res = await fetch(`${S}/rest/v1/branches?on_conflict=church_id,name`, {
    method: 'POST',
    headers: { ...H(), 'Content-Type': 'application/json', 'Prefer': 'return=representation,resolution=ignore-duplicates' },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('[POST /api/branches]', res.status, err);
    return NextResponse.json({ data: null, error: { message: 'Failed to create branch(es)' } }, { status: 502 });
  }
  const inserted = await res.json();
  return NextResponse.json({ data: { branches: Array.isArray(inserted) ? inserted : [] }, error: null }, { status: 201 });
}
