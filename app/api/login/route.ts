import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const password = process.env.SITE_PASSWORD;
  const { password: attempt } = await req.json().catch(() => ({ password: '' }));

  if (!password) {
    return NextResponse.json({ error: 'Server password not configured' }, { status: 500 });
  }
  if (attempt !== password) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('auth', '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return res;
}
