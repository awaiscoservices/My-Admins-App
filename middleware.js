import { NextResponse } from 'next/server'

// Routes that require login
const PROTECTED_ROUTES = ['/profile', '/notifications', '/dashboard']

// Routes that require admin role (role is checked server-side in API routes; client checks in AdminLayout)
const ADMIN_ROUTES = ['/admin']

// Routes only for guests (redirect to dashboard if logged in)
const GUEST_ROUTES = ['/auth/login', '/auth/register']

export function middleware(request) {
  const { pathname } = request.nextUrl

  // Detect session cookie (Supabase may chunk it as sb-*-auth-token.0, .1, …)
  const isLoggedIn = request.cookies.getAll().some(c => /^sb-.+-auth-token/.test(c.name) && c.value)

  const isProtected = PROTECTED_ROUTES.some(r => pathname.startsWith(r))
  const isAdminRoute = ADMIN_ROUTES.some(r => pathname.startsWith(r))
  const isGuestOnly = GUEST_ROUTES.some(r => pathname.startsWith(r))

  // Not logged in → send to login
  if (!isLoggedIn && (isProtected || isAdminRoute)) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Logged in on a guest-only route → redirect based on role cookie if present,
  // otherwise fall back to /dashboard (login.js handles the smart redirect on submit).
  // We can't read DB role in middleware (no service-role key here), so we redirect to
  // /dashboard and let it handle the admin check on mount if needed.
  if (isLoggedIn && isGuestOnly) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/profile/:path*', '/notifications/:path*', '/dashboard/:path*', '/admin/:path*', '/auth/:path*'],
}
