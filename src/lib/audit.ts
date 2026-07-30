// Fire-and-forget audit logging — never blocks or fails the action it's
// recording. Called from routes that perform sensitive, hard-to-reverse
// operations (merges, removals, invites, role changes).
const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function logAudit(entry: {
  actor_id: string;
  actor_role: string;
  action: string;
  target_type?: string;
  target_id?: string;
  detail?: Record<string, unknown>;
}) {
  try {
    await fetch(`${SURL}/rest/v1/audit_log`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        actor_id: entry.actor_id,
        actor_role: entry.actor_role,
        action: entry.action,
        target_type: entry.target_type || null,
        target_id: entry.target_id || null,
        detail: entry.detail || null,
      }),
    });
  } catch (err) {
    console.error('[logAudit]', err);
  }
}
