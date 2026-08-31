import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { POST as triggerAbsenceAlerts } from '@/app/api/care/trigger-alerts/route';
import { POST as triggerMidweekAlerts } from '@/app/api/care/trigger-midweek-alerts/route';
import { POST as triggerBirthdayAlerts } from '@/app/api/care/trigger-birthday-alerts/route';

// ── Single combined daily-cron entrypoint ──────────────────────────────
// Vercel's Hobby plan caps a project at 2 cron jobs (once/day each). This
// app has three genuinely daily care sweeps — the main-service absence
// cron, the midweek-service absence cron, and the birthday cron — each
// of which is a fast no-op for almost every church on almost every day
// (see their own files), but each of which still needs to actually run
// every day for the one church/day it does apply to. Registering all
// three directly in vercel.json would mean 4 cron jobs total alongside
// /api/admin/health-check, over Hobby's cap of 2 — so this is the only
// one actually wired into vercel.json; it calls the other three
// in-process (no network hop — see the imports above) and aggregates
// their results. Each of those three routes is untouched and still
// fully self-contained (own auth, own GET admin-rerun path) — this is
// purely a scheduling shim, not a merge of their logic.
//
// Tradeoff worth knowing: running all three sweeps in one function
// invocation means roughly 3x the total work in whatever Vercel's
// per-invocation execution-time limit is — Hobby's is a hard 10 seconds,
// not configurable. As the number of churches/absentees/celebrants grows,
// this is more likely to hit that ceiling than any one sweep running
// alone would have been. Upgrading to Pro removes both the 2-cron-job
// cap and raises the execution-time ceiling (maxDuration below only
// takes effect on plans that support it — harmless no-op on Hobby).

export const maxDuration = 60;

async function runAll(req: Request, secret: string | null, churchId?: string) {
  const forward = () => new Request(req.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, church_id: churchId }),
  });

  const [absence, midweek, birthday] = await Promise.all([
    triggerAbsenceAlerts(forward()).then(r => r.json()).catch(err => ({ error: String(err) })),
    triggerMidweekAlerts(forward()).then(r => r.json()).catch(err => ({ error: String(err) })),
    triggerBirthdayAlerts(forward()).then(r => r.json()).catch(err => ({ error: String(err) })),
  ]);

  return { absence, midweek, birthday };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const secret = body.secret || req.headers.get('x-cron-secret');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await runAll(req, process.env.CRON_SECRET, body.church_id);
    return NextResponse.json({ data: result, error: null });
  } catch (err) {
    console.error('[POST /api/care/trigger-daily-alerts]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to trigger daily alerts' } }, { status: 500 });
  }
}

// Same two-caller split as the three sweeps this wraps: Vercel Cron
// (Authorization: Bearer $CRON_SECRET, sweeps every church) vs. a
// signed-in admin manually re-running all three for their own church.
function isCronAuthorized(req: Request): boolean {
  if (!process.env.CRON_SECRET) return false;
  if (req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`) return true;
  if (req.headers.get('x-cron-secret') === process.env.CRON_SECRET) return true;
  return false;
}

export async function GET(req: Request) {
  if (isCronAuthorized(req)) {
    const postReq = new Request(req.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: process.env.CRON_SECRET }),
    });
    return POST(postReq);
  }

  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/shepherd_token=([^;]+)/);
  if (!m?.[1]) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyToken(m[1]);
  const user = payload ? payloadToAuthUser(payload) : null;
  if (!user || !['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'].includes(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  const postReq = new Request(req.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ secret: process.env.CRON_SECRET, church_id: user.church_id }),
  });
  return POST(postReq);
}
