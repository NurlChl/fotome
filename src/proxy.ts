import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

function applySecurityHeaders(response: NextResponse) {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(self)');
  return response;
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get NextAuth.js session token
  const sessionToken =
    request.cookies.get('authjs.session-token')?.value ||
    request.cookies.get('__Secure-authjs.session-token')?.value ||
    request.cookies.get('next-auth.session-token')?.value ||
    request.cookies.get('__Secure-next-auth.session-token')?.value;

  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  const isSecure = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
  
  const token = secret ? await getToken({ 
    req: request, 
    secret,
    secureCookie: isSecure
  }) : null;

  console.log('[MIDDLEWARE-DEBUG]', {
    url: request.url,
    isSecure,
    hasSessionToken: !!sessionToken,
    hasToken: !!token,
    role: token?.role
  });

  const isAuthenticated = !!token || (!secret && !!sessionToken);
  const role = token?.role;
  const isAdmin = role === 'admin' || role === 'superadmin';

  // Admin routing logic
  if (pathname.startsWith('/dashboard/admin')) {
    if (!isAuthenticated || !isAdmin) {
      return applySecurityHeaders(NextResponse.redirect(new URL('/login/admin', request.url)));
    }
    return applySecurityHeaders(NextResponse.next());
  }

  if (pathname === '/login/admin') {
    if (isAuthenticated && isAdmin) {
      return applySecurityHeaders(NextResponse.redirect(new URL('/dashboard/admin', request.url)));
    }
    return applySecurityHeaders(NextResponse.next());
  }

  // Regular user authentication pages (redirect authenticated users away)
  const authRoutes = ['/login', '/register'];
  if (authRoutes.some((route) => pathname === route || pathname.startsWith(route + '/'))) {
    if (pathname !== '/login/admin') { // Avoid overriding admin login
      if (isAuthenticated) {
        return applySecurityHeaders(NextResponse.redirect(new URL('/', request.url)));
      }
      return applySecurityHeaders(NextResponse.next());
    }
  }

  // Regular dashboard page (events/upload dashboard) is restricted to admin/superadmin
  if (pathname.startsWith('/dashboard')) {
    if (!isAuthenticated || !isAdmin) {
      return applySecurityHeaders(NextResponse.redirect(new URL('/login/admin', request.url)));
    }
    return applySecurityHeaders(NextResponse.next());
  }

  // Standard user protected routes
  const protectedUserRoutes = ['/my-photos', '/orders', '/settings'];
  if (protectedUserRoutes.some((route) => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      return applySecurityHeaders(NextResponse.redirect(new URL('/login', request.url)));
    }
  }

  return applySecurityHeaders(NextResponse.next());
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
