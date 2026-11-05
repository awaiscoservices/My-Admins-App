import { NextResponse } from 'next/server'

// Routes that require login
const PROTECTED_ROUTES = ['/dashboard', '/dashboard/wallet', '/dashboard/deposit', '/dashboard/redeem', '/dashboard/profile', '/dashboard/chat', '/dashboard/games']

// Routes that require admin role (checked client-side too)
const ADMIN_ROUTES = ['/admin']

// Routes only for guests (redirect to dashboard if logged in)
const GUEST_ROUTES = ['/auth/login', '/auth/register']

export function middleware(request) {
  const { pathname } = request.nextUrl

  // Get token from cookies
  // Supabase may split the session across cookies (…-auth-token.0, .1), so match by prefix
  const isLoggedIn = request.cookies.getAll().some(c => /^sb-.+-auth-token/.test(c.name) && c.value)
  const isProtected = PROTECTED_ROUTES.some(r => pathname.startsWith(r))
  const isAdminRoute = ADMIN_ROUTES.some(r => pathname.startsWith(r))
  const isGuestOnly = GUEST_ROUTES.some(r => pathname.startsWith(r))

  // Not logged in trying to access protected route
  if (!isLoggedIn && (isProtected || isAdminRoute)) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Logged in trying to access guest-only route
  if (isLoggedIn && isGuestOnly) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/auth/:path*'],
}
