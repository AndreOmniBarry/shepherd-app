export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json(
    { data: { message: 'Logged out' }, error: null },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
  );
  // Clear the token cookie completely
  res.cookies.set('shepherd_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    expires: new Date(0),
    path: '/',
  });
  return res;
}
