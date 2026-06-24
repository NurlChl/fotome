import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get NextAuth.js session token
  const sessionToken =
    request.cookies.get('authjs.session-token')?.value ||
    request.cookies.get('__Secure-authjs.session-token')?.value ||
    request.cookies.get('next-auth.session-token')?.value ||
    request.cookies.get('__Secure-next-auth.session-token')?.value;

  const isAuthenticated = !!sessionToken;

  // Admin routing logic
  if (pathname.startsWith('/dashboard/admin')) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/login/admin', request.url));
    }
    return NextResponse.next();
  }

  if (pathname === '/login/admin') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/dashboard/admin', request.url));
    }
    return NextResponse.next();
  }

  // Regular user authentication pages (redirect authenticated users away)
  const authRoutes = ['/login', '/register'];
  if (authRoutes.some((route) => pathname === route || pathname.startsWith(route + '/'))) {
    if (pathname !== '/login/admin') { // Avoid overriding admin login
      if (isAuthenticated) {
        return NextResponse.redirect(new URL('/', request.url));
      }
      return NextResponse.next();
    }
  }

  // Regular dashboard page (events/upload dashboard) is restricted to admin/superadmin
  if (pathname.startsWith('/dashboard')) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/login/admin', request.url));
    }
    return NextResponse.next();
  }

  // Standard user protected routes
  const protectedUserRoutes = ['/my-photos', '/orders', '/settings'];
  if (protectedUserRoutes.some((route) => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Security headers
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(), geolocation=(self)'
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - API routes (handled by their own middleware/endpoints)
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api).*)',
  ],
};
