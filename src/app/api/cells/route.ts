// GET /api/cells
// ?fellowship_id=uuid  → cells for that fellowship (for registration dropdown)
// ?include=fellowships → returns fellowships list alongside cells
// Auth: returns full list for overseer, own cell only for cell_leader
//
// KNOWN MULTI-TENANT GAP: this endpoint is reachable without a session
// (anonymous self-registration flow) and has no way to know which church
// an anonymous request belongs to — there's no church slug/subdomain in
// the URL to resolve it from. It will list every church's cells/
// fellowships once a second church has real data. Fixing this properly
// needs a public-facing church identifier in the registration URL
// (e.g. /register/[church-slug]), which doesn't exist yet — flagged
// rather than papered over with a guess.

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req).catch(() => null);
    const { searchParams } = new URL(req.url);
    const fellowshipId     = searchParams.get('fellowship_id');
    const includeFellows   = searchParams.get('include') === 'fellowships';

    const sb = createServerClient();

    // For unauthenticated requests (registration form) — return public data only
    const isPublicRequest = !user;

    let cellsQuery = sb
      .from('cells')
      .select('id, name, fellowship_id, target_size, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (fellowshipId) {
      cellsQuery = cellsQuery.eq('fellowship_id', fellowshipId);
    }

    // Cell leaders only see their own cell
    if (user?.role === 'cell_leader' && user.cell_id) {
      cellsQuery = cellsQuery.eq('id', user.cell_id);
    }
    // Authenticated requests are scoped to the caller's own church —
    // anonymous requests can't be (see KNOWN MULTI-TENANT GAP above).
    if (user?.church_id) {
      cellsQuery = cellsQuery.eq('church_id', user.church_id);
    }

    const { data: cells, error: cellsError } = await cellsQuery;
    if (cellsError) throw cellsError;

    // Optionally include fellowships (for registration dropdown)
    let fellowships = null;
    if (includeFellows) {
      let fellowshipsQuery = sb
        .from('fellowships')
        .select('id, name, description')
        .order('name', { ascending: true });
      if (user?.church_id) fellowshipsQuery = fellowshipsQuery.eq('church_id', user.church_id);
      const { data: fs } = await fellowshipsQuery;
      fellowships = fs;
    }

    return NextResponse.json({
      data: {
        cells:       cells || [],
        fellowships: fellowships || undefined,
      },
      error: null,
    });

  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[GET /api/cells]', err);
    return NextResponse.json(
      { data: null, error: { message: 'Failed to load cells', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
