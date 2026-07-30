export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}` });

async function getUser(req: Request) {
  const m = req.headers.get('cookie')?.match(/shepherd_token=([^;]+)/);
  if (!m) return null;
  const p = await verifyToken(m[1]);
  return p ? payloadToAuthUser(p) : null;
}

export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user || !['overseer', 'general_overseer', 'pa', 'lead_tech'].includes(user.role)) {
    return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
  }
  const res = await fetch(`${S}/rest/v1/branches?order=is_headquarters.desc,name.asc&select=id,name,is_headquarters`, { headers: H() });
  const data = await res.json();
  return NextResponse.json({ data: { branches: Array.isArray(data) ? data : [] }, error: null });
}

// Bulk-creates branches straight from the onboarding wizard — a church picks
// how many locations it has and names them, and this is what actually
// builds the branches table for them, with zero hardcoding or manual SQL.
// The first name in the list becomes the headquarters branch, but only if
// no headquarters branch exists yet (re-running onboarding is safe — names
// are unique, so already-created branches are just skipped).
export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user || !['overseer', 'general_overseer', 'pa', 'lead_tech'].includes(user.role)) {
    return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
  }
  const { names } = await req.json() as { names?: string[] };
  const clean = (names || []).map(n => n.trim()).filter(Boolean);
  if (clean.length === 0) return NextResponse.json({ data: null, error: { message: 'At least one branch name is required' } }, { status: 400 });

  const existingRes = await fetch(`${S}/rest/v1/branches?select=id,name,is_headquarters`, { headers: H() });
  const existing = await existingRes.json();
  const existingRows = Array.isArray(existing) ? existing : [];
  const hasHeadquarters = existingRows.some((b: { is_headquarters: boolean }) => b.is_headquarters);

  const rows = clean.map((name, i) => ({
    name,
    is_headquarters: !hasHeadquarters && i === 0,
  }));

  const res = await fetch(`${S}/rest/v1/branches?on_conflict=name`, {
    method: 'POST',
    headers: { ...H(), 'Content-Type': 'application/json', 'Prefer': 'return=representation,resolution=ignore-duplicates' },
    body: JSON.stringify(rows),
  });
  const inserted = await res.json();
  return NextResponse.json({ data: { branches: Array.isArray(inserted) ? inserted : [] }, error: null }, { status: 201 });
}
