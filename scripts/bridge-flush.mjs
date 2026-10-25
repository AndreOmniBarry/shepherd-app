// Calls the TCH website's POST /api/bridge/flush (wire contract §2) so it
// retries any sign-ups still waiting in its outbox. Meant for an external
// scheduler (GitHub Actions cron, cron-job.org runner, etc.) — NOT a
// Vercel cron (Hobby only allows daily). See docs/TCH_WEBSITE_BRIDGE.md.
//
// Env: BRIDGE_FLUSH_URL, BRIDGE_FLUSH_KEY_ID, BRIDGE_FLUSH_SECRET
// Run: node scripts/bridge-flush.mjs   (Node >= 22.18)
// Prints counts only; exit 1 on any failure.
import { loadFlushConfig, callWebsiteFlush } from '../src/lib/bridge.ts';

try {
  const cfg = loadFlushConfig(process.env);
  if (!cfg) {
    console.error('BRIDGE_FLUSH_URL / BRIDGE_FLUSH_KEY_ID / BRIDGE_FLUSH_SECRET not set');
    process.exit(1);
  }
  const result = await callWebsiteFlush(cfg);
  if (!result.ok) {
    console.error(`flush failed: HTTP ${result.status}`);
    process.exit(1);
  }
  console.log(JSON.stringify({ pending: result.pending, delivered: result.delivered, dead: result.dead }));
} catch (err) {
  console.error('flush failed:', err && err.code ? err.code : (err && err.name) || 'error');
  process.exit(1);
}
