export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = 'church-media';
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

// Single-image upload used by both Church Feed posts and Chat messages.
// No existing upload pattern was found anywhere in this codebase to reuse
// (event covers / church logo / avatars are plain text URL fields with no
// upload flow behind them) — see scripts/60_feed_chat_media.sql for the
// recon note and the manual Storage bucket setup this route depends on.
//
// Uploads via the service-role key server-side, same "service role
// bypasses RLS" pattern every other route in this app already uses for
// Postgres REST calls — no client ever touches Supabase Storage directly.
export async function POST(req: Request) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ data: null, error: { message: 'file is required' } }, { status: 400 });
  }

  const mime = file.type;
  const ext = ALLOWED[mime];
  if (!ext) {
    return NextResponse.json({ data: null, error: { message: 'Only JPEG, PNG, WEBP, or GIF images are allowed' } }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ data: null, error: { message: 'Image must be 5MB or smaller' } }, { status: 400 });
  }

  const contextRaw = String(form?.get('context') || 'feed');
  const context = contextRaw === 'chat' ? 'chat' : 'feed';
  const path = `${context}/${user.church_id || 'unassigned'}/${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const uploadRes = await fetch(`${S}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': mime },
    body: buf,
  });
  if (!uploadRes.ok) {
    const err = await uploadRes.text().catch(() => '');
    console.error('[POST /api/media/upload]', uploadRes.status, err);
    return NextResponse.json({ data: null, error: { message: 'Upload failed — the media storage bucket may not be set up yet. Contact your administrator.' } }, { status: 502 });
  }

  const url = `${S}/storage/v1/object/public/${BUCKET}/${path}`;
  return NextResponse.json({ data: { url, media_type: mime }, error: null }, { status: 201 });
}
