import { NextResponse } from 'next/server';
import { signToken, getAuthUser } from '@/lib/auth';
import { DEFAULT_CONFIG, type ChurchConfig } from '@/lib/church-config';
import type { AuthUser } from '@/types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
});

async function getUser(req: Request) {
  return getAuthUser(req);
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    // A user with no church_id yet hasn't run /setup — there's nothing to
    // fetch (see PATCH below for how a church_id gets assigned).
    if (!user.church_id) {
      return NextResponse.json({
        data: { config: { ...DEFAULT_CONFIG, id: 'default', is_configured: false } },
        error: null,
      });
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/church_config?church_id=eq.${user.church_id}&limit=1`,
      { headers: hdrs() }
    );
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
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

// A user with no church_id at all is going through /setup for the very
// first time as the founding member of a brand-new church (today that
// means: someone — currently only added by hand in Supabase — created
// their users row without a church_id). This bootstraps churches +
// church_config for them and re-issues their session cookie carrying the
// new church_id, so every request after this one is correctly scoped
// without requiring a fresh login.
async function bootstrapChurch(user: AuthUser, churchName: string, structureType?: string): Promise<{ churchId: string; freshToken: string } | null> {
  const churchRes = await fetch(`${SUPABASE_URL}/rest/v1/churches`, {
    method: 'POST',
    headers: { ...hdrs(), Prefer: 'return=representation' },
    body: JSON.stringify({ name: churchName || 'My Church' }),
  });
  const churchData = await churchRes.json();
  const church = Array.isArray(churchData) ? churchData[0] : churchData;
  if (!church?.id) return null;

  await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`, {
    method: 'PATCH',
    headers: hdrs(),
    body: JSON.stringify({ church_id: church.id }),
  });

  // A `single`-structure church ("one congregation, one pastor, no
  // sub-structure needed") has no fellowship/cell hierarchy for anyone to
  // set up by hand — but attendance submission is hard-gated on the
  // submitter having a cell_id. Without this, a single-structure church
  // would have zero way to ever record attendance. So for this preset
  // only, auto-provision one fellowship + one cell right here at
  // bootstrap time, and attach the founding user (who stays `overseer`,
  // keeping full admin permissions everywhere else) to both.
  let singleCellId: string | null = null;
  let singleFellowshipId: string | null = null;
  if (structureType === 'single') {
    const fellowshipRes = await fetch(`${SUPABASE_URL}/rest/v1/fellowships`, {
      method: 'POST',
      headers: { ...hdrs(), Prefer: 'return=representation' },
      body: JSON.stringify({
        name: churchName || 'Congregation',
        church_id: church.id,
        branch_id: user.branch_id ?? null,
      }),
    });
    const fellowshipData = await fellowshipRes.json();
    const fellowship = Array.isArray(fellowshipData) ? fellowshipData[0] : fellowshipData;
    singleFellowshipId = fellowship?.id || null;

    if (singleFellowshipId) {
      const cellRes = await fetch(`${SUPABASE_URL}/rest/v1/cells`, {
        method: 'POST',
        headers: { ...hdrs(), Prefer: 'return=representation' },
        body: JSON.stringify({
          name: churchName || 'Congregation',
          fellowship_id: singleFellowshipId,
          church_id: church.id,
          branch_id: user.branch_id ?? null,
          is_active: true,
        }),
      });
      const cellData = await cellRes.json();
      const cell = Array.isArray(cellData) ? cellData[0] : cellData;
      singleCellId = cell?.id || null;
    }

    if (singleCellId && singleFellowshipId) {
      await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: hdrs(),
        body: JSON.stringify({ cell_id: singleCellId, fellowship_id: singleFellowshipId }),
      });
    }
  }

  const freshToken = await signToken({
    id: user.id,
    email: user.email,
    role: user.role,
    cell_id: singleCellId ?? user.cell_id,
    fellowship_id: singleFellowshipId ?? user.fellowship_id,
    member_id: user.member_id,
    branch_id: user.branch_id,
    church_id: church.id,
    finance_access_granted: user.finance_access_granted,
    name: user.name,
  });

  return { churchId: church.id, freshToken };
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

    let churchId = user.church_id;
    let freshToken: string | null = null;
    if (!churchId) {
      const bootstrapped = await bootstrapChurch(user, (body.church_name as string) || 'My Church', body.structure_type as string | undefined);
      if (!bootstrapped) {
        return NextResponse.json({ data: null, error: { message: 'Failed to initialize church' } }, { status: 500 });
      }
      churchId = bootstrapped.churchId;
      freshToken = bootstrapped.freshToken;
    }

    // Check if record exists
    const existing = await fetch(
      `${SUPABASE_URL}/rest/v1/church_config?church_id=eq.${churchId}&limit=1`,
      { headers: hdrs() }
    );
    const existingData = await existing.json();

    // subscription_status must NEVER be settable through this general
    // settings route — it's the one field hasPremiumAccess() actually
    // gates on (see src/lib/plans.ts), and the only two paths allowed to
    // flip it to 'active' are a verified Paystack transaction
    // (/api/subscription's PATCH) or the webhook's charge.success handler
    // (/api/webhooks/paystack). This previously trusted plan_tier alone —
    // picking "Growth" here (the onboarding wizard's PlanScreen sends
    // exactly this, before any payment exists) set subscription_status
    // straight to 'active', silently unlocking every premium feature
    // (Moshe, Partnership, full chat, SMS/WhatsApp) for free, for as long
    // as the church wanted, for both a brand-new signup AND — since the
    // `else if` branch applied on every later PATCH too — any already-
    // configured church at any time, from any caller (this route's own
    // role check allows overseer/lead_tech/pa) simply by resending their
    // existing plan_tier. plan_tier itself still gets stored normally
    // below (a church's own displayed/intended tier is harmless to keep),
    // it just can no longer carry subscription_status along with it.
    const { subscription_status: _ignoredSubStatus, subscription_started_at: _ignoredSubStarted, ...safeBody } = body as Record<string, unknown>;
    const payload = {
      ...safeBody,
      is_configured: true,
      updated_at: new Date().toISOString(),
    };

    // Auto-set trial dates on first configuration — status is always
    // 'trial' here regardless of which plan_tier the church says it
    // wants; that's just its stated intent until it actually pays.
    if (!existingData?.[0]?.trial_started_at) {
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      Object.assign(payload, {
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEnd.toISOString(),
        plan_tier: body.plan_tier || 'trial',
        subscription_status: 'trial',
        subscription_started_at: null,
      });
    }

    let configResult: unknown;
    if (!Array.isArray(existingData) || existingData.length === 0) {
      // INSERT
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/church_config`, {
        method: 'POST',
        headers: { ...hdrs(), 'Prefer': 'return=representation' },
        body: JSON.stringify({ ...DEFAULT_CONFIG, ...payload, church_id: churchId, created_at: new Date().toISOString() }),
      });
      const inserted = await insertRes.json();
      configResult = Array.isArray(inserted) ? inserted[0] : inserted;
    } else {
      // UPDATE
      const id = existingData[0].id;
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/church_config?id=eq.${id}&church_id=eq.${churchId}`, {
        method: 'PATCH',
        headers: { ...hdrs(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload),
      });
      const updated = await updateRes.json();
      configResult = Array.isArray(updated) ? updated[0] : updated;
    }

    const response = NextResponse.json({ data: { config: configResult }, error: null });
    if (freshToken) {
      response.cookies.set('shepherd_token', freshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7200,
        path: '/',
      });
    }
    return response;
  } catch (err) {
    console.error('[PATCH /api/settings/church-config]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to save configuration' } }, { status: 500 });
  }
}
