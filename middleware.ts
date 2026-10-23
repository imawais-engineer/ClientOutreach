import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const authed = req.cookies.get('auth')?.value === '1';
  const { pathname } = req.nextUrl;

  // API routes are guarded inside each handler (cookie OR x-api-secret).
  // Pages: /login is public; everything else requires the auth cookie.
  if (pathname === '/login') {
    if (authed) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  if (!authed) {
    const url = new URL('/login', req.url);
    if (pathname !== '/') {
      url.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // All pages except Next internals and API routes (API guards itself).
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
};
