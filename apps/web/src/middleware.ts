import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js middleware for server-side route protection.
 * Checks for the airevstream_auth session cookie on protected routes.
 * Redirects unauthenticated users to /auth/login.
 */

const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/api/',
  '/r/',            // affiliate redirect
  '/_next/',
  '/favicon.ico',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Assign request ID for tracing (use existing header or generate new)
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const res = NextResponse.next();
    res.headers.set('x-request-id', requestId);
    return res;
  }

  // Allow root — it redirects to dashboard client-side
  if (pathname === '/') {
    const res = NextResponse.next();
    res.headers.set('x-request-id', requestId);
    return res;
  }

  // Check for session indicator cookie
  const authCookie = req.cookies.get('airevstream_auth');
  if (!authCookie?.value) {
    const loginUrl = new URL('/auth/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const res = NextResponse.next();
  res.headers.set('x-request-id', requestId);
  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and images.
     * Next.js middleware matcher syntax.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
