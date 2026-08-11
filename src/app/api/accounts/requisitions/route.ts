import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { resolveBranchScope } from '@/lib/branch-scope';

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

  // branch_pastor only ever sees their own branch's requisitions — never
  // other branches', regardless of any query param. PA is church-wide (not
  // branch-locked) by founder decision — same free ?branch_id= choice as
  // overseer/lead_tech, matching the other routes that treat PA this way.
  const { searchParams } = new URL(req.url);
  const { branchFilter, forbidden } = resolveBranchScope(user, searchParams, ['branch_pastor']);
  if (forbidden) {
    return NextResponse.json({ data: null, error: { message: 'No branch assigned to this account' } }, { status: 403 });
  }

  const res = await fetch(
    `${S}/rest/v1/expense_requisitions?order=created_at.desc&limit=100&select=id,title,amount_requested,amount_approved,requested_by_name,status,created_at,notes,expense_categories(name)&church_id=eq.${user.church_id}${branchFilter}`,
    { headers: h() }
  );
  const data = await res.json();
  const requisitions = (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => ({
    ...r,
    category_name: (r.expense_categories as Record<string, string> | null)?.name || 'Uncategorised',
  }));
  return NextResponse.json({ data: { requisitions }, error: null });
}

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user || !ALLOWED.includes(user.role)) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const body = await req.json();
  const { category_id, title, description, amount_requested, requested_by_name, department_id } = body;
  const res = await fetch(`${S}/rest/v1/expense_requisitions`, {
    method: 'POST',
    headers: { ...h(), 'Prefer': 'return=representation' },
    body: JSON.stringify({
      category_id: category_id || null,
      title,
      description: description || null,
      amount_requested: parseFloat(amount_requested),
      requested_by: user.id,
      requested_by_name: requested_by_name || 'Unknown',
      department_id: department_id || null,
      branch_id: user.branch_id || null,
      church_id: user.church_id || null,
      status: 'pending',
    }),
  });
  const data = await res.json();
  return NextResponse.json({ data: Array.isArray(data) ? data[0] : data, error: null }, { status: 201 });
}
