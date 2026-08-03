import { NextResponse } from 'next/server';
import { runHealthChecks } from '@/lib/health-checks';

// ── Runs the full technical-triage sweep and syncs system_alerts.
// ── Meant to be called on a schedule, not by hand:
//    - Vercel Cron: add a `crons` entry in vercel.json targeting this
//      path. Vercel automatically sends `Authorization: Bearer
//      $CRON_SECRET` when the CRON_SECRET env var is set, which the
//      check below accepts directly.
//    - Any external scheduler (cron-job.org, GitHub Actions, etc.):
//      POST here with `{ "secret": "..." }` or an `x-cron-secret` header,
//      matching the same convention already used by
//      /api/care/trigger-alerts.
function isAuthorized(req: Request, bodySecret?: string): boolean {
  if (!process.env.CRON_SECRET) return false;
  const authHeader = req.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  if (req.headers.get('x-cron-secret') === process.env.CRON_SECRET) return true;
  if (bodySecret === process.env.CRON_SECRET) return true;
  return false;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  }
  const result = await runHealthChecks();
  return NextResponse.json({ data: result, error: null });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as { secret?: string }));
  if (!isAuthorized(req, body?.secret)) {
    return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  }
  const result = await runHealthChecks();
  return NextResponse.json({ data: result, error: null });
}
