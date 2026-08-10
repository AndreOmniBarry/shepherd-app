// ============================================================
// SHEP.HERD — System health checks (technical triage)
//
// Computes the current set of "things the lead-tech admin should
// know about" and syncs them into system_alerts: insert what's newly
// true, leave what's still true alone, auto-resolve what's no longer
// true. Invoked by POST/GET /api/admin/health-check on a schedule.
//
// Scope note: only checks backed by data that's reliably attributed
// today are included. church_id stamping was only added recently
// (scripts/42_multi_tenant_churches.sql) and most write routes don't
// populate it yet, so per-church activity/staleness checks (e.g. "no
// attendance logged in 2 weeks") would misattribute or silently miss
// everything — deliberately left out until that's fixed, rather than
// shipping a check that can't be trusted. AI-query and SMS failures
// aren't logged anywhere persistent yet either. Both are natural
// follow-ups once that instrumentation exists.
// ============================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

export type Severity = 'critical' | 'medium' | 'low';

type ComputedAlert = {
  church_id: string | null;
  severity: Severity;
  category: string;
  title: string;
  detail: string;
  metadata?: Record<string, unknown>;
};

type ChurchRow = {
  id: string;
  church_name: string;
  plan_tier: string | null;
  subscription_status: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  subscription_started_at: string | null;
};

const PLATFORM_KEY = 'platform'; // used in the dedupe key when church_id is null

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function computeChurchAlerts(c: ChurchRow, now: Date): ComputedAlert[] {
  const alerts: ComputedAlert[] = [];
  if (c.subscription_status !== 'trial') return alerts;

  const trialEnd = c.trial_ends_at ? new Date(c.trial_ends_at) : null;
  const trialStart = c.trial_started_at ? new Date(c.trial_started_at) : null;
  const daysRemaining = trialEnd ? daysBetween(trialEnd, now) : null;
  const daysSinceStart = trialStart ? daysBetween(now, trialStart) : null;

  if (daysRemaining !== null && daysRemaining <= 0) {
    alerts.push({
      church_id: c.id,
      severity: 'critical',
      category: 'trial_expired',
      title: `${c.church_name}'s trial has expired`,
      detail: `Trial ended ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'} ago with no upgrade — the church is still on plan_tier "${c.plan_tier}" with subscription_status "trial".`,
      metadata: { days_over: Math.abs(daysRemaining) },
    });
  } else if (daysRemaining !== null && daysRemaining <= 7) {
    alerts.push({
      church_id: c.id,
      severity: 'medium',
      category: 'trial_expiring',
      title: `${c.church_name}'s trial ends in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
      detail: `Worth a check-in before it lapses — no upgrade has been started yet.`,
      metadata: { days_remaining: daysRemaining },
    });
  }

  // A trial that's been open 45+ days with no subscription ever started
  // reads as an abandoned signup, not just a slow decision — worth a
  // different signal than "expiring this week".
  if (daysSinceStart !== null && daysSinceStart >= 45 && !c.subscription_started_at) {
    alerts.push({
      church_id: c.id,
      severity: 'low',
      category: 'trial_abandoned',
      title: `${c.church_name}'s trial has been open ${daysSinceStart} days with no upgrade`,
      detail: `Started ${daysSinceStart} days ago and never converted — likely an abandoned signup rather than an active decision in progress.`,
      metadata: { days_since_start: daysSinceStart },
    });
  }

  return alerts;
}

async function fetchAllChurches(): Promise<ChurchRow[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/church_config?select=id,church_name,plan_tier,subscription_status,trial_started_at,trial_ends_at,subscription_started_at`,
    { headers: hdrs() }
  );
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function computeInviteBacklogAlert(now: Date): Promise<ComputedAlert | null> {
  // invites.church_id isn't populated by the current invite-creation code
  // (see scripts/42_multi_tenant_churches.sql's own warning) so this stays
  // a single platform-wide count rather than attributed per church.
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/invites?used=eq.false&created_at=lt.${cutoff}&select=id,email,created_at&order=created_at.asc`,
    { headers: hdrs() }
  );
  const data = await res.json();
  const stale = Array.isArray(data) ? data : [];
  if (stale.length === 0) return null;
  return {
    church_id: null,
    severity: 'low',
    category: 'invite_backlog',
    title: `${stale.length} invite${stale.length === 1 ? '' : 's'} sitting unused for over a week`,
    detail: `Nobody's completed signup for ${stale.length} pending invite${stale.length === 1 ? '' : 's'}, oldest sent ${daysBetween(now, new Date(stale[0].created_at))} days ago. Worth a nudge or a re-send.`,
    metadata: { count: stale.length, oldest_created_at: stale[0].created_at },
  };
}

