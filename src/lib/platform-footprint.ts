// ============================================================
// SHEP.HERD — Per-church platform footprint (shared allocation basis)
// Backs the tech-admin command center's platform-cost allocation:
// GET /api/admin/platform-costs spreads each admin-entered monthly bill
// (Supabase, Vercel, ...) across churches by their relative share of DB
// load + storage volume computed here. This is ALWAYS an allocation
// basis for an estimate, never a claim of exact per-church infra cost —
// Supabase bills one shared project with no per-tenant itemization, so
// no matter how exact the volume inputs feeding it are, the resulting
// ₦ allocation stays an estimate. See scripts/62_platform_cost_accounting.sql.
//
// IMPORTANT — exact vs estimated, at the level of each number, not just
// a blanket disclaimer: every count/byte figure this module returns
// (members, chat messages, feed posts/comments/reactions, storage bytes)
// is an EXACT count from a live query — there is nothing approximate
// about "this church has 4,213 chat messages" or "this church has
// uploaded 812MB". What's approximate is the downstream step the caller
// takes with it: converting a footprint SHARE into an allocated ₦ figure
// against an admin-entered bill. Keep that distinction visible wherever
// this data surfaces — never blur "exact volume" into "estimated cost"
// as if they were the same kind of number.
//
// Broken out per category (not collapsed into one opaque score) so the
// founder can see what's actually driving the number:
//   - members            (direct church_id column)
//   - attendance_records (via cells.church_id — one row per cell per
//     service, usually the highest-frequency write path in the app)
//   - feed: posts (via feed_groups.church_id), comments and reactions
//     (both via feed_posts -> feed_groups.church_id, two hops)
//   - chat: messages (via chat_threads.church_id) — both an all-time
//     total and a this-month count, since chat volume is the category
//     most useful to see trending
//   - storage bytes (from usage_events type='storage', one row per
//     upload — see src/app/api/media/upload/route.ts). Every row keeps
//     its own created_at and is never overwritten, so a future query can
//     chart growth over any date range without new instrumentation —
//     this is intentional groundwork for the storage-as-a-paid-feature
//     decision the founder is weighing about a year out, not just a
//     current snapshot.
//
// Weights (below) are a judgment call, not derived from Supabase's
// actual cost breakdown (which this app has no visibility into) — they
// encode a rough sense of relative DB/storage load per unit, tunable
// here without touching callers.
// ============================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` });

const WEIGHTS = {
  members: 1,
  attendance_records: 2,
  feed_posts: 1,
  feed_comments: 0.5,
  feed_reactions: 0.2,
  chat_messages: 3, // all-time total is what's weighted into the score
  // Storage bytes are converted to a row-equivalent unit before weighting
  // (dividing by an assumed ~50KB "typical unit") since raw byte counts
  // are on a wildly different scale than row counts — this is a rough
  // equivalence, not a cost-accurate one.
  storage_bytes_per_unit: 50_000,
  storage_unit: 5,
};

export type ChurchFootprint = {
  church_id: string;
  // Every count/byte field below is an EXACT figure from a live query —
  // only `score`/`share` (and any ₦ figure a caller derives from `share`)
  // are estimates.
  members: number;
  attendance_records: number;
  chat_messages_total: number;
  chat_messages_this_month: number;
  feed_posts: number;
  feed_comments: number;
  feed_reactions: number;
  storage_bytes: number;
  score: number;
  share: number; // 0..1, this church's share of the total platform footprint — the one estimate-bearing number in this shape
};

function startOfMonthIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

async function countExact(url: string): Promise<number> {
  try {
    const res = await fetch(url, { method: 'HEAD', headers: { ...hdrs(), Prefer: 'count=exact' } });
    const range = res.headers.get('content-range');
    const total = range?.split('/')[1];
    return total && total !== '*' ? parseInt(total, 10) : 0;
  } catch {
    return 0;
  }
}

// One HEAD count=exact request against a direct church_id column.
function countDirect(table: string, churchId: string, extraFilter = ''): Promise<number> {
  return countExact(`${SUPABASE_URL}/rest/v1/${table}?church_id=eq.${churchId}&select=id${extraFilter}`);
}

