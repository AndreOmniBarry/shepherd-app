// ============================================================
// SHEP.HERD — Supabase Client
// Two clients: browser (anon key) and server (service role).
// Never use the service role key in browser code.
// ============================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase env vars. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
  );
}

// ── Browser client (safe — uses anon key + RLS) ──────────────
// Used in React components and client-side hooks.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,      // We manage sessions via our own JWT
    autoRefreshToken: false,
  },
  global: {
    headers: {
      'x-application-name': 'shepherd',
    },
  },
});

// ── Server client (service role — bypasses RLS) ──────────────
// Used ONLY in API routes and seed scripts.
// NEVER import this in client components.
export function createServerClient() {
  if (!SUPABASE_SERVICE) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY. This should only be called in API routes.'
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ── Realtime channel factory ──────────────────────────────────
// Creates a typed channel for the pastor dashboard live feed.
export function createAttendanceLiveChannel(
  onInsert: (record: Record<string, unknown>) => void
) {
  return supabase
    .channel('shepherd-attendance-live')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'attendance_records' },
      (payload) => onInsert(payload.new)
    );
}