// Mentor review feedback: "checkmate use violation... e.g. someone trying
// to bypass payment and subscription." Every blocked attempt at a
// premium/chat-gated action, or at creating a resource past a plan's
// cap, is logged to access_violations by
// src/lib/plan-gate.ts (scripts/51_account_violations.sql). A handful of
// blocks is normal — a trial church poking at Moshe, a Starter user
// clicking a locked chat thread. A high volume in a short window reads
// differently: someone probing for a way around the gate rather than one
// person hitting it once. church_id here is churches.id (what plan-gate.ts
// actually receives), not church_config.id, so this looks the name up
// separately from fetchAllChurches's church_config rows.
async function computeAccessViolationAlerts(now: Date): Promise<ComputedAlert[]> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/access_violations?created_at=gte.${since}&select=church_id,gate`,
    { headers: hdrs() }
  );
  const data = await res.json();
  const rows: { church_id: string | null; gate: string }[] = Array.isArray(data) ? data : [];

  const byChurch: Record<string, number> = {};
  rows.forEach(r => { if (r.church_id) byChurch[r.church_id] = (byChurch[r.church_id] || 0) + 1; });

  const THRESHOLD_MEDIUM = 10;
  const THRESHOLD_CRITICAL = 30;
  const flagged = Object.entries(byChurch).filter(([, count]) => count >= THRESHOLD_MEDIUM);
  if (flagged.length === 0) return [];

  const ids = flagged.map(([id]) => id);
  const namesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/church_config?church_id=in.(${ids.join(',')})&select=church_id,church_name`,
    { headers: hdrs() }
  );
  const namesData = await namesRes.json();
  const nameByChurch: Record<string, string> = {};
  (Array.isArray(namesData) ? namesData : []).forEach((c: { church_id: string; church_name: string }) => { nameByChurch[c.church_id] = c.church_name; });

  return flagged.map(([church_id, count]) => ({
    church_id,
    severity: count >= THRESHOLD_CRITICAL ? 'critical' : 'medium',
    category: 'possible_subscription_bypass',
    title: `${nameByChurch[church_id] || 'A church'} hit a blocked plan gate ${count} times in the last 24h`,
    detail: `That's an unusual volume for a normal "this feature is locked" moment — worth checking whether this is a confused user or someone probing for a bypass. If it's a real violation, use the Team & Access panel to suspend the account.`,
    metadata: { blocked_attempts_24h: count },
  }));
}

export async function runHealthChecks(): Promise<{ newly_opened: number; resolved: number; checked_at: string }> {
  const now = new Date();
  const churches = await fetchAllChurches();

  const computed: ComputedAlert[] = churches.flatMap(c => computeChurchAlerts(c, now));
  const inviteAlert = await computeInviteBacklogAlert(now);
  if (inviteAlert) computed.push(inviteAlert);
  computed.push(...(await computeAccessViolationAlerts(now)));

  // Existing non-resolved alerts, keyed the same way as computed ones.
  const existingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/system_alerts?status=neq.resolved&select=id,church_id,category`,
    { headers: hdrs() }
  );
  const existingData = await existingRes.json();
  const existing: { id: string; church_id: string | null; category: string }[] = Array.isArray(existingData) ? existingData : [];

  const keyOf = (church_id: string | null, category: string) => `${church_id ?? PLATFORM_KEY}:${category}`;
  const existingByKey = new Map(existing.map(e => [keyOf(e.church_id, e.category), e.id]));
  const stillActiveKeys = new Set(computed.map(a => keyOf(a.church_id, a.category)));

  let inserted = 0;
  for (const alert of computed) {
    const key = keyOf(alert.church_id, alert.category);
    if (existingByKey.has(key)) continue; // already open — leave it, don't spam a new row every run
    const res = await fetch(`${SUPABASE_URL}/rest/v1/system_alerts`, {
      method: 'POST',
      headers: { ...hdrs(), Prefer: 'return=minimal' },
      body: JSON.stringify({
        church_id: alert.church_id,
        severity: alert.severity,
        category: alert.category,
        title: alert.title,
        detail: alert.detail,
        metadata: alert.metadata || null,
      }),
    });
    if (res.ok) inserted++;
  }

  // Auto-resolve anything that was open but is no longer computed as true.
  const toResolve = existing.filter(e => !stillActiveKeys.has(keyOf(e.church_id, e.category)));
  for (const e of toResolve) {
    await fetch(`${SUPABASE_URL}/rest/v1/system_alerts?id=eq.${e.id}`, {
      method: 'PATCH',
      headers: hdrs(),
      body: JSON.stringify({ status: 'resolved', resolved_at: now.toISOString(), updated_at: now.toISOString() }),
    });
  }

  return { newly_opened: inserted, resolved: toResolve.length, checked_at: now.toISOString() };
}
