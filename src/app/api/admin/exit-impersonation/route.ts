export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function POST(req: Request) {
  const cookieHeader = req.headers.get('cookie') || '';
  const adminToken = cookieHeader.match(/shepherd_admin_token=([^;]+)/)?.[1];
  if (!adminToken || !(await verifyToken(adminToken))) {
    // Also clears whatever's sitting in shepherd_admin_token — if it was
    // there but invalid/expired, leaving it in place would just fail the
    // same way again on the next attempt with no way out but a fresh login.
    const res = NextResponse.json({ data: null, error: { message: 'No admin session to return to — please log in again' } }, { status: 400 });
    res.cookies.set('shepherd_admin_token', '', { httpOnly: true, maxAge: 0, path: '/' });
    return res;
  }

  const res = NextResponse.json({ data: { restored: true }, error: null });
  res.cookies.set('shepherd_token', adminToken, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7200, path: '/',
  });
  res.cookies.set('shepherd_admin_token', '', { httpOnly: true, maxAge: 0, path: '/' });
  return res;
}
