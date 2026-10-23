import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const email = process.env.SITE_EMAIL;
  const password = process.env.SITE_PASSWORD;
  const { email: attemptEmail, password: attemptPassword } = await req
    .json()
    .catch(() => ({ email: '', password: '' }));

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Server credentials not configured' },
      { status: 500 }
    );
  }

  const emailOk =
    typeof attemptEmail === 'string' &&
    attemptEmail.trim().toLowerCase() === email.trim().toLowerCase();
  const passwordOk =
    typeof attemptPassword === 'string' && attemptPassword === password;

  if (!emailOk || !passwordOk) {
    return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 });
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
