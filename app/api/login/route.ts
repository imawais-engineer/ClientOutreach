import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Credentials = { email: string; password: string };

function configuredAccounts(): Credentials[] {
  const candidates: Array<{ email?: string; password?: string }> = [
    { email: process.env.SITE_EMAIL, password: process.env.SITE_PASSWORD },
    { email: process.env.SITE_TEST_EMAIL, password: process.env.SITE_TEST_PASSWORD },
  ];
  return candidates
    .filter((c): c is Credentials => Boolean(c.email && c.password))
    .map((c) => ({
      email: String(c.email).trim().toLowerCase(),
      password: String(c.password),
    }));
}

export async function POST(req: Request) {
  const accounts = configuredAccounts();

  if (accounts.length === 0) {
    return NextResponse.json(
      { error: 'Server credentials not configured' },
      { status: 500 }
    );
  }

  const { email: attemptEmail, password: attemptPassword } = await req
    .json()
    .catch(() => ({ email: '', password: '' }));

  const email = typeof attemptEmail === 'string' ? attemptEmail.trim().toLowerCase() : '';
  const password = typeof attemptPassword === 'string' ? attemptPassword : '';

  const match = accounts.find(
    (account) => account.email === email && account.password === password
  );

  if (!match) {
    return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, role: match.email === accounts[0].email ? 'owner' : 'guest' });
  res.cookies.set('auth', '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return res;
}
