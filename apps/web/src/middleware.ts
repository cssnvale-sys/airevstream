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

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow root — it redirects to dashboard client-side
  if (pathname === '/') {
    return NextResponse.next();
  }

  // Check for session indicator cookie
  const authCookie = req.cookies.get('airevstream_auth');
  if (!authCookie?.value) {
    const loginUrl = new URL('/auth/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
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
