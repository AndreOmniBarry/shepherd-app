import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { computeChurchFootprints } from '@/lib/platform-footprint';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
}

type LineItemRow = { id: string; name: string; monthly_bill_ngn: string | number | null; footprint_measure: string };

// Founder-facing settings surface for the platform-wide recurring bills
// this app has no per-request metering for (Supabase, Vercel, ...). A
// small admin-entered list, not a single hardcoded field — see
// scripts/62_platform_cost_accounting.sql for why. lead_tech only, same
// access level as every other cost/margin route on the command center —
// never widen this to church-level roles.
//
// GET returns each line item plus, per church, its footprint share and
// (if the bill has been entered) its allocated ₦ cost — labeled
// `allocated_ngn`, always an ESTIMATE derived from relative footprint
// share, never an exact metered cost. If monthly_bill_ngn is null,
// allocated_ngn is null too — never a silently-defaulted ₦0.
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    if (!['lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }

    const [lineItemsRes, configRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/platform_cost_line_items?select=id,name,monthly_bill_ngn,footprint_measure&order=created_at.asc`, { headers: hdrs() }),
      fetch(`${SUPABASE_URL}/rest/v1/church_config?select=church_id,church_name`, { headers: hdrs() }),
    ]);
    const lineItems: LineItemRow[] = await lineItemsRes.json().catch(() => []);
    const configs: { church_id: string; church_name: string }[] = await configRes.json().catch(() => []);

    const churchIds = (Array.isArray(configs) ? configs : []).map(c => c.church_id).filter(Boolean);
    const nameById: Record<string, string> = {};
    (Array.isArray(configs) ? configs : []).forEach(c => { nameById[c.church_id] = c.church_name; });

    const footprints = await computeChurchFootprints(churchIds);

    const result = (Array.isArray(lineItems) ? lineItems : []).map(li => {
      const bill = li.monthly_bill_ngn === null || li.monthly_bill_ngn === undefined ? null : Number(li.monthly_bill_ngn);
      return {
        id: li.id,
        name: li.name,
        monthly_bill_ngn: bill, // null = "not yet entered", never 0
        footprint_measure: li.footprint_measure,
        allocations: footprints.map(f => ({
          church_id: f.church_id,
          church_name: nameById[f.church_id] || 'Unknown church',
          footprint_share: f.share, // 0..1
          // ALWAYS an allocated estimate (footprint share × admin-entered
          // bill), never an exact metered cost. Null when the bill hasn't
          // been entered — the UI must show "enter your monthly bill to
          // see allocated ₦ cost", not a bogus ₦0.
          allocated_ngn: bill === null ? null : Math.round(f.share * bill * 100) / 100,
        })),
      };
    });

    return NextResponse.json({
      data: {
        line_items: result,
        footprint: footprints.map(f => ({ ...f, church_name: nameById[f.church_id] || 'Unknown church' })),
      },
      error: null,
    });
  } catch (err) {
    console.error('[GET /api/admin/platform-costs]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load platform costs' } }, { status: 500 });
  }
}

// Create a new line item — { name }. monthly_bill_ngn starts unset (null).
export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    if (!['lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }
    const body = await req.json().catch(() => ({})) as { name?: string };
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ data: null, error: { message: 'name is required' } }, { status: 400 });
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/platform_cost_line_items`, {
      method: 'POST',
      headers: { ...hdrs(), Prefer: 'return=representation' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      return NextResponse.json({ data: null, error: { message: err || 'Could not create line item — name may already exist' } }, { status: 409 });
    }
    const created = await res.json();
    return NextResponse.json({ data: { line_item: Array.isArray(created) ? created[0] : created }, error: null }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/admin/platform-costs]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to create line item' } }, { status: 500 });
  }
}

// Update a line item's monthly bill (and/or name) — { id, monthly_bill_ngn?, name? }.
export async function PATCH(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    if (!['lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }
    const body = await req.json().catch(() => ({})) as { id?: string; monthly_bill_ngn?: number | null; name?: string };
    if (!body.id) {
      return NextResponse.json({ data: null, error: { message: 'id is required' } }, { status: 400 });
    }
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('monthly_bill_ngn' in body) patch.monthly_bill_ngn = body.monthly_bill_ngn;
    if (body.name?.trim()) patch.name = body.name.trim();

    const res = await fetch(`${SUPABASE_URL}/rest/v1/platform_cost_line_items?id=eq.${body.id}`, {
      method: 'PATCH', headers: { ...hdrs(), Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      return NextResponse.json({ data: null, error: { message: 'Failed to update line item' } }, { status: 500 });
    }
    return NextResponse.json({ data: { updated: true }, error: null });
  } catch (err) {
    console.error('[PATCH /api/admin/platform-costs]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to update line item' } }, { status: 500 });
  }
}

// Remove a line item — { id } in the JSON body.
export async function DELETE(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    if (!['lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }
    const body = await req.json().catch(() => ({})) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ data: null, error: { message: 'id is required' } }, { status: 400 });
    }
    await fetch(`${SUPABASE_URL}/rest/v1/platform_cost_line_items?id=eq.${body.id}`, {
      method: 'DELETE', headers: { ...hdrs(), Prefer: 'return=minimal' },
    });
    return NextResponse.json({ data: { deleted: true }, error: null });
  } catch (err) {
    console.error('[DELETE /api/admin/platform-costs]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to delete line item' } }, { status: 500 });
  }
}