// One HEAD count=exact request against a table that only carries
// church_id through one embedded parent (PostgREST's `!inner` embedded
// filter — filters and counts the child rows whose parent matches).
function countViaParent(table: string, parentResource: string, churchId: string, extraFilter = ''): Promise<number> {
  return countExact(
    `${SUPABASE_URL}/rest/v1/${table}?select=id,${parentResource}!inner(church_id)&${parentResource}.church_id=eq.${churchId}${extraFilter}`
  );
}

// Same, but two hops away from church_id (e.g. feed_comments -> feed_posts
// -> feed_groups.church_id) via PostgREST's dotted nested-embed filter path.
function countViaGrandparent(table: string, parentResource: string, grandparentResource: string, churchId: string): Promise<number> {
  return countExact(
    `${SUPABASE_URL}/rest/v1/${table}?select=id,${parentResource}!inner(${grandparentResource}!inner(church_id))&${parentResource}.${grandparentResource}.church_id=eq.${churchId}`
  );
}

// Every 'storage' usage_events row for every church, summed client-side
// by church_id — one request total rather than one per church, since
// PostgREST has no SUM() over a JSONB field without an RPC. Reads
// `created_at` off every row too (though only bytes are summed here) —
// nothing about this aggregation collapses or overwrites individual
// upload events; the underlying rows stay queryable by date range for a
// future storage-growth-over-time chart.
async function storageBytesByChurch(): Promise<Record<string, number>> {
  const byChurch: Record<string, number> = {};
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/usage_events?type=eq.storage&select=church_id,metadata`,
      { headers: hdrs() }
    );
    const rows: { church_id: string; metadata: { bytes?: number } | null }[] = await res.json().catch(() => []);
    for (const r of Array.isArray(rows) ? rows : []) {
      if (!r.church_id) continue;
      byChurch[r.church_id] = (byChurch[r.church_id] || 0) + (Number(r.metadata?.bytes) || 0);
    }
  } catch {
    // fall through with whatever was accumulated (possibly empty)
  }
  return byChurch;
}

// Computes each given church's relative share of total platform footprint.
// A handful of count=exact HEAD requests per church (same pattern as
// src/lib/plan-gate.ts's countChurchResource / src/lib/usage.ts's
// getMonthlyUsageCount) plus one shared storage-bytes fetch — fine for a
// tech-admin dashboard read, not meant to be real-time-fast.
export async function computeChurchFootprints(churchIds: string[]): Promise<ChurchFootprint[]> {
  const storageBytes = await storageBytesByChurch();
  const since = startOfMonthIso();

  const rows = await Promise.all(churchIds.map(async (churchId): Promise<ChurchFootprint> => {
    const [
      members, attendance_records,
      chat_messages_total, chat_messages_this_month,
      feed_posts, feed_comments, feed_reactions,
    ] = await Promise.all([
      countDirect('members', churchId),
      countViaParent('attendance_records', 'cells', churchId),
      countViaParent('chat_messages', 'chat_threads', churchId),
      countViaParent('chat_messages', 'chat_threads', churchId, `&created_at=gte.${since}`),
      countViaParent('feed_posts', 'feed_groups', churchId),
      countViaGrandparent('feed_comments', 'feed_posts', 'feed_groups', churchId),
      countViaGrandparent('feed_post_reactions', 'feed_posts', 'feed_groups', churchId),
    ]);
    const bytes = storageBytes[churchId] || 0;
    const storageUnits = bytes / WEIGHTS.storage_bytes_per_unit;

    const score =
      members * WEIGHTS.members +
      attendance_records * WEIGHTS.attendance_records +
      feed_posts * WEIGHTS.feed_posts +
      feed_comments * WEIGHTS.feed_comments +
      feed_reactions * WEIGHTS.feed_reactions +
      chat_messages_total * WEIGHTS.chat_messages +
      storageUnits * WEIGHTS.storage_unit;

    return {
      church_id: churchId, members, attendance_records,
      chat_messages_total, chat_messages_this_month,
      feed_posts, feed_comments, feed_reactions,
      storage_bytes: bytes, score, share: 0,
    };
  }));

  const total = rows.reduce((s, r) => s + r.score, 0);
  for (const r of rows) r.share = total > 0 ? r.score / total : 0;

  return rows;
}
