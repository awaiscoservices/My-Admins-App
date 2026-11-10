import { NextResponse } from 'next/server'

// Casinoze Support — staff only.
// Player routes (/dashboard, /profile, /notifications) live in My-Clients-App.
const ADMIN_ROUTES = ['/admin']
const SUPER_ADMIN_ROUTES = ['/superadmin']
const GUEST_ROUTES = ['/auth/login']

export function middleware(request) {
  const { pathname } = request.nextUrl

  // Supabase may split the session across cookies (…-auth-token.0, .1),
  // so match by prefix.
  const isLoggedIn = request.cookies.getAll()
    .some(c => /^sb-.+-auth-token/.test(c.name) && c.value)

  const isAdminRoute = ADMIN_ROUTES.some(r => pathname.startsWith(r))
  const isSuperAdminRoute = SUPER_ADMIN_ROUTES.some(r => pathname.startsWith(r))
  const isGuestOnly = GUEST_ROUTES.some(r => pathname.startsWith(r))

  // Role is checked again server-side on every API route; this only keeps
  // signed-out visitors off the staff pages.
  if (!isLoggedIn && (isAdminRoute || isSuperAdminRoute)) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  if (isLoggedIn && isGuestOnly) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/superadmin/:path*', '/auth/:path*'],
}
