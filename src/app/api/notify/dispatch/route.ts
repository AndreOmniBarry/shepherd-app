import { NextResponse } from 'next/server';
import { dispatchEvent, type DispatchPayload } from '@/lib/notify';

// ── Central notification dispatcher — HTTP entry point ─────────────────
// The actual recipient-computation + insert logic lives in
// src/lib/notify.ts (dispatchEvent). Internal routes call dispatchEvent()
// directly to avoid a wasteful self-HTTP round-trip; this endpoint stays
// up for any external/webhook caller that still needs it over HTTP.

export async function POST(req: Request) {
  try {
    const payload: DispatchPayload = await req.json();

    // Validate it's an internal call
    const internalSecret = req.headers.get('x-internal-secret');
    if (!process.env.INTERNAL_SECRET || internalSecret !== process.env.INTERNAL_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await dispatchEvent(payload);
    return NextResponse.json({ data: result, error: null });
  } catch (err) {
    console.error('[POST /api/notify/dispatch]', err);
    return NextResponse.json({ data: null, error: { message: 'Dispatch failed' } }, { status: 500 });
  }
}
