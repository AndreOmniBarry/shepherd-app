import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { computeSlaGrade } from '@/lib/sla';
import { resolveBranchScope } from '@/lib/branch-scope';
import { dispatchEvent } from '@/lib/notify';
import { requireFinanceAccess } from '@/lib/pa-governance';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const h = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
}

const ALLOWED = ['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech', 'accounts'];

export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user || !ALLOWED.includes(user.role)) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const financeBlocked = requireFinanceAccess(user);
  if (financeBlocked) return financeBlocked;
  // branch_pastor only ever sees their own branch's income — never other
  // branches', regardless of any query param. PA is church-wide (not
  // branch-locked) by founder decision — same free ?branch_id= choice as
  // overseer/lead_tech, matching the other routes that treat PA this way.
  const { searchParams } = new URL(req.url);
  const { branchFilter, forbidden } = resolveBranchScope(user, searchParams, ['branch_pastor']);
  if (forbidden) {
    return NextResponse.json({ data: null, error: { message: 'No branch assigned to this account' } }, { status: 403 });
  }
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const res = await fetch(
    `${S}/rest/v1/income_records?service_date=gte.${cutoff.toISOString().split('T')[0]}&order=service_date.desc&limit=200&select=id,amount,member_name,service_date,notes,created_at,income_types(name)&church_id=eq.${user.church_id}${branchFilter}`,
    { headers: h() }
  );
  const data = await res.json();
  // SLA here measures how promptly the accounts team logged the income after
  // the service itself — not a payment/approval turnaround.
  const records = (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => ({
    ...r,
    income_type_name: (r.income_types as Record<string, string> | null)?.name || '',
    sla_grade: r.service_date && r.created_at ? computeSlaGrade(r.service_date as string, r.created_at as string) : null,
  }));
  return NextResponse.json({ data: { records }, error: null });
}

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user || !ALLOWED.includes(user.role)) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const financeBlocked = requireFinanceAccess(user);
  if (financeBlocked) return financeBlocked;
  const body = await req.json();
  const { income_type_id, member_name, amount, service_date, notes, fellowship_id, is_adjustment, adjustment_note } = body;

  // Lock-step reconciliation: once a month is closed, a normal entry can no
  // longer land inside it silently — it must be explicitly marked as an
  // adjustment, so a "final" figure never quietly changes after the fact.
  if (service_date) {
    const monthStart = String(service_date).slice(0, 7) + '-01';
    const periodRes = await fetch(`${S}/rest/v1/financial_periods?period_month=eq.${monthStart}&church_id=eq.${user.church_id}&select=id`, { headers: h() });
    const periodRows = await periodRes.json();
    const isClosed = Array.isArray(periodRows) && periodRows.length > 0;
    if (isClosed && !is_adjustment) {
      return NextResponse.json({ data: null, error: { message: `${monthStart.slice(0, 7)} is a closed period. Log this as an adjustment instead — check "This is an adjustment to a closed period" and explain why.`, code: 'PERIOD_CLOSED' } }, { status: 409 });
    }
  }

  const res = await fetch(`${S}/rest/v1/income_records`, {
    method: 'POST',
    headers: { ...h(), 'Prefer': 'return=representation' },
    body: JSON.stringify({
      income_type_id,
      member_name: member_name || null,
      amount: parseFloat(amount),
      service_date,
      notes: notes || null,
      fellowship_id: fellowship_id || null,
      submitted_by: user.id,
      is_adjustment: !!is_adjustment,
      adjustment_note: is_adjustment ? (adjustment_note || null) : null,
      branch_id: user.branch_id || null,
      church_id: user.church_id || null,
    }),
  });
  const data = await res.json();
  // Fire to pastor dashboard and PA
  const entry = Array.isArray(data) ? data[0] : data;
  await dispatchEvent({
    event: 'income_logged',
    actor_name: user.id,
    actor_role: user.role,
    church_id: user.church_id,
    detail: `Income recorded — ${Number(body.amount || 0).toLocaleString()}`,
    amount: parseFloat(body.amount) || 0,
  });
  return NextResponse.json({ data: entry, error: null }, { status: 201 });
}
