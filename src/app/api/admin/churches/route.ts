import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

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
    if (!['lead_tech', 'overseer'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/church_config?select=id,church_name,country,structure_type,tier1_label,tier2_label,plan_tier,subscription_status,trial_started_at,trial_ends_at,subscription_started_at,is_configured,church_profile,created_at&order=created_at.desc`,
      { headers: hdrs() }
    );
    const data = await res.json();

    const now = new Date();
    const churches = (Array.isArray(data) ? data : []).map((c: Record<string, unknown>) => {
      const trialEnd = c.trial_ends_at ? new Date(c.trial_ends_at as string) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      return {
        ...c,
        trial_days_remaining: daysRemaining,
        church_profile: typeof c.church_profile === 'string' ? JSON.parse(c.church_profile) : (c.church_profile || {}),
      };
    });

    return NextResponse.json({ data: { churches }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to load' } }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    if (!['lead_tech', 'overseer'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }

    const body = await req.json();
    const { id, admin_notes } = body;

    // Get current church_profile and merge notes
    const existing = await fetch(`${SUPABASE_URL}/rest/v1/church_config?id=eq.${id}&select=church_profile&limit=1`, { headers: hdrs() });
    const existingData = await existing.json();
    const currentProfile = existingData?.[0]?.church_profile || {};
    const updatedProfile = { ...(typeof currentProfile === 'string' ? JSON.parse(currentProfile) : currentProfile), admin_notes };

    await fetch(`${SUPABASE_URL}/rest/v1/church_config?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...hdrs(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ church_profile: updatedProfile, updated_at: new Date().toISOString() }),
    });

    return NextResponse.json({ data: { updated: true }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to update' } }, { status: 500 });
  }
}
