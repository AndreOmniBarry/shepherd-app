export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` });

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    if (!token) return NextResponse.json({ data: null, error: { message: 'No token provided' } }, { status: 400 });

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/invites?token=eq.${token}&select=id,email,full_name,role,used,expires_at,cell_id,fellowship_id,department_id,cells(name),fellowships(name),departments(name)&limit=1`,
      { headers: hdrs() }
    );
    const data = await res.json();
    const invite = data?.[0];

    if (!invite) return NextResponse.json({ data: null, error: { message: 'This invite link is invalid. Please contact your administrator.' } }, { status: 404 });
    if (invite.used) return NextResponse.json({ data: null, error: { message: 'This invite has already been used. If you need access, contact your administrator.' } }, { status: 410 });
    if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ data: null, error: { message: 'This invite has expired. Please ask your administrator to send a new one.' } }, { status: 410 });

    const unit_name = (invite.cells as Record<string, string>|null)?.name ||
                      (invite.fellowships as Record<string, string>|null)?.name ||
                      (invite.departments as Record<string, string>|null)?.name || '—';

    return NextResponse.json({
      data: {
        invite: {
          full_name: invite.full_name,
          email: invite.email,
          role: invite.role,
          unit_name,
        }
      },
      error: null,
    });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to validate invite' } }, { status: 500 });
  }
}
