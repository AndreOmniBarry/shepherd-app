// GET /api/cells
// ?fellowship_id=uuid  → cells for that fellowship (for registration dropdown)
// ?include=fellowships → returns fellowships list alongside cells
// Auth: returns full list for overseer, own cell only for cell_leader

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

    const { data: cells, error: cellsError } = await cellsQuery;
    if (cellsError) throw cellsError;

    // Optionally include fellowships (for registration dropdown)
    let fellowships = null;
    if (includeFellows) {
      const { data: fs } = await sb
        .from('fellowships')
        .select('id, name, description')
        .order('name', { ascending: true });
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
