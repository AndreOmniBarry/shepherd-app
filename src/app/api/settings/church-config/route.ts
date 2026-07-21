import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { DEFAULT_CONFIG, type ChurchConfig } from '@/lib/church-config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
});

async function getUser(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/shepherd_token=([^;]+)/);
  const token = m?.[1];
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return payloadToAuthUser(payload);
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/church_config?order=created_at.asc&limit=1`,
      { headers: hdrs() }
    );
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      // Return default config — church hasn't been configured yet
      return NextResponse.json({
        data: { config: { ...DEFAULT_CONFIG, id: 'default', is_configured: false } },
        error: null,
      });
    }

    return NextResponse.json({ data: { config: data[0] }, error: null });
  } catch (err) {
    console.error('[GET /api/settings/church-config]', err);
    return NextResponse.json({ data: { config: { ...DEFAULT_CONFIG, id: 'default' } }, error: null });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    // Only overseer and lead_tech can update church config
    if (!['overseer', 'lead_tech', 'pa'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Not authorized' } }, { status: 403 });
    }

    const body = await req.json() as Partial<ChurchConfig>;

    // Check if record exists
    const existing = await fetch(
      `${SUPABASE_URL}/rest/v1/church_config?limit=1`,
      { headers: hdrs() }
    );
    const existingData = await existing.json();

    const payload = {
      ...body,
      is_configured: true,
      updated_at: new Date().toISOString(),
    };

    // Auto-set trial dates on first configuration
    if (!existingData?.[0]?.trial_started_at) {
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      Object.assign(payload, {
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEnd.toISOString(),
        plan_tier: body.plan_tier || 'trial',
        subscription_status: body.plan_tier && body.plan_tier !== 'trial' ? 'active' : 'trial',
        subscription_started_at: body.plan_tier && body.plan_tier !== 'trial' ? now.toISOString() : null,
      });
    } else if (body.plan_tier && body.plan_tier !== 'trial') {
      // Upgrading from trial to paid
      Object.assign(payload, {
        subscription_status: 'active',
        subscription_started_at: new Date().toISOString(),
      });
    }

    if (!Array.isArray(existingData) || existingData.length === 0) {
      // INSERT
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/church_config`, {
        method: 'POST',
        headers: { ...hdrs(), 'Prefer': 'return=representation' },
        body: JSON.stringify({ ...DEFAULT_CONFIG, ...payload, created_at: new Date().toISOString() }),
      });
      const inserted = await insertRes.json();
      return NextResponse.json({ data: { config: Array.isArray(inserted) ? inserted[0] : inserted }, error: null });
    } else {
      // UPDATE
      const id = existingData[0].id;
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/church_config?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...hdrs(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload),
      });
      const updated = await updateRes.json();
      return NextResponse.json({ data: { config: Array.isArray(updated) ? updated[0] : updated }, error: null });
    }
  } catch (err) {
    console.error('[PATCH /api/settings/church-config]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to save configuration' } }, { status: 500 });
  }
}
